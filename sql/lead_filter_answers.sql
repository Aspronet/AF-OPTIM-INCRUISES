-- ============================================================
-- AsproFunnel — Lead Filter Answers (Respuestas del formulario filtro)
-- ============================================================
-- Tabla: lead_filter_answers
-- Propósito: Almacena las respuestas de las 7 preguntas filtro
--            que el lead completa en Step 3 (Agendamiento) antes
--            de ver el calendario.
--
-- Relaciones:
--   lead_filter_answers.lead_email  → leads.email
--   lead_filter_answers.campaign_id → campaigns.id
--   lead_filter_answers.owner_id    → user_profiles.id (el vendedor asignado al lead)
--
-- Flujo de datos:
--   1. Lead completa optin (Step 1) → se crea row en `leads`
--   2. Lead ve video (Step 2) → navega a Step 3
--   3. Lead responde 7 preguntas filtro (Step 3) → se insertan en `lead_filter_answers`
--   4. Lead agenda cita → se confirma booking
--
-- Tracking posterior:
--   Para consumir estas respuestas desde otra plataforma (CRM, dashboard, etc.):
--     SELECT * FROM lead_filter_answers
--     WHERE campaign_id = 'TU_CAMPAIGN_ID'
--     ORDER BY created_at DESC;
--
--   Para obtener respuestas + datos del lead:
--     SELECT lfa.*, l.name, l.phone, l.country, l.source
--     FROM lead_filter_answers lfa
--     JOIN leads l ON l.email = lfa.lead_email
--       AND l.campaign_id = lfa.campaign_id
--     ORDER BY lfa.created_at DESC;
-- ============================================================

-- 1. Crear la tabla
CREATE TABLE IF NOT EXISTS lead_filter_answers (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_email    TEXT NOT NULL,
  campaign_id   UUID,
  owner_id      UUID,

  -- Pregunta 1: ¿Cuál es tu nombre completo? (texto libre)
  q1_nombre_completo          TEXT,

  -- Pregunta 2: ¿En qué país te encuentras? (selector con banderas)
  -- Valores posibles: "Chile", "Perú", "Colombia", "México", "Argentina",
  --   "Estados Unidos", + 60 países más, "Otro país"
  q2_pais                     TEXT,

  -- Pregunta 3: ¿Cuál describe mejor tu situación actual?
  -- Valores posibles:
  --   "Empleado a tiempo completo"
  --   "Empleado medio tiempo"
  --   "Emprendedor o freelancer"
  --   "Dueño de negocio"
  --   "Estudiante"
  --   "Otro"
  q3_situacion_actual         TEXT,

  -- Pregunta 4: ¿Alguna vez intentaste otro tipo de negocio por tu cuenta?
  -- Valores posibles:
  --   "Sí, y me fue bien — busco algo mejor o complementario"
  --   "Sí, pero no me funcionó — me faltó sistema o guía"
  --   "Sí, pero lo dejé por falta de tiempo o capital"
  --   "No, esta sería mi primera vez"
  q4_experiencia_negocios     TEXT,

  -- Pregunta 5: ¿Qué fue lo que más te llamó la atención del video?
  -- Valores posibles:
  --   "La oportunidad de generar ingresos en dólares"
  --   "El sistema de ventas comprobado que te guía paso a paso"
  --   "La posibilidad de hacerlo part-time sin dejar mi trabajo"
  --   "La industria y el respaldo de la empresa"
  --   "Todavía tengo dudas pero quiero entender mejor"
  q5_atencion_video           TEXT,

  -- Pregunta 6: ¿Cuánto tiempo podrías dedicar a un proyecto nuevo?
  -- Valores posibles:
  --   "Menos de 1 hora al día — pero soy constante"
  --   "1 a 2 horas al día"
  --   "Más de 2 horas al día"
  --   "Podría dedicarme full-time si vale la pena"
  q6_tiempo_disponible        TEXT,

  -- Pregunta 7: ¿Estás en posición de tomar una decisión e invertir?
  -- Valores posibles:
  --   "Sí, estoy listo para empezar si tiene sentido"
  --   "Muy probablemente sí, quiero ver los detalles finales"
  --   "Depende de la inversión — necesito saber cuánto es"
  --   "Solo estoy explorando por ahora"
  q7_disposicion_inversion    TEXT,

  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Índices para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_lfa_lead_email ON lead_filter_answers (lead_email);
CREATE INDEX IF NOT EXISTS idx_lfa_campaign_id ON lead_filter_answers (campaign_id);
CREATE INDEX IF NOT EXISTS idx_lfa_owner_id ON lead_filter_answers (owner_id);
CREATE INDEX IF NOT EXISTS idx_lfa_created_at ON lead_filter_answers (created_at DESC);

-- 3. RLS (Row Level Security) — habilitar para acceso seguro
ALTER TABLE lead_filter_answers ENABLE ROW LEVEL SECURITY;

-- Política: el anon key puede insertar (desde el frontend del funnel)
CREATE POLICY "anon_insert_filter_answers"
  ON lead_filter_answers
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Política: el anon key puede leer sus propios registros por campaign
CREATE POLICY "anon_select_filter_answers"
  ON lead_filter_answers
  FOR SELECT
  TO anon
  USING (true);

-- 4. Comentarios en la tabla para documentación
COMMENT ON TABLE lead_filter_answers IS
  'Respuestas de las 7 preguntas filtro del funnel (Step 3). Cada row = 1 lead que completó el formulario antes de agendar cita.';

COMMENT ON COLUMN lead_filter_answers.lead_email IS
  'Email del lead — FK lógica a leads.email';
COMMENT ON COLUMN lead_filter_answers.campaign_id IS
  'ID de la campaña — FK lógica a campaigns.id (env: AF_CAMPAIGN_ID)';
COMMENT ON COLUMN lead_filter_answers.owner_id IS
  'ID del vendedor asignado al lead — FK lógica a user_profiles.id';
COMMENT ON COLUMN lead_filter_answers.q1_nombre_completo IS
  'Pregunta 1: ¿Cuál es tu nombre completo? — Input de texto libre';
COMMENT ON COLUMN lead_filter_answers.q2_pais IS
  'Pregunta 2: ¿En qué país te encuentras? — Selector con bandera + búsqueda';
COMMENT ON COLUMN lead_filter_answers.q3_situacion_actual IS
  'Pregunta 3: Situación laboral actual — Card selection';
COMMENT ON COLUMN lead_filter_answers.q4_experiencia_negocios IS
  'Pregunta 4: Experiencia previa en negocios — Card selection';
COMMENT ON COLUMN lead_filter_answers.q5_atencion_video IS
  'Pregunta 5: Qué llamó la atención del video — Card selection';
COMMENT ON COLUMN lead_filter_answers.q6_tiempo_disponible IS
  'Pregunta 6: Tiempo disponible para dedicar — Card selection';
COMMENT ON COLUMN lead_filter_answers.q7_disposicion_inversion IS
  'Pregunta 7: Disposición a invertir (pre-cierre) — Card selection';

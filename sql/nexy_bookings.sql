-- ============================================================
-- Nexfy — Nexy Bookings (agendamientos para batch call IA)
-- ============================================================
-- Tabla: nexy_bookings
-- Propósito: Persistir las reservas de llamada con Nexy (AI agent),
--            independiente del flujo humano (Pablo/asesores).
--            n8n consume esta tabla en batch para disparar las
--            llamadas Retell programadas.
--
-- Flujo:
--   1. Lead completa form en optim/step/3
--   2. Elige día (lun-vie) + hora (6-22h en su TZ) → INSERT nexy_bookings
--   3. Cron n8n consulta nexy_bookings_due cada N min
--   4. Para cada due → trigger Retell outbound call
--   5. Resultado se persiste back (call_id, status, outcome)
--
-- Status:
--   pending      → creado, esperando hora programada
--   queued       → n8n lo levantó, en cola Retell
--   in_progress  → llamada en curso
--   completed    → llamada exitosa
--   no_show      → no contestó / cortó
--   failed       → falla técnica
--   cancelled    → cancelado por usuario
-- ============================================================

DO $$ BEGIN
  CREATE TYPE nexy_booking_status AS ENUM (
    'pending',
    'queued',
    'in_progress',
    'completed',
    'no_show',
    'failed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS nexy_bookings (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Lead identity (FK lógica)
  lead_id         UUID,
  email           TEXT NOT NULL,
  phone           TEXT,
  name            TEXT,
  country         TEXT,

  -- Schedule
  scheduled_at    TIMESTAMPTZ NOT NULL,
  timezone        TEXT NOT NULL,                              -- IANA, ej. America/Argentina/Cordoba
  duration_min    INT NOT NULL DEFAULT 7,

  -- Lifecycle
  status          nexy_booking_status NOT NULL DEFAULT 'pending',

  -- Retell tracking (n8n / outbound worker llena esto)
  call_id         TEXT,
  call_started_at TIMESTAMPTZ,
  call_ended_at   TIMESTAMPTZ,
  call_outcome    TEXT,                                       -- completed | no_answer | busy | failed | etc

  -- Form context
  answers         JSONB DEFAULT '{}'::jsonb,                  -- mismas keys que lead_filter_answers.answers
  notes           TEXT,

  -- Source / context
  campaign_id     UUID,
  source          TEXT DEFAULT 'optim_funnel_step3',
  metadata        JSONB DEFAULT '{}'::jsonb,

  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ─── Indexes ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_nb_email          ON nexy_bookings (email);
CREATE INDEX IF NOT EXISTS idx_nb_lead_id        ON nexy_bookings (lead_id);
CREATE INDEX IF NOT EXISTS idx_nb_scheduled_at   ON nexy_bookings (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_nb_status         ON nexy_bookings (status);
CREATE INDEX IF NOT EXISTS idx_nb_call_id        ON nexy_bookings (call_id);
CREATE INDEX IF NOT EXISTS idx_nb_created_at     ON nexy_bookings (created_at DESC);

-- Cron de n8n: WHERE status IN ('pending','queued') AND scheduled_at <= now()+5min
CREATE INDEX IF NOT EXISTS idx_nb_due_lookup
  ON nexy_bookings (scheduled_at)
  WHERE status IN ('pending', 'queued');

-- ─── updated_at trigger ─────────────────────────────────────

CREATE OR REPLACE FUNCTION nexy_bookings_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nexy_bookings_updated_at ON nexy_bookings;
CREATE TRIGGER trg_nexy_bookings_updated_at
  BEFORE UPDATE ON nexy_bookings
  FOR EACH ROW EXECUTE FUNCTION nexy_bookings_set_updated_at();

-- ─── n8n cron view: bookings que ya están en ventana de disparo ───

CREATE OR REPLACE VIEW nexy_bookings_due AS
SELECT
  nb.*,
  EXTRACT(EPOCH FROM (nb.scheduled_at - now())) AS seconds_until_call
FROM nexy_bookings nb
WHERE nb.status IN ('pending', 'queued')
  AND nb.scheduled_at <= now() + interval '5 minutes'
  AND nb.scheduled_at >= now() - interval '15 minutes'
ORDER BY nb.scheduled_at ASC;

COMMENT ON VIEW nexy_bookings_due IS
'Bookings que el cron de n8n debe disparar ahora. Ventana: [-15min, +5min] de scheduled_at, status pending|queued.';

-- ─── Sample queries (referencia, NO ejecutar) ──────────────
-- Ver agenda activa de Nexy:
--   SELECT email, scheduled_at AT TIME ZONE timezone AS local_time, status
--   FROM nexy_bookings
--   WHERE scheduled_at >= now()
--   ORDER BY scheduled_at ASC;
--
-- Lo que el cron debe disparar ahora:
--   SELECT id, email, phone, name, scheduled_at, seconds_until_call
--   FROM nexy_bookings_due;
--
-- Marcar como en cola desde n8n (atómico, evita doble dispatch):
--   UPDATE nexy_bookings SET status='queued', metadata = metadata || jsonb_build_object('queued_at', now())
--   WHERE id = $1 AND status = 'pending'
--   RETURNING *;

-- ============================================================
-- Nexfy — Call Sessions (Sesiones de llamada con Nexy)
-- ============================================================
-- Tabla: call_sessions
-- Propósito: Persistir cada solicitud de llamada con Nexy,
--            permitir reintentos vía email link, y habilitar
--            seguimiento (WhatsApp/email) si el lead no llama.
--
-- Flujo:
--   1. Lead clickea "Hablar con Nexy" en optim/step/2
--   2. Verifica email + phone en modal
--   3. Server action `requestCallLink()` crea row aquí (status: pending)
--   4. Genera token = `<id>.<HMAC>` y manda Brevo email con link
--      hacia call.nexfy.io/?t=<token>  → status: link_sent
--   5. Lead clickea link → call-nexfy valida token → status: in_progress
--   6. Lead habla con Nexy (Retell) → status: completed (auto via webhook)
--   7. Si no llama en X horas → n8n cron dispara follow-up por wsp/email
--
-- Stages:
--   pending      → row creada, link aún no enviado
--   link_sent    → email enviado, esperando que abra
--   in_progress  → lead abrió el link y entró a call.nexfy.io
--   completed    → llamada finalizada exitosamente
--   no_show      → llamada cancelada/abandonada por el lead
--   expired      → pasaron 14 días sin completarse
--
-- Followup stages (manejados por n8n):
--   none           → no se mandó nada todavía
--   reminder_1h    → email recordatorio a 1h
--   wsp_24h        → WhatsApp a las 24h
--   wsp_72h        → WhatsApp a las 72h con oferta de booking
--   wsp_7d         → último intento a los 7 días
--   escalated      → asignar a humano
-- ============================================================

-- ─── Enums ──────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE call_session_status AS ENUM (
    'pending',
    'link_sent',
    'in_progress',
    'completed',
    'no_show',
    'expired'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE call_followup_stage AS ENUM (
    'none',
    'reminder_1h',
    'wsp_24h',
    'wsp_72h',
    'wsp_7d',
    'escalated'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── call_sessions ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS call_sessions (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Lead identity
  lead_id             UUID,                                 -- FK lógica a leads.id (no constrain por flexibilidad)
  email               TEXT NOT NULL,
  phone               TEXT,
  name                TEXT,
  country             TEXT,                                 -- ISO code (AR, CL, MX, etc.)

  -- Token verification
  token_hmac          TEXT NOT NULL,                        -- hex HMAC-SHA256(id, CALL_AUTH_SECRET)

  -- Session lifecycle
  status              call_session_status NOT NULL DEFAULT 'pending',
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),

  -- Email tracking
  link_sent_at        TIMESTAMPTZ,
  link_clicked_at     TIMESTAMPTZ,                          -- primera vez que abrió el link

  -- Call attempts
  attempts_count      INT NOT NULL DEFAULT 0,
  first_attempt_at    TIMESTAMPTZ,
  last_attempt_at     TIMESTAMPTZ,

  -- Retell call data (último intento)
  call_id             TEXT,
  call_started_at     TIMESTAMPTZ,
  call_ended_at       TIMESTAMPTZ,
  call_duration_sec   INT,
  call_outcome        TEXT,                                 -- completed | cancelled_by_user | no_answer | error

  -- Follow-up state
  followup_stage      call_followup_stage NOT NULL DEFAULT 'none',
  followup_last_at    TIMESTAMPTZ,

  -- Source / context
  campaign_id         UUID,                                 -- AF_CAMPAIGN_ID
  source              TEXT DEFAULT 'optim_funnel',
  metadata            JSONB DEFAULT '{}'::jsonb,            -- utms, video_pct, country_iso, user_agent, etc.

  created_at          TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ─── Indexes ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_cs_email          ON call_sessions (email);
CREATE INDEX IF NOT EXISTS idx_cs_lead_id        ON call_sessions (lead_id);
CREATE INDEX IF NOT EXISTS idx_cs_call_id        ON call_sessions (call_id);
CREATE INDEX IF NOT EXISTS idx_cs_status         ON call_sessions (status);
CREATE INDEX IF NOT EXISTS idx_cs_expires_at     ON call_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_cs_created_at     ON call_sessions (created_at DESC);

-- Para el cron de follow-up: WHERE status='link_sent' AND followup_stage <something>
CREATE INDEX IF NOT EXISTS idx_cs_followup_lookup
  ON call_sessions (status, followup_stage, link_sent_at)
  WHERE status IN ('link_sent', 'in_progress');

-- ─── updated_at trigger ─────────────────────────────────────

CREATE OR REPLACE FUNCTION call_sessions_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_call_sessions_updated_at ON call_sessions;
CREATE TRIGGER trg_call_sessions_updated_at
  BEFORE UPDATE ON call_sessions
  FOR EACH ROW
  EXECUTE FUNCTION call_sessions_set_updated_at();

-- ─── call_session_events (timeline granular) ───────────────

CREATE TABLE IF NOT EXISTS call_session_events (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id    UUID NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL,                              -- link_sent | email_opened | clicked | call_started | call_ended | wsp_sent | reminder_sent | expired
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cse_session_id   ON call_session_events (session_id);
CREATE INDEX IF NOT EXISTS idx_cse_event_type   ON call_session_events (event_type);
CREATE INDEX IF NOT EXISTS idx_cse_created_at   ON call_session_events (created_at DESC);

-- ─── RLS (Row Level Security) ───────────────────────────────
-- Las tablas se acceden vía service_role (server-side) o anon con condiciones.
-- Anon NO debería poder leer call_sessions directamente (token tiene HMAC).
-- Los inserts/updates van por server actions con service_role.
-- Si querés bloquear anon completamente, descomentar:
--
-- ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE call_session_events ENABLE ROW LEVEL SECURITY;
-- (sin policies → anon queda bloqueado, service_role pasa por bypass)

-- ─── Helper view: sesiones que necesitan follow-up ──────────

CREATE OR REPLACE VIEW call_sessions_needing_followup AS
SELECT
  cs.*,
  EXTRACT(EPOCH FROM (now() - cs.link_sent_at)) / 3600 AS hours_since_link
FROM call_sessions cs
WHERE cs.status = 'link_sent'
  AND cs.expires_at > now()
  AND (
    (cs.followup_stage = 'none'         AND cs.link_sent_at < now() - interval '1 hour') OR
    (cs.followup_stage = 'reminder_1h'  AND cs.link_sent_at < now() - interval '24 hours') OR
    (cs.followup_stage = 'wsp_24h'      AND cs.link_sent_at < now() - interval '72 hours') OR
    (cs.followup_stage = 'wsp_72h'      AND cs.link_sent_at < now() - interval '7 days')
  );

-- ─── Sample queries (no ejecutar, sólo referencia) ──────────
-- Ver sesiones activas:
--   SELECT id, email, status, attempts_count, link_sent_at, expires_at
--   FROM call_sessions
--   WHERE status IN ('link_sent', 'in_progress')
--   ORDER BY created_at DESC;
--
-- Ver timeline de una sesión:
--   SELECT event_type, metadata, created_at
--   FROM call_session_events
--   WHERE session_id = '<id>'
--   ORDER BY created_at ASC;
--
-- Sesiones que cumplen criterio de follow-up:
--   SELECT * FROM call_sessions_needing_followup;

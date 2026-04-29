import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// ─── Config ──────────────────────────────────────────────

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "Nexfy";
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "hello@nexfy.io";

const PORTAL_URL = process.env.PORTAL_URL || "https://portal.nexfy.io";

const BANNER_URL = "https://lzqzymvzgxdgrhghepyy.supabase.co/storage/v1/object/public/recursos/mail%20.png";

// Retell signs webhooks with HMAC-SHA256(rawBody, apiKey).
// A separate webhook secret can be set via RETELL_WEBHOOK_SECRET; otherwise
// fall back to the API key used to start the call.
const RETELL_WEBHOOK_SECRET =
  process.env.RETELL_WEBHOOK_SECRET || process.env.RETELL_API_KEY || "";

const SUPABASE_URL = "https://lzqzymvzgxdgrhghepyy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6cXp5bXZ6Z3hkZ3JoZ2hlcHl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDA0NDQsImV4cCI6MjA5MjYxNjQ0NH0.6sF__jhX_Xah3M6Xmd9phdrU5-fXzvJoGrtvGkzcQbM";

// ─── Signature verification ──────────────────────────────

function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!RETELL_WEBHOOK_SECRET) return false;
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", RETELL_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  const sig = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  if (expected.length !== sig.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

// ─── Email template ──────────────────────────────────────

function portalAccessHtml(opts: {
  leadName: string;
  portalUrl: string;
}) {
  const firstName = opts.leadName.split(/\s+/)[0] || "";
  const greeting = firstName ? `Hola ${firstName}` : "Hola";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu acceso al portal Nexfy</title>
</head>
<body style="margin:0; padding:0; background-color:#0B0D10; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">

<div style="display:none; max-height:0px; overflow:hidden; font-size:1px; line-height:1px; color:#0B0D10;">
  Tu acceso al portal de la Certificación Profesional en Sistemas de Ventas con IA.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0B0D10;">
  <tr>
    <td align="center" style="padding:32px 10px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background-color:#12161C; border-radius:16px; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.45); border:1px solid rgba(74,222,128,0.15);">

        <!-- Banner -->
        <tr>
          <td style="padding:0; line-height:0;">
            <img src="${BANNER_URL}" alt="Nexfy" width="600" style="display:block; width:100%; max-width:600px; height:auto; border:0;">
          </td>
        </tr>

        <!-- Top accent -->
        <tr>
          <td style="height:3px; background:linear-gradient(90deg, #4ADE80, #86EFAC, #4ADE80); font-size:0; line-height:0;">&nbsp;</td>
        </tr>

        <!-- Brand row -->
        <tr>
          <td style="padding:28px 40px 0 40px; text-align:left;">
            <span style="display:inline-block; padding:6px 12px; border-radius:6px; background:rgba(74,222,128,0.08); border:1px solid rgba(74,222,128,0.3); font-size:11px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; color:#4ADE80;">
              Nexfy &middot; Certificaci&oacute;n
            </span>
          </td>
        </tr>

        <!-- Title -->
        <tr>
          <td style="padding:24px 40px 6px 40px;">
            <h1 style="margin:0; font-size:26px; font-weight:700; color:#FFFFFF; letter-spacing:-0.5px; line-height:1.2;">
              Tu acceso est&aacute; listo &#9989;
            </h1>
          </td>
        </tr>

        <!-- Subtitle -->
        <tr>
          <td style="padding:6px 40px 24px 40px;">
            <p style="margin:0; font-size:15px; color:rgba(255,255,255,0.7); line-height:1.6;">
              ${greeting}. Gracias por hablar con Nexy. Te dejamos el acceso directo al portal con los 4 pasos que necesit&aacute;s para arrancar.
            </p>
          </td>
        </tr>

        <!-- Steps card -->
        <tr>
          <td style="padding:0 40px 8px 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:rgba(74,222,128,0.04); border-radius:12px; border:1px solid rgba(74,222,128,0.18);">
              <tr>
                <td style="padding:24px;">
                  <p style="margin:0 0 16px 0; font-size:11px; font-weight:700; color:#4ADE80; text-transform:uppercase; letter-spacing:1.4px;">Tus 4 pasos en el portal</p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td valign="top" style="padding:8px 0; font-size:14px; color:#FFFFFF; font-weight:700; width:32px;">1.</td>
                      <td style="padding:8px 0; font-size:14px; color:rgba(255,255,255,0.85); line-height:1.55;">Activ&aacute; tu cuenta y configur&aacute; tu perfil</td>
                    </tr>
                    <tr>
                      <td valign="top" style="padding:8px 0; font-size:14px; color:#FFFFFF; font-weight:700; width:32px;">2.</td>
                      <td style="padding:8px 0; font-size:14px; color:rgba(255,255,255,0.85); line-height:1.55;">Mir&aacute; el m&oacute;dulo de bienvenida (10 min)</td>
                    </tr>
                    <tr>
                      <td valign="top" style="padding:8px 0; font-size:14px; color:#FFFFFF; font-weight:700; width:32px;">3.</td>
                      <td style="padding:8px 0; font-size:14px; color:rgba(255,255,255,0.85); line-height:1.55;">Conect&aacute; tus herramientas de venta</td>
                    </tr>
                    <tr>
                      <td valign="top" style="padding:8px 0; font-size:14px; color:#FFFFFF; font-weight:700; width:32px;">4.</td>
                      <td style="padding:8px 0; font-size:14px; color:rgba(255,255,255,0.85); line-height:1.55;">Lanz&aacute; tu primera campa&ntilde;a guiada</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:24px 40px 8px 40px; text-align:center;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
              <tr>
                <td style="border-radius:12px; background-color:#4ADE80; text-align:center;">
                  <a href="${opts.portalUrl}" target="_blank" style="display:inline-block; padding:16px 44px; font-size:14px; font-weight:700; color:#0B0D10; text-decoration:none; letter-spacing:0.6px; text-transform:uppercase;">
                    Entrar al portal &rarr;
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Secondary text -->
        <tr>
          <td style="padding:8px 40px 28px 40px; text-align:center;">
            <p style="margin:0; font-size:12px; color:rgba(255,255,255,0.4); line-height:1.6;">
              El acceso es personal y est&aacute; vinculado a este email.<br>
              Guard&aacute; este correo: pod&eacute;s volver al portal cuando quieras desde el bot&oacute;n de arriba.
            </p>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding:0 40px;">
            <div style="height:1px; background-color:rgba(255,255,255,0.06); font-size:0; line-height:0;">&nbsp;</div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 28px 40px; text-align:center;">
            <p style="margin:0 0 6px 0; font-size:12px; color:rgba(255,255,255,0.45); font-weight:600;">Nexfy &mdash; Sistemas de Ventas con IA</p>
            <p style="margin:0; font-size:11px; color:rgba(255,255,255,0.25); line-height:1.6;">
              &iquest;Dudas? Respond&eacute; este email y te contestamos.<br>
              &copy; ${new Date().getFullYear()} Nexfy
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ─── Brevo send ──────────────────────────────────────────

async function sendPortalEmail(opts: {
  email: string;
  name: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!BREVO_API_KEY) return { ok: false, error: "BREVO_API_KEY missing" };

  const portalUrl = `${PORTAL_URL}/?ref=${encodeURIComponent(opts.email)}`;

  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: opts.email, name: opts.name || opts.email }],
      subject: "Tu acceso al portal Nexfy está listo",
      htmlContent: portalAccessHtml({
        leadName: opts.name || "",
        portalUrl,
      }),
      tags: ["portal-access", "post-call"],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.message || `Brevo ${res.status}` };
  }
  return { ok: true };
}

// ─── Activity logging ────────────────────────────────────

type LeadActivity = {
  lead_id?: string;
  user_id?: string;
  action: string;
  metadata?: Record<string, unknown>;
};

async function logActivity(activity: LeadActivity): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/lead_activity`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(activity),
  }).catch((e) => console.error("[retell-webhook] activity log failed:", e));
}

async function findLeadByEmail(
  email: string
): Promise<{ leadId?: string; userId?: string; name?: string }> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/leads?email=eq.${encodeURIComponent(
        email
      )}&select=id,user_id,name&order=created_at.desc&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    const rows = await res.json();
    if (Array.isArray(rows) && rows[0]) {
      return {
        leadId: rows[0].id,
        userId: rows[0].user_id,
        name: rows[0].name,
      };
    }
  } catch (e) {
    console.error("[retell-webhook] lead lookup failed:", e);
  }
  return {};
}

// ─── Idempotency: only send once per call_id ─────────────

async function alreadySent(callId: string): Promise<boolean> {
  if (!callId) return false;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/lead_activity?action=eq.retell_portal_email_sent&metadata->>call_id=eq.${encodeURIComponent(
        callId
      )}&select=id&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

// ─── Webhook handler ─────────────────────────────────────

type RetellEvent =
  | "call_started"
  | "call_ended"
  | "call_analyzed"
  | string;

interface RetellWebhookBody {
  event: RetellEvent;
  call: {
    call_id?: string;
    metadata?: {
      lead_id?: string;
      lead_email?: string;
      source?: string;
    };
    retell_llm_dynamic_variables?: {
      lead_name?: string;
      lead_email?: string;
    };
    call_analysis?: {
      custom_analysis_data?: Record<string, unknown>;
      call_successful?: boolean;
    };
  };
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Signature verification (skippable in dev with RETELL_SKIP_VERIFY=1)
  const signature = req.headers.get("x-retell-signature");
  const skipVerify = process.env.RETELL_SKIP_VERIFY === "1";
  if (!skipVerify && !verifySignature(rawBody, signature)) {
    console.warn("[retell-webhook] signature verification failed");
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  let payload: RetellWebhookBody;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { event, call } = payload;

  // We only act on call_analyzed (post-call analysis is ready).
  // Acknowledge other events with 200 so Retell stops retrying.
  if (event !== "call_analyzed") {
    return NextResponse.json({ ok: true, ignored: event });
  }

  const callId = call?.call_id || "";
  const email =
    call?.metadata?.lead_email ||
    call?.retell_llm_dynamic_variables?.lead_email ||
    "";

  if (!email) {
    console.warn("[retell-webhook] no email on call:", callId);
    return NextResponse.json({ ok: true, skipped: "no_email" });
  }

  // Idempotency: don't double-send if Retell retries
  if (await alreadySent(callId)) {
    return NextResponse.json({ ok: true, skipped: "already_sent" });
  }

  const lead = await findLeadByEmail(email);
  const name =
    lead.name || call?.retell_llm_dynamic_variables?.lead_name || "";

  const sendResult = await sendPortalEmail({ email, name });

  await logActivity({
    lead_id: lead.leadId,
    user_id: lead.userId,
    action: sendResult.ok
      ? "retell_portal_email_sent"
      : "retell_portal_email_failed",
    metadata: {
      call_id: callId,
      email,
      error: sendResult.ok ? undefined : sendResult.error,
    },
  });

  return NextResponse.json({ ok: sendResult.ok, error: sendResult.error });
}

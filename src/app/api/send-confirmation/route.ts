import { NextRequest, NextResponse } from "next/server";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "Nexfy";
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "hello@nexfy.io";

const BANNER_URL = "https://lzqzymvzgxdgrhghepyy.supabase.co/storage/v1/object/public/recursos/mail%20.png";

// ── Google Calendar URL builder ──

function buildGoogleCalendarUrl(opts: {
  title: string;
  rawDate: string;    // YYYY-MM-DD
  time: string;       // "2:40 PM"
  duration: number;   // minutes
  host: string;
  timezone: string;
}) {
  // Parse time "2:40 PM" → hours, minutes
  const match = opts.time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return "";
  let hours = parseInt(match[1]);
  const mins = parseInt(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === "PM" && hours !== 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;

  const [y, m, d] = opts.rawDate.split("-");
  const pad = (n: number) => n.toString().padStart(2, "0");
  const start = `${y}${m}${d}T${pad(hours)}${pad(mins)}00`;
  // End time
  const endMins = hours * 60 + mins + opts.duration;
  const endH = Math.floor(endMins / 60) % 24;
  const endM = endMins % 60;
  const end = `${y}${m}${d}T${pad(endH)}${pad(endM)}00`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${start}/${end}`,
    details: `Llamada de presentaci\u00f3n con ${opts.host} via Nexfy`,
    ctz: opts.timezone || "America/Argentina/Buenos_Aires",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// ── Base template ──

function baseTemplate(opts: {
  preheader: string;
  title: string;
  subtitle: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
  secondaryText?: string;
}) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${opts.title}</title>
</head>
<body style="margin:0; padding:0; background-color:#F0FDF4; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">

<div style="display:none; max-height:0px; overflow:hidden; font-size:1px; line-height:1px; color:#F0FDF4;">
  ${opts.preheader}
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F0FDF4;">
  <tr>
    <td align="center" style="padding:32px 10px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background-color:#FFFFFF; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(74,222,128,0.12);">

        <!-- Banner -->
        <tr>
          <td style="padding:0; line-height:0;">
            <img src="${BANNER_URL}" alt="Nexfy" width="600" style="display:block; width:100%; max-width:600px; height:auto; border:0;">
          </td>
        </tr>

        <!-- Accent Line -->
        <tr>
          <td style="padding:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="height:3px; background:linear-gradient(90deg, #16A34A, #4ADE80, #86EFAC, #4ADE80, #16A34A); font-size:0; line-height:0;">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Title -->
        <tr>
          <td style="padding:32px 40px 8px 40px; text-align:center;">
            <h1 style="margin:0; font-size:26px; font-weight:700; color:#1A1A2E; letter-spacing:-0.5px;">
              ${opts.title}
            </h1>
          </td>
        </tr>

        <!-- Subtitle -->
        <tr>
          <td style="padding:4px 40px 28px 40px; text-align:center;">
            <p style="margin:0; font-size:15px; color:#6B7280; line-height:1.6;">
              ${opts.subtitle}
            </p>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding:0 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="height:1px; background-color:#DCFCE7; font-size:0; line-height:0;">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 40px 0 40px;">
            ${opts.bodyHtml}
          </td>
        </tr>

        <!-- CTA Button -->
        <tr>
          <td style="padding:12px 40px 6px 40px; text-align:center;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
              <tr>
                <td style="border-radius:10px; background-color:#4ADE80; text-align:center;">
                  <a href="${opts.ctaUrl}" target="_blank" style="display:inline-block; padding:15px 44px; font-size:15px; font-weight:700; color:#0B0D10; text-decoration:none; letter-spacing:0.3px;">
                    ${opts.ctaText}
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Secondary text -->
        <tr>
          <td style="padding:12px 40px 32px 40px; text-align:center;">
            <p style="margin:0; font-size:13px; color:#9CA3AF; line-height:1.5;">
              ${opts.secondaryText || '&iquest;Dudas? Respond&eacute; este email o escribinos a <a href="mailto:hello@nexfy.io" style="color:#16A34A; text-decoration:none; font-weight:600;">hello@nexfy.io</a>'}
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:#F0FDF4; padding:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="height:1px; background-color:#DCFCE7; font-size:0; line-height:0;">&nbsp;</td></tr>
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:28px 40px 8px 40px; text-align:center;">
                  <p style="margin:0; font-size:22px; font-weight:800; letter-spacing:-0.02em; color:#1A1A2E;">Nexfy</p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 40px 8px 40px; text-align:center;">
                  <p style="margin:0; font-size:12px; color:#9CA3AF; line-height:1.6;">La infraestructura de crecimiento para equipos de ventas</p>
                </td>
              </tr>
              <tr>
                <td style="padding:4px 40px 8px 40px; text-align:center;">
                  <a href="https://nexfy.io" style="color:#16A34A; text-decoration:none; font-size:12px; font-weight:600;">nexfy.io</a>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 40px 10px 40px; text-align:center;">
                  <p style="margin:0; font-size:11px; color:#B0A8C0;">
                    <a href="https://nexfy.io/terms" style="color:#9CA3AF; text-decoration:underline;">T&eacute;rminos y Condiciones</a>
                    &nbsp;&nbsp;&middot;&nbsp;&nbsp;
                    <a href="https://nexfy.io/privacy" style="color:#9CA3AF; text-decoration:underline;">Pol&iacute;tica de Privacidad</a>
                    &nbsp;&nbsp;&middot;&nbsp;&nbsp;
                    <a href="mailto:hello@nexfy.io" style="color:#9CA3AF; text-decoration:underline;">Contacto</a>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:4px 40px 28px 40px; text-align:center;">
                  <p style="margin:0; font-size:11px; color:#86EFAC;">&copy; ${new Date().getFullYear()} Nexfy LLC</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ── Meeting email builder ──

function meetingScheduledHtml(opts: {
  leadName: string;
  coachName: string;
  dateStr: string;
  timeStr: string;
  gcalUrl: string;
  portalUrl: string;
}) {
  return baseTemplate({
    preheader: `Nexy te va a llamar el ${opts.dateStr} a las ${opts.timeStr} para tu evaluación de perfil.`,
    title: `&#127897;&#65039; Reuni&oacute;n con ${opts.coachName} confirmada`,
    subtitle: `Tu evaluaci&oacute;n con nuestro asesor IA fue agendada para el ${opts.dateStr} a las ${opts.timeStr}.`,
    bodyHtml: `
            <p style="margin:0; font-size:15px; color:#374151; line-height:1.7;">
              Hola ${opts.leadName || ""} &#128075;
            </p>
            <p style="margin:14px 0 0 0; font-size:15px; color:#374151; line-height:1.7;">
              Tu evaluaci&oacute;n con <strong style="color:#16A34A;">${opts.coachName}</strong>, nuestro asesor de IA, fue agendada. Ac&aacute; est&aacute;n los detalles:
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 40px 0 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F0FDF4; border-radius:12px; border:1px solid #DCFCE7;">
              <tr>
                <td style="padding:24px;">
                  <p style="margin:0 0 16px 0; font-size:11px; font-weight:700; color:#16A34A; text-transform:uppercase; letter-spacing:1.4px;">Detalles de la evaluaci&oacute;n</p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding:6px 0; font-size:14px; color:#6B7280; width:100px;">Tipo:</td>
                      <td style="padding:6px 0; font-size:14px; color:#1A1A2E; font-weight:600;">Evaluaci&oacute;n de perfil con ${opts.coachName}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0; font-size:14px; color:#6B7280; width:100px;">Fecha:</td>
                      <td style="padding:6px 0; font-size:14px; color:#1A1A2E; font-weight:600;">${opts.dateStr}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0; font-size:14px; color:#6B7280; width:100px;">Hora:</td>
                      <td style="padding:6px 0; font-size:14px; color:#1A1A2E; font-weight:600;">${opts.timeStr}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0; font-size:14px; color:#6B7280; width:100px;">Con:</td>
                      <td style="padding:6px 0; font-size:14px; color:#1A1A2E; font-weight:600;">${opts.coachName} &middot; Asesor IA</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0; font-size:14px; color:#6B7280; width:100px;">Modalidad:</td>
                      <td style="padding:6px 0; font-size:14px; color:#1A1A2E; font-weight:600;">Llamada por audio (5 a 7 min)</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Cómo funciona la llamada -->
        <tr>
          <td style="padding:18px 40px 0 40px;">
            <p style="margin:0; font-size:13px; color:#6B7280; line-height:1.65;">
              <strong style="color:#1A1A2E;">${opts.coachName}</strong> te va a llamar al tel&eacute;fono que cargaste en el formulario el d&iacute;a y horario que elegiste. La conversaci&oacute;n dura entre 5 y 7 minutos &mdash; es un filtro real para ver si tu perfil encaja con la Certificaci&oacute;n.
            </p>
          </td>
        </tr>

        <!-- Add to GCal secondary link -->
        <tr>
          <td style="padding:14px 40px 8px 40px; text-align:center;">
            <a href="${opts.gcalUrl}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; font-size:13px; color:#16A34A; text-decoration:none; font-weight:600;">
              &#128197; Agregar a Google Calendar
            </a>
          </td>
        </tr>

        <!-- 4 pasos del portal -->
        <tr>
          <td style="padding:24px 40px 0 40px;">
            <p style="margin:0 0 14px 0; font-size:14px; color:#374151; line-height:1.6;">
              <strong style="color:#1A1A2E;">Mientras esper&aacute;s</strong>, conoc&eacute; el portal de la Certificaci&oacute;n. Estos son los 4 pasos que vas a hacer una vez que tu perfil quede aprobado en la llamada con ${opts.coachName}:
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F0FDF4; border-radius:12px; border:1px solid #DCFCE7;">
              <tr>
                <td style="padding:22px 24px;">
                  <p style="margin:0 0 14px 0; font-size:11px; font-weight:700; color:#16A34A; text-transform:uppercase; letter-spacing:1.4px;">Tus 4 pasos en el portal</p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td valign="top" style="padding:6px 0; font-size:14px; color:#16A34A; font-weight:700; width:32px;">1.</td>
                      <td style="padding:6px 0; font-size:14px; color:#1A1A2E; font-weight:500; line-height:1.55;">Activ&aacute; tu cuenta y configur&aacute; tu perfil</td>
                    </tr>
                    <tr>
                      <td valign="top" style="padding:6px 0; font-size:14px; color:#16A34A; font-weight:700; width:32px;">2.</td>
                      <td style="padding:6px 0; font-size:14px; color:#1A1A2E; font-weight:500; line-height:1.55;">Mir&aacute; el m&oacute;dulo de bienvenida (10 min)</td>
                    </tr>
                    <tr>
                      <td valign="top" style="padding:6px 0; font-size:14px; color:#16A34A; font-weight:700; width:32px;">3.</td>
                      <td style="padding:6px 0; font-size:14px; color:#1A1A2E; font-weight:500; line-height:1.55;">Conect&aacute; tus herramientas de venta</td>
                    </tr>
                    <tr>
                      <td valign="top" style="padding:6px 0; font-size:14px; color:#16A34A; font-weight:700; width:32px;">4.</td>
                      <td style="padding:6px 0; font-size:14px; color:#1A1A2E; font-weight:500; line-height:1.55;">Lanz&aacute; tu primera campa&ntilde;a guiada</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>`,
    ctaText: "Entrar al portal &rarr;",
    ctaUrl: opts.portalUrl || "https://portal.nexfy.io",
    secondaryText: '&iquest;Dudas? Respond&eacute; este email o escribinos a <a href="mailto:hello@nexfy.io" style="color:#16A34A; text-decoration:none; font-weight:600;">hello@nexfy.io</a>',
  });
}

// ── Route handler ──

export async function POST(req: NextRequest) {
  try {
    if (!BREVO_API_KEY) {
      console.warn("BREVO_API_KEY not set, skipping confirmation email");
      return NextResponse.json({ ok: false, error: "Email not configured" }, { status: 503 });
    }

    const body = await req.json();
    const { email, name, date, rawDate, time, host, duration, timezone } = body;

    if (!email || !date || !time) {
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    }

    const coachName = host || "Nexy";
    const gcalUrl = rawDate ? buildGoogleCalendarUrl({
      title: `Evaluación con ${coachName} (Nexfy)`,
      rawDate,
      time,
      duration: duration || 7,
      host: coachName,
      timezone: timezone || "America/Argentina/Buenos_Aires",
    }) : "";

    const portalBase = process.env.PORTAL_URL || "https://portal.nexfy.io";
    const portalUrl = `${portalBase}/?ref=${encodeURIComponent(email)}`;

    const subject = `🎙️ Tu evaluación con ${coachName} está agendada · Nexfy`;
    const htmlContent = meetingScheduledHtml({
      leadName: name || "",
      coachName,
      dateStr: date,
      timeStr: `${time}${duration ? ` (${duration} min)` : ""}`,
      gcalUrl,
      portalUrl,
    });

    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email, name: name || email }],
        subject,
        htmlContent,
        tags: ["meeting-scheduled", "funnel-template"],
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("Brevo error:", err);
      return NextResponse.json({ ok: false, error: err.message || "Brevo error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Send confirmation email error:", e);
    return NextResponse.json({ ok: false, error: "Failed to send email" }, { status: 500 });
  }
}

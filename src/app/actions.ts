"use server";

import { createAsproFunnel } from "@/lib/af-client";
import type { TrackStepData } from "@/lib/af-client";
import { tokenHmacForSession, signToken } from "@/lib/auth-token";
import { promises as dns } from "dns";
import crypto from "crypto";

const af = createAsproFunnel({
  apiKey: process.env.AF_API_KEY!,
});

const SUPABASE_URL = "https://lzqzymvzgxdgrhghepyy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6cXp5bXZ6Z3hkZ3JoZ2hlcHl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDA0NDQsImV4cCI6MjA5MjYxNjQ0NH0.6sF__jhX_Xah3M6Xmd9phdrU5-fXzvJoGrtvGkzcQbM";

// ─── Email Validation ────────────────────────────────────

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com","guerrillamail.com","guerrillamail.net","tempmail.com","throwaway.email",
  "temp-mail.org","fakeinbox.com","sharklasers.com","guerrillamailblock.com","grr.la",
  "dispostable.com","yopmail.com","yopmail.fr","cool.fr.nf","jetable.fr.nf","nospam.ze.tc",
  "nomail.xl.cx","mega.zik.dj","speed.1s.fr","courriel.fr.nf","moncourrier.fr.nf",
  "monemail.fr.nf","monmail.fr.nf","tempail.com","tempr.email","10minutemail.com",
  "10minutemail.net","trashmail.com","trashmail.me","trashmail.net","trashmail.org",
  "trashymail.com","trashymail.net","getnada.com","mailnesia.com","maildrop.cc",
  "discard.email","discardmail.com","discardmail.de","emailondeck.com","33mail.com",
  "mailcatch.com","mailscrap.com","mohmal.com","burnermail.io","inboxbear.com",
  "mailsac.com","harakirimail.com","crazymailing.com","tempmailo.com","emlpro.com",
  "temp-mail.io","emailfake.com","generator.email","guerrillamail.info","grr.la",
  "armyspy.com","cuvox.de","dayrep.com","einrot.com","fleckens.hu","gustr.com",
  "jourrapide.com","rhyta.com","superrito.com","teleworm.us",
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function validateEmail(email: string): Promise<{ valid: boolean; reason?: string }> {
  // 1. Format check
  if (!EMAIL_REGEX.test(email)) {
    return { valid: false, reason: "Formato de email inv\u00e1lido" };
  }

  const domain = email.split("@")[1].toLowerCase();

  // 2. Disposable domain check
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { valid: false, reason: "No se permiten emails temporales. Us\u00e1 tu email real." };
  }

  // 3. MX record check (does the domain accept email?)
  try {
    const mx = await dns.resolveMx(domain);
    if (!mx || mx.length === 0) {
      return { valid: false, reason: "Este dominio de email no existe. Revis\u00e1 que est\u00e9 bien escrito." };
    }
  } catch {
    return { valid: false, reason: "Este dominio de email no existe. Revis\u00e1 que est\u00e9 bien escrito." };
  }

  return { valid: true };
}

// ─── Types ───────────────────────────────────────────────

export type FormState = {
  ok: boolean;
  error: string;
  email?: string;
  name?: string;
  phone?: string;
  assignedTo?: string;
  campaignId?: string;
};

// ─── Resolve Slug → User ID ─────────────────────────────

export async function resolveSlugToUserId(
  slug: string
): Promise<{ ok: boolean; userId?: string; error?: string }> {
  if (!slug) return { ok: false, error: "No slug" };

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/user_profiles?slug=eq.${encodeURIComponent(slug)}&select=id&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    const data = await res.json();
    if (data && data.length > 0) {
      return { ok: true, userId: data[0].id };
    }
    return { ok: false, error: "Slug not found" };
  } catch (e) {
    console.error("Resolve slug error:", e);
    return { ok: false, error: "Failed to resolve slug" };
  }
}

// ─── Submit Lead (Step 1) ────────────────────────────────

export async function submitLead(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const countryCode = formData.get("countryCode") as string;
  const countryIso = formData.get("countryIso") as string;
  const utmsRaw = formData.get("utms") as string | null;
  const assignSlug = formData.get("assignSlug") as string | null;
  const timezone = formData.get("timezone") as string | null;

  if (!name || !email) {
    return { ok: false, error: "Nombre y email son requeridos" };
  }

  // Validate email (format + disposable + MX)
  const emailCheck = await validateEmail(email);
  if (!emailCheck.valid) {
    return { ok: false, error: emailCheck.reason || "Email inv\u00e1lido" };
  }

  const fullPhone = phone
    ? `${countryCode}${phone.replace(/^0+/, "")}`
    : undefined;

  // Parse UTMs if present
  const utms = utmsRaw ? JSON.parse(utmsRaw) : null;

  // Si tiene UTMs viene de ads → "paid", si no → "landing"
  const source = utms ? "paid" : "landing";

  // Resolver slug → UUID antes de crear el lead
  let resolvedUserId: string | undefined;
  if (assignSlug) {
    const slugRes = await resolveSlugToUserId(assignSlug);
    if (slugRes.ok && slugRes.userId) {
      resolvedUserId = slugRes.userId;
    }
  }

  try {
    const res = await af.createLead({
      name,
      firstName: name.split(" ")[0],
      lastName: name.split(" ").slice(1).join(" ") || undefined,
      email,
      phone: fullPhone,
      country: countryIso || undefined,
      campaignId: process.env.AF_CAMPAIGN_ID!,
      source,
      metadata: utms || undefined,
      assignToSlug: assignSlug || undefined,
      assignToUserId: resolvedUserId,
    });

    // Save timezone to leads table
    if (timezone) {
      fetch(
        `${SUPABASE_URL}/rest/v1/leads?email=eq.${encodeURIComponent(email)}&campaign_id=eq.${process.env.AF_CAMPAIGN_ID!}&order=created_at.desc&limit=1`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ timezone }),
        }
      ).catch((e) => console.error("Failed to save timezone:", e));
    }

    // Notify n8n if this lead came from WhatsApp/Nexy (utm_source=whatsapp)
    if (utms?.utm_source === "whatsapp" && fullPhone) {
      fetch("https://n8n.srv1267733.hstgr.cloud/webhook/optim-optin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: fullPhone,
          email,
          name,
          country: countryIso,
          clid: utms?.clid || null,
          utm_source: "whatsapp",
        }),
      }).catch((e) => console.error("Failed to notify n8n optim-optin:", e));
    }

    return { ok: true, error: "", email, name, phone: fullPhone, assignedTo: resolvedUserId || res.assignedTo, campaignId: process.env.AF_CAMPAIGN_ID };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("Lead submission error:", errMsg, e);
    return { ok: false, error: `Error: ${errMsg}` };
  }
}

// ─── Track Funnel Step ───────────────────────────────────

export async function trackFunnelStep(
  email: string,
  stage: TrackStepData["stage"]
): Promise<{ ok: boolean; error?: string }> {
  if (!email) return { ok: false, error: "No email" };

  try {
    await af.trackStep({
      email,
      stage,
      campaignId: process.env.AF_CAMPAIGN_ID!,
    });
    return { ok: true };
  } catch (e) {
    console.error(`Track step error (${stage}):`, e);
    return { ok: false, error: "Failed to track step" };
  }
}

// ─── Track Visitor Geo (→ lead_activity) ────────────────

export async function trackVisitorGeo(data: {
  leadId: string;
  userId: string;
  ip: string;
  country: string | null;
  countryName?: string | null;
  region?: string | null;
  city?: string | null;
  step: number;
}): Promise<{ ok: boolean; error?: string }> {
  if (!data.leadId || !data.userId) return { ok: false, error: "No leadId or userId" };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lead_activity`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        lead_id: data.leadId,
        user_id: data.userId,
        action: "funnel_visit",
        metadata: {
          step: data.step,
          ip: data.ip,
          country: data.country,
          country_name: data.countryName || null,
          region: data.region || null,
          city: data.city || null,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Track visitor geo error:", err);
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (e) {
    console.error("Track visitor geo error:", e);
    return { ok: false, error: "Failed to track visitor geo" };
  }
}

// ─── Lookup Lead by Email ────────────────────────────────
// Returns the lead's assigned user_id so we can load their calendar

export async function lookupLead(
  email: string
): Promise<{
  ok: boolean;
  userId?: string;
  leadId?: string;
  name?: string;
  phone?: string;
  country?: string;
  error?: string;
}> {
  if (!email) return { ok: false, error: "No email" };

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/leads?email=eq.${encodeURIComponent(email)}&campaign_id=eq.${process.env.AF_CAMPAIGN_ID!}&select=id,user_id,name,phone,country&order=created_at.desc&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    const data = await res.json();
    if (data && data.length > 0) {
      return {
        ok: true,
        userId: data[0].user_id,
        leadId: data[0].id,
        name: data[0].name || undefined,
        phone: data[0].phone || undefined,
        country: data[0].country || undefined,
      };
    }
    return { ok: false, error: "Lead not found" };
  } catch (e) {
    console.error("Lookup lead error:", e);
    return { ok: false, error: "Failed to lookup lead" };
  }
}

// ─── Get Owner's Booking Link ────────────────────────────
// Fetches the booking link slug for a user so we can load their availability

export async function getOwnerBookingSlug(
  userId: string
): Promise<{ ok: boolean; slug?: string; error?: string }> {
  if (!userId) return { ok: false, error: "No userId" };

  try {
    // Busca el booking link de 15 min del owner (Reunión rápida)
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/booking_links?user_id=eq.${userId}&is_active=eq.true&duration_minutes=eq.15&select=slug&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    const data = await res.json();
    if (data && data.length > 0) {
      return { ok: true, slug: data[0].slug };
    }
    return { ok: false, error: "No booking link found" };
  } catch (e) {
    console.error("Get booking slug error:", e);
    return { ok: false, error: "Failed to get booking link" };
  }
}

// ─── Track Video Event (→ lead_activity) ────────────────

const VIDEO_ACTION_MAP: Record<string, string> = {
  started: "funnel_video_start",
  milestone: "funnel_video_milestone",
  completed: "funnel_video_complete",
  paused: "funnel_video_paused",
  resumed: "funnel_video_resumed",
  abandoned: "funnel_video_abandoned",
};

export async function trackVideoEvent(data: {
  email: string;
  userId: string;
  event: string;
  currentTime: number;
  duration: number;
  percentWatched: number;
  totalWatchTime: number;
  milestone?: number;
  videoName?: string;
  step?: number;
}): Promise<{ ok: boolean; error?: string }> {
  if (!data.email || !data.userId) return { ok: false, error: "No email or userId" };

  try {
    // Look up lead_id from email
    const leadRes = await fetch(
      `${SUPABASE_URL}/rest/v1/leads?email=eq.${encodeURIComponent(data.email)}&campaign_id=eq.${process.env.AF_CAMPAIGN_ID!}&select=id,user_id&order=created_at.desc&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    const leads = await leadRes.json();
    if (!leads || leads.length === 0) return { ok: false, error: "Lead not found" };

    const leadId = leads[0].id;
    const userId = leads[0].user_id || data.userId;
    const action = VIDEO_ACTION_MAP[data.event] || `funnel_video_${data.event}`;

    const metadata: Record<string, unknown> = {
      step: data.step ?? 2,
      video: data.videoName || "VSL",
      percent: data.percentWatched,
      seconds_watched: data.totalWatchTime,
      current_time: data.currentTime,
      video_duration: data.duration,
    };
    if (data.milestone) metadata.milestone = data.milestone;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/lead_activity`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        lead_id: leadId,
        user_id: userId,
        action,
        metadata,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Track video event error:", err);
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (e) {
    console.error("Track video event error:", e);
    return { ok: false, error: "Failed to track video event" };
  }
}

// ─── Get Available Slots ─────────────────────────────────

export async function getAvailableSlots(
  slug: string,
  date: string,
  timezone: string = "America/Argentina/Buenos_Aires"
): Promise<{
  ok: boolean;
  slots?: string[];
  host?: string;
  bookingLink?: {
    title: string;
    description: string;
    duration_minutes: number;
    accent_color: string;
    welcome_message: string;
    timezone: string;
  };
  error?: string;
}> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/booking-availability?slug=${slug}&date=${date}&timezone=${encodeURIComponent(timezone)}`,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };
    return { ok: true, ...data };
  } catch (e) {
    console.error("Get slots error:", e);
    return { ok: false, error: "Failed to get slots" };
  }
}

// ─── Request Call Link (creates session + sends Brevo email) ────

const CALL_NEXFY_URL = process.env.CALL_NEXFY_URL || "https://call.nexfy.io";
const N8N_CALL_LINK_SENT_URL = process.env.N8N_CALL_LINK_SENT_URL || "";

interface RequestCallLinkInput {
  email: string;
  phone: string;
  name: string;
  country?: string;
}

export async function requestCallLink(
  data: RequestCallLinkInput
): Promise<{ ok: boolean; error?: string }> {
  const email = data.email.trim().toLowerCase();
  const phone = data.phone.trim();
  const name = data.name.trim();

  if (!email || !phone || !name) {
    return { ok: false, error: "Faltan datos requeridos" };
  }

  // 1. Re-validate email (format + disposable + MX)
  const emailCheck = await validateEmail(email);
  if (!emailCheck.valid) {
    return { ok: false, error: emailCheck.reason || "Email inválido" };
  }

  // 2. Lookup lead (for lead_id linkage)
  const lead = await lookupLead(email);

  // 3. Create call_session row in Supabase
  const sessionId = crypto.randomUUID();
  const tokenHmac = tokenHmacForSession(sessionId);
  if (!tokenHmac) {
    console.error("[requestCallLink] CALL_AUTH_SECRET missing");
    return { ok: false, error: "Servidor no configurado" };
  }

  try {
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/call_sessions`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        id: sessionId,
        lead_id: lead.ok ? lead.leadId : null,
        email,
        phone,
        name,
        country: data.country || (lead.ok ? lead.country : null) || null,
        token_hmac: tokenHmac,
        status: "link_sent",
        link_sent_at: new Date().toISOString(),
        campaign_id: process.env.AF_CAMPAIGN_ID || null,
        source: "optim_funnel_step2",
        metadata: {
          requested_at: new Date().toISOString(),
        },
      }),
    });

    if (!insertRes.ok) {
      const err = await insertRes.text();
      console.error("[requestCallLink] insert failed:", err);
      return { ok: false, error: "No se pudo crear la sesión" };
    }
  } catch (e) {
    console.error("[requestCallLink] insert error:", e);
    return { ok: false, error: "Error al crear la sesión" };
  }

  const token = signToken(sessionId);
  const callUrl = `${CALL_NEXFY_URL}/?t=${encodeURIComponent(token)}`;

  // 4. Send Brevo email (fire-and-forget non-critical, but await main path)
  const sendRes = await sendCallLinkEmail({ email, name, callUrl });
  if (!sendRes.ok) {
    console.error("[requestCallLink] Brevo send failed:", sendRes.error);
    // Don't block — link still works if email fails (user can be re-emailed)
  }

  // 5. Log session event
  fetch(`${SUPABASE_URL}/rest/v1/call_session_events`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      session_id: sessionId,
      event_type: "link_sent",
      metadata: { email_sent: sendRes.ok, error: sendRes.error || null },
    }),
  }).catch(() => {});

  // 6. Cross-link to lead_activity
  if (lead.ok && lead.leadId && lead.userId) {
    fetch(`${SUPABASE_URL}/rest/v1/lead_activity`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        lead_id: lead.leadId,
        user_id: lead.userId,
        action: "call_link_requested",
        metadata: {
          call_session_id: sessionId,
          email_sent: sendRes.ok,
        },
      }),
    }).catch(() => {});
  }

  // 7. Notify n8n for follow-up sequence
  if (N8N_CALL_LINK_SENT_URL) {
    fetch(N8N_CALL_LINK_SENT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        email,
        phone,
        name,
        country: data.country,
        call_url: callUrl,
        lead_id: lead.ok ? lead.leadId : null,
      }),
    }).catch(() => {});
  }

  return { ok: true };
}

// ─── Nexy Booking (Step 3 → nexy_bookings) ──────────────

const N8N_NEXY_BOOKING_URL = process.env.N8N_NEXY_BOOKING_URL || "";

interface ConfirmNexyBookingInput {
  email: string;
  name: string;
  phone?: string;
  country?: string;
  scheduledAt: string;            // ISO UTC
  timezone: string;               // IANA
  durationMin?: number;
  answers?: Record<string, string>;
  notes?: string;
  campaignId?: string;
}

export async function confirmNexyBooking(
  data: ConfirmNexyBookingInput
): Promise<{ ok: boolean; bookingId?: string; error?: string }> {
  const email = data.email.trim().toLowerCase();
  if (!email || !data.scheduledAt || !data.timezone) {
    return { ok: false, error: "Faltan datos requeridos" };
  }

  // Sanity: must be in the future
  if (new Date(data.scheduledAt).getTime() <= Date.now()) {
    return { ok: false, error: "El horario elegido ya pasó" };
  }

  const lead = await lookupLead(email);
  const bookingId = crypto.randomUUID();

  try {
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/nexy_bookings`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        id: bookingId,
        lead_id: lead.ok ? lead.leadId : null,
        email,
        phone: data.phone || (lead.ok ? lead.phone : null) || null,
        name: data.name || (lead.ok ? lead.name : null) || null,
        country: data.country || (lead.ok ? lead.country : null) || null,
        scheduled_at: data.scheduledAt,
        timezone: data.timezone,
        duration_min: data.durationMin || 7,
        status: "pending",
        answers: data.answers || {},
        notes: data.notes || null,
        campaign_id: data.campaignId || process.env.AF_CAMPAIGN_ID || null,
        source: "optim_funnel_step3",
        metadata: {
          created_via: "step3_form",
          user_agent_tz: data.timezone,
        },
      }),
    });

    if (!insertRes.ok) {
      const err = await insertRes.text();
      console.error("[confirmNexyBooking] insert failed:", err);
      return { ok: false, error: "No se pudo guardar la reserva" };
    }
  } catch (e) {
    console.error("[confirmNexyBooking] insert error:", e);
    return { ok: false, error: "Error al guardar la reserva" };
  }

  // Cross-link to lead_activity (fire-and-forget)
  if (lead.ok && lead.leadId && lead.userId) {
    fetch(`${SUPABASE_URL}/rest/v1/lead_activity`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        lead_id: lead.leadId,
        user_id: lead.userId,
        action: "nexy_booking_created",
        metadata: {
          nexy_booking_id: bookingId,
          scheduled_at: data.scheduledAt,
          timezone: data.timezone,
        },
      }),
    }).catch(() => {});
  }

  // Notify n8n for batch-call orchestration
  if (N8N_NEXY_BOOKING_URL) {
    fetch(N8N_NEXY_BOOKING_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        booking_id: bookingId,
        lead_id: lead.ok ? lead.leadId : null,
        email,
        phone: data.phone || (lead.ok ? lead.phone : null),
        name: data.name || (lead.ok ? lead.name : null),
        country: data.country || (lead.ok ? lead.country : null),
        scheduled_at: data.scheduledAt,
        timezone: data.timezone,
        duration_min: data.durationMin || 7,
        answers: data.answers || {},
      }),
    }).catch(() => {});
  }

  return { ok: true, bookingId };
}

// ─── Brevo: send call-link email ────────────────────────

async function sendCallLinkEmail(opts: {
  email: string;
  name: string;
  callUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return { ok: false, error: "BREVO_API_KEY missing" };

  const senderName = process.env.BREVO_SENDER_NAME || "Nexfy";
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "hello@nexfy.io";
  const firstName = opts.name.split(/\s+/)[0] || "";

  const html = callLinkEmailHtml({ firstName, callUrl: opts.callUrl });

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: opts.email, name: opts.name || opts.email }],
      subject: "🎙️ Tu link privado para hablar con Nexy",
      htmlContent: html,
      tags: ["call-link", "optim"],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.message || `Brevo ${res.status}` };
  }
  return { ok: true };
}

function callLinkEmailHtml(opts: { firstName: string; callUrl: string }) {
  const greeting = opts.firstName ? `Hola ${opts.firstName}` : "Hola";
  const banner =
    "https://lzqzymvzgxdgrhghepyy.supabase.co/storage/v1/object/public/recursos/mail%20.png";
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Tu link para hablar con Nexy</title></head>
<body style="margin:0; padding:0; background:#0B0D10; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">
<div style="display:none; max-height:0; overflow:hidden; font-size:1px; color:#0B0D10;">Tu link privado para una conversación 1:1 con Nexy.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0B0D10;">
  <tr><td align="center" style="padding:32px 10px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background:#12161C; border-radius:16px; overflow:hidden; border:1px solid rgba(74,222,128,0.18); box-shadow:0 20px 60px rgba(0,0,0,0.45);">
      <tr><td style="padding:0; line-height:0;"><img src="${banner}" alt="Nexfy" width="600" style="display:block; width:100%; height:auto; border:0;"></td></tr>
      <tr><td style="height:3px; background:linear-gradient(90deg, #4ADE80, #86EFAC, #4ADE80); font-size:0; line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:32px 40px 0 40px;">
        <span style="display:inline-block; padding:6px 12px; border-radius:6px; background:rgba(74,222,128,0.08); border:1px solid rgba(74,222,128,0.3); font-size:11px; font-weight:700; letter-spacing:1.4px; text-transform:uppercase; color:#4ADE80;">🔒 Acceso privado</span>
      </td></tr>
      <tr><td style="padding:18px 40px 8px 40px;">
        <h1 style="margin:0; font-size:28px; font-weight:700; color:#FFFFFF; letter-spacing:-0.5px; line-height:1.2;">${greeting}, ya podés hablar con <span style="color:#4ADE80;">Nexy</span></h1>
      </td></tr>
      <tr><td style="padding:8px 40px 24px 40px;">
        <p style="margin:0; font-size:15px; color:rgba(255,255,255,0.72); line-height:1.6;">Te abrimos una sala privada para que tengas una conversación corta — entre <strong style="color:#fff;">5 y 10 minutos</strong> — con Nexy, nuestro asesor de ventas con IA. Va a evaluar tu contexto y orientarte sobre los próximos pasos.</p>
      </td></tr>
      <tr><td style="padding:0 40px 8px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(74,222,128,0.04); border-radius:12px; border:1px solid rgba(74,222,128,0.18);">
          <tr><td style="padding:22px 24px;">
            <p style="margin:0 0 10px 0; font-size:11px; font-weight:700; color:#4ADE80; text-transform:uppercase; letter-spacing:1.4px;">Antes de comenzar</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td valign="top" style="padding:6px 0; font-size:14px; color:#4ADE80; font-weight:700; width:24px;">→</td><td style="padding:6px 0; font-size:14px; color:rgba(255,255,255,0.85); line-height:1.55;">Buscá un lugar tranquilo</td></tr>
              <tr><td valign="top" style="padding:6px 0; font-size:14px; color:#4ADE80; font-weight:700; width:24px;">→</td><td style="padding:6px 0; font-size:14px; color:rgba(255,255,255,0.85); line-height:1.55;">Asegurate de tener auriculares o buen micrófono</td></tr>
              <tr><td valign="top" style="padding:6px 0; font-size:14px; color:#4ADE80; font-weight:700; width:24px;">→</td><td style="padding:6px 0; font-size:14px; color:rgba(255,255,255,0.85); line-height:1.55;">Hablá natural — Nexy responde como una persona</td></tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:24px 40px 8px 40px; text-align:center;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
          <tr><td style="border-radius:12px; background:#4ADE80;">
            <a href="${opts.callUrl}" target="_blank" style="display:inline-block; padding:18px 56px; font-size:14px; font-weight:700; color:#0B0D10; text-decoration:none; letter-spacing:1px; text-transform:uppercase;">🎙️ Hablar con Nexy</a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:8px 40px 24px 40px; text-align:center;">
        <p style="margin:0; font-size:12px; color:rgba(255,255,255,0.4); line-height:1.6;">El link es personal — vinculado a este email.<br>Vence en 14 días, pero podés volver a usarlo cuando quieras dentro de ese plazo.</p>
      </td></tr>
      <tr><td style="padding:0 40px;"><div style="height:1px; background:rgba(255,255,255,0.06);">&nbsp;</div></td></tr>
      <tr><td style="padding:20px 40px 28px 40px; text-align:center;">
        <p style="margin:0 0 6px 0; font-size:12px; color:rgba(255,255,255,0.45); font-weight:600;">Nexfy &mdash; Sistemas de Ventas con IA</p>
        <p style="margin:0; font-size:11px; color:rgba(255,255,255,0.25); line-height:1.6;">¿No solicitaste este link? Ignorá este email.<br>&copy; ${new Date().getFullYear()} Nexfy</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

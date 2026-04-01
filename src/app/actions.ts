"use server";

import { createAsproFunnel } from "@asprofunnel/sdk";
import type { TrackStepData } from "@asprofunnel/sdk";
import { promises as dns } from "dns";

const af = createAsproFunnel({
  apiKey: process.env.AF_API_KEY!,
});

const SUPABASE_URL = "https://pcmuwwfivmstqnoiyqur.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjbXV3d2Zpdm1zdHFub2l5cXVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NzA1MTMsImV4cCI6MjA4NzA0NjUxM30.MQ3aBluqw3nBz8FcAL9lc564JGsgEkm-E_FGuqfEoZE";

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
): Promise<{ ok: boolean; userId?: string; leadId?: string; error?: string }> {
  if (!email) return { ok: false, error: "No email" };

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/leads?email=eq.${encodeURIComponent(email)}&campaign_id=eq.${process.env.AF_CAMPAIGN_ID!}&select=id,user_id&order=created_at.desc&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    const data = await res.json();
    if (data && data.length > 0) {
      return { ok: true, userId: data[0].user_id, leadId: data[0].id };
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

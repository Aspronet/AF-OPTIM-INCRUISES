"use server";

import { createAsproFunnel } from "@asprofunnel/sdk";
import type { TrackStepData } from "@asprofunnel/sdk";

const af = createAsproFunnel({
  apiKey: process.env.AF_API_KEY!,
});

const SUPABASE_URL = "https://pcmuwwfivmstqnoiyqur.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjbXV3d2Zpdm1zdHFub2l5cXVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NzA1MTMsImV4cCI6MjA4NzA0NjUxM30.MQ3aBluqw3nBz8FcAL9lc564JGsgEkm-E_FGuqfEoZE";

// ─── Types ───────────────────────────────────────────────

export type FormState = {
  ok: boolean;
  error: string;
  email?: string;
  name?: string;
  phone?: string;
  assignedTo?: string;
};

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

  if (!name || !email) {
    return { ok: false, error: "Nombre y email son requeridos" };
  }

  const fullPhone = phone
    ? `${countryCode}${phone.replace(/^0+/, "")}`
    : undefined;

  // Parse UTMs if present
  const utms = utmsRaw ? JSON.parse(utmsRaw) : null;

  // Si tiene UTMs viene de ads → "paid", si no → "landing"
  const source = utms ? "paid" : "landing";

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
    });

    return { ok: true, error: "", email, name, phone: fullPhone, assignedTo: res.assignedTo };
  } catch (e) {
    console.error("Lead submission error:", e);
    return { ok: false, error: "Error al enviar. Intenta de nuevo." };
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

// ─── Lookup Lead by Email ────────────────────────────────
// Returns the lead's assigned user_id so we can load their calendar

export async function lookupLead(
  email: string
): Promise<{ ok: boolean; userId?: string; error?: string }> {
  if (!email) return { ok: false, error: "No email" };

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/leads?email=eq.${encodeURIComponent(email)}&campaign_id=eq.${process.env.AF_CAMPAIGN_ID!}&select=user_id&order=created_at.desc&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    const data = await res.json();
    if (data && data.length > 0) {
      return { ok: true, userId: data[0].user_id };
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

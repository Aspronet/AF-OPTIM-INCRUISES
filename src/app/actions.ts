"use server";

import { createAsproFunnel } from "@asprofunnel/sdk";
import type { TrackStepData } from "@asprofunnel/sdk";

const af = createAsproFunnel({
  apiKey: process.env.AF_API_KEY!,
});

export type FormState = {
  ok: boolean;
  error: string;
  email?: string;
};

export async function submitLead(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const countryCode = formData.get("countryCode") as string;
  const countryIso = formData.get("countryIso") as string;

  if (!name || !email) {
    return { ok: false, error: "Nombre y email son requeridos" };
  }

  // Combine country code + phone number
  const fullPhone = phone ? `${countryCode}${phone.replace(/^0+/, "")}` : undefined;

  try {
    await af.createLead({
      name,
      firstName: name.split(" ")[0],
      lastName: name.split(" ").slice(1).join(" ") || undefined,
      email,
      phone: fullPhone,
      country: countryIso || undefined,
      campaignId: process.env.AF_CAMPAIGN_ID!,
      source: "landing",
    });

    return { ok: true, error: "", email };
  } catch (e) {
    console.error("Lead submission error:", e);
    return { ok: false, error: "Error al enviar. Intenta de nuevo." };
  }
}

/**
 * Actualiza el stage del lead en el funnel.
 * Llamar desde cada step cuando el lead avanza.
 */
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

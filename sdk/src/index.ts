const DEFAULT_BASE_URL = "https://pcmuwwfivmstqnoiyqur.supabase.co/functions/v1";
const DEFAULT_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjbXV3d2Zpdm1zdHFub2l5cXVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NzA1MTMsImV4cCI6MjA4NzA0NjUxM30.MQ3aBluqw3nBz8FcAL9lc564JGsgEkm-E_FGuqfEoZE";

export interface AsproFunnelConfig {
  /** API key de la agencia (af_live_xxx) */
  apiKey: string;
  /** URL base de la API (opcional, solo para desarrollo) */
  baseUrl?: string;
  /** Supabase anon key (opcional, usa el default) */
  anonKey?: string;
}

export interface LeadData {
  /** ID de la campaña — determina la pool de usuarios */
  campaignId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  country?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface LeadResponse {
  ok: boolean;
  lead: {
    id: string;
    name: string;
    email: string | null;
    created_at: string;
  };
  assignedTo: string;
}

export interface TrackStepData {
  /** Email del lead (identificador) */
  email: string;
  /** Stage del funnel al que mover el lead */
  stage:
    | "opt_in_lead"
    | "48hr_qual_conf"
    | "24hr_qual_conf"
    | "day_qual_conf"
    | "qualification_call"
    | "rebook_qual_call"
    | "qual_call_followup"
    | "48hr_sales_conf"
    | "24hr_sales_conf"
    | "day_sales_call"
    | "sales_call"
    | "rebook_sales_call"
    | "follow_up"
    | "client_activated"
    | "archived";
  /** ID de campaña (opcional, para filtrar si el email tiene leads en varias campañas) */
  campaignId?: string;
}

export interface TrackStepResponse {
  ok: boolean;
  lead_id: string;
  previous_stage: string;
  new_stage: string;
}

export interface AsproFunnelError {
  error: string;
}

export class AsproFunnel {
  private apiKey: string;
  private baseUrl: string;
  private anonKey: string;

  constructor(config: AsproFunnelConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.anonKey = config.anonKey || DEFAULT_ANON_KEY;
  }

  async createLead(data: LeadData): Promise<LeadResponse> {
    const res = await fetch(`${this.baseUrl}/lead-optin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.anonKey}`,
        "x-af-key": this.apiKey,
      },
      body: JSON.stringify({
        name: data.name,
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone: data.phone,
        country: data.country,
        campaign_id: data.campaignId,
        source: data.source || "landing",
        metadata: data.metadata,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error((json as AsproFunnelError).error || "Failed to create lead");
    }

    return json as LeadResponse;
  }

  /**
   * Actualiza el stage de un lead en el funnel usando su email.
   * Llamar desde la landing/VSL/4pasos cuando el lead avanza de paso.
   *
   * @example
   * // Lead ve el VSL
   * await af.trackStep({ email: "juan@email.com", stage: "48hr_qual_conf" });
   *
   * // Lead agenda llamada de calificación
   * await af.trackStep({ email: "juan@email.com", stage: "qualification_call" });
   *
   * // Lead completa los 4 pasos
   * await af.trackStep({ email: "juan@email.com", stage: "48hr_sales_conf" });
   */
  async trackStep(data: TrackStepData): Promise<TrackStepResponse> {
    const res = await fetch(`${this.baseUrl}/lead-track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.anonKey}`,
        "x-af-key": this.apiKey,
      },
      body: JSON.stringify({
        email: data.email,
        stage: data.stage,
        campaign_id: data.campaignId,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error((json as AsproFunnelError).error || "Failed to track step");
    }

    return json as TrackStepResponse;
  }
}

export function createAsproFunnel(config: AsproFunnelConfig): AsproFunnel {
  return new AsproFunnel(config);
}

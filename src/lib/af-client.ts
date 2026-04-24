const DEFAULT_BASE_URL = "https://lzqzymvzgxdgrhghepyy.supabase.co/functions/v1";
const DEFAULT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6cXp5bXZ6Z3hkZ3JoZ2hlcHl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDA0NDQsImV4cCI6MjA5MjYxNjQ0NH0.6sF__jhX_Xah3M6Xmd9phdrU5-fXzvJoGrtvGkzcQbM";

export interface AsproFunnelConfig {
  apiKey: string;
  baseUrl?: string;
  anonKey?: string;
}

export interface LeadData {
  campaignId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  country?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  assignToSlug?: string;
  assignToUserId?: string;
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

export type FunnelStage =
  | "nuevo_prospecto"
  | "confirmar_cita"
  | "llamada_filtro"
  | "confirmar_cierre"
  | "llamada_cierre"
  | "en_seguimiento"
  | "socio_activado"
  | "en_pausa";

export interface TrackStepData {
  email: string;
  stage: FunnelStage;
  campaignId?: string;
}

export interface TrackStepResponse {
  ok: boolean;
  lead_id: string;
  previous_stage: string;
  new_stage: string;
}

interface ErrorBody {
  error?: string;
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

  private headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.anonKey}`,
      "x-af-key": this.apiKey,
    };
  }

  async createLead(data: LeadData): Promise<LeadResponse> {
    const res = await fetch(`${this.baseUrl}/lead-optin`, {
      method: "POST",
      headers: this.headers(),
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
        assign_to_slug: data.assignToSlug || undefined,
        assign_to_user_id: data.assignToUserId || undefined,
      }),
    });

    const json = (await res.json()) as LeadResponse | ErrorBody;

    if (!res.ok) {
      throw new Error((json as ErrorBody).error || "Failed to create lead");
    }

    return json as LeadResponse;
  }

  async trackStep(data: TrackStepData): Promise<TrackStepResponse> {
    const res = await fetch(`${this.baseUrl}/lead-track`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        email: data.email,
        stage: data.stage,
        campaign_id: data.campaignId,
      }),
    });

    const json = (await res.json()) as TrackStepResponse | ErrorBody;

    if (!res.ok) {
      throw new Error((json as ErrorBody).error || "Failed to track step");
    }

    return json as TrackStepResponse;
  }
}

export function createAsproFunnel(config: AsproFunnelConfig): AsproFunnel {
  return new AsproFunnel(config);
}

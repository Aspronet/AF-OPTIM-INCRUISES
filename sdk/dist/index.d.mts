interface AsproFunnelConfig {
    /** API key de la agencia (af_live_xxx) */
    apiKey: string;
    /** URL base de la API (opcional, solo para desarrollo) */
    baseUrl?: string;
    /** Supabase anon key (opcional, usa el default) */
    anonKey?: string;
}
interface LeadData {
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
interface LeadResponse {
    ok: boolean;
    lead: {
        id: string;
        name: string;
        email: string | null;
        created_at: string;
    };
    assignedTo: string;
}
interface TrackStepData {
    /** Email del lead (identificador) */
    email: string;
    /** Stage del funnel al que mover el lead */
    stage: "nuevo_prospecto" | "confirmar_cita" | "llamada_filtro" | "confirmar_cierre" | "llamada_cierre" | "en_seguimiento" | "socio_activado" | "en_pausa";
    /** ID de campaña (opcional, para filtrar si el email tiene leads en varias campañas) */
    campaignId?: string;
}
interface TrackStepResponse {
    ok: boolean;
    lead_id: string;
    previous_stage: string;
    new_stage: string;
}
interface AsproFunnelError {
    error: string;
}
declare class AsproFunnel {
    private apiKey;
    private baseUrl;
    private anonKey;
    constructor(config: AsproFunnelConfig);
    createLead(data: LeadData): Promise<LeadResponse>;
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
    trackStep(data: TrackStepData): Promise<TrackStepResponse>;
}
declare function createAsproFunnel(config: AsproFunnelConfig): AsproFunnel;

export { AsproFunnel, type AsproFunnelConfig, type AsproFunnelError, type LeadData, type LeadResponse, type TrackStepData, type TrackStepResponse, createAsproFunnel };

// src/index.ts
var DEFAULT_BASE_URL = "https://pcmuwwfivmstqnoiyqur.supabase.co/functions/v1";
var DEFAULT_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjbXV3d2Zpdm1zdHFub2l5cXVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NzA1MTMsImV4cCI6MjA4NzA0NjUxM30.MQ3aBluqw3nBz8FcAL9lc564JGsgEkm-E_FGuqfEoZE";
var AsproFunnel = class {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.anonKey = config.anonKey || DEFAULT_ANON_KEY;
  }
  async createLead(data) {
    const res = await fetch(`${this.baseUrl}/lead-optin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.anonKey}`,
        "x-af-key": this.apiKey
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
        metadata: data.metadata
      })
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "Failed to create lead");
    }
    return json;
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
  async trackStep(data) {
    const res = await fetch(`${this.baseUrl}/lead-track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.anonKey}`,
        "x-af-key": this.apiKey
      },
      body: JSON.stringify({
        email: data.email,
        stage: data.stage,
        campaign_id: data.campaignId
      })
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "Failed to track step");
    }
    return json;
  }
};
function createAsproFunnel(config) {
  return new AsproFunnel(config);
}
export {
  AsproFunnel,
  createAsproFunnel
};

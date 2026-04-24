"use client";

import { Suspense, useActionState, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { submitLead, type FormState } from "@/app/actions";
import { AsYouType, type CountryCode } from "libphonenumber-js";

const COUNTRIES = [
  // Latinoamérica
  { code: "+54", iso: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "+591", iso: "BO", name: "Bolivia", flag: "🇧🇴" },
  { code: "+55", iso: "BR", name: "Brasil", flag: "🇧🇷" },
  { code: "+56", iso: "CL", name: "Chile", flag: "🇨🇱" },
  { code: "+57", iso: "CO", name: "Colombia", flag: "🇨🇴" },
  { code: "+506", iso: "CR", name: "Costa Rica", flag: "🇨🇷" },
  { code: "+53", iso: "CU", name: "Cuba", flag: "🇨🇺" },
  { code: "+593", iso: "EC", name: "Ecuador", flag: "🇪🇨" },
  { code: "+503", iso: "SV", name: "El Salvador", flag: "🇸🇻" },
  { code: "+502", iso: "GT", name: "Guatemala", flag: "🇬🇹" },
  { code: "+509", iso: "HT", name: "Haití", flag: "🇭🇹" },
  { code: "+504", iso: "HN", name: "Honduras", flag: "🇭🇳" },
  { code: "+52", iso: "MX", name: "México", flag: "🇲🇽" },
  { code: "+505", iso: "NI", name: "Nicaragua", flag: "🇳🇮" },
  { code: "+507", iso: "PA", name: "Panamá", flag: "🇵🇦" },
  { code: "+595", iso: "PY", name: "Paraguay", flag: "🇵🇾" },
  { code: "+51", iso: "PE", name: "Perú", flag: "🇵🇪" },
  { code: "+1", iso: "PR", name: "Puerto Rico", flag: "🇵🇷" },
  { code: "+1", iso: "DO", name: "Rep. Dominicana", flag: "🇩🇴" },
  { code: "+598", iso: "UY", name: "Uruguay", flag: "🇺🇾" },
  { code: "+58", iso: "VE", name: "Venezuela", flag: "🇻🇪" },
  // Norteamérica
  { code: "+1", iso: "US", name: "Estados Unidos", flag: "🇺🇸" },
  { code: "+1", iso: "CA", name: "Canadá", flag: "🇨🇦" },
  // Europa
  { code: "+49", iso: "DE", name: "Alemania", flag: "🇩🇪" },
  { code: "+43", iso: "AT", name: "Austria", flag: "🇦🇹" },
  { code: "+32", iso: "BE", name: "Bélgica", flag: "🇧🇪" },
  { code: "+359", iso: "BG", name: "Bulgaria", flag: "🇧🇬" },
  { code: "+385", iso: "HR", name: "Croacia", flag: "🇭🇷" },
  { code: "+45", iso: "DK", name: "Dinamarca", flag: "🇩🇰" },
  { code: "+421", iso: "SK", name: "Eslovaquia", flag: "🇸🇰" },
  { code: "+386", iso: "SI", name: "Eslovenia", flag: "🇸🇮" },
  { code: "+34", iso: "ES", name: "España", flag: "🇪🇸" },
  { code: "+358", iso: "FI", name: "Finlandia", flag: "🇫🇮" },
  { code: "+33", iso: "FR", name: "Francia", flag: "🇫🇷" },
  { code: "+30", iso: "GR", name: "Grecia", flag: "🇬🇷" },
  { code: "+36", iso: "HU", name: "Hungría", flag: "🇭🇺" },
  { code: "+353", iso: "IE", name: "Irlanda", flag: "🇮🇪" },
  { code: "+39", iso: "IT", name: "Italia", flag: "🇮🇹" },
  { code: "+47", iso: "NO", name: "Noruega", flag: "🇳🇴" },
  { code: "+31", iso: "NL", name: "Países Bajos", flag: "🇳🇱" },
  { code: "+48", iso: "PL", name: "Polonia", flag: "🇵🇱" },
  { code: "+351", iso: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "+44", iso: "GB", name: "Reino Unido", flag: "🇬🇧" },
  { code: "+420", iso: "CZ", name: "Rep. Checa", flag: "🇨🇿" },
  { code: "+40", iso: "RO", name: "Rumanía", flag: "🇷🇴" },
  { code: "+7", iso: "RU", name: "Rusia", flag: "🇷🇺" },
  { code: "+46", iso: "SE", name: "Suecia", flag: "🇸🇪" },
  { code: "+41", iso: "CH", name: "Suiza", flag: "🇨🇭" },
  { code: "+380", iso: "UA", name: "Ucrania", flag: "🇺🇦" },
  // Asia
  { code: "+86", iso: "CN", name: "China", flag: "🇨🇳" },
  { code: "+82", iso: "KR", name: "Corea del Sur", flag: "🇰🇷" },
  { code: "+971", iso: "AE", name: "Emiratos Árabes", flag: "🇦🇪" },
  { code: "+63", iso: "PH", name: "Filipinas", flag: "🇵🇭" },
  { code: "+91", iso: "IN", name: "India", flag: "🇮🇳" },
  { code: "+62", iso: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "+972", iso: "IL", name: "Israel", flag: "🇮🇱" },
  { code: "+81", iso: "JP", name: "Japón", flag: "🇯🇵" },
  { code: "+60", iso: "MY", name: "Malasia", flag: "🇲🇾" },
  { code: "+966", iso: "SA", name: "Arabia Saudita", flag: "🇸🇦" },
  { code: "+65", iso: "SG", name: "Singapur", flag: "🇸🇬" },
  { code: "+66", iso: "TH", name: "Tailandia", flag: "🇹🇭" },
  { code: "+90", iso: "TR", name: "Turquía", flag: "🇹🇷" },
  { code: "+84", iso: "VN", name: "Vietnam", flag: "🇻🇳" },
  // África
  { code: "+27", iso: "ZA", name: "Sudáfrica", flag: "🇿🇦" },
  { code: "+234", iso: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "+20", iso: "EG", name: "Egipto", flag: "🇪🇬" },
  { code: "+212", iso: "MA", name: "Marruecos", flag: "🇲🇦" },
  { code: "+254", iso: "KE", name: "Kenia", flag: "🇰🇪" },
  // Oceanía
  { code: "+61", iso: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "+64", iso: "NZ", name: "Nueva Zelanda", flag: "🇳🇿" },
];

const initial: FormState = { ok: false, error: "" };

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export default function Step1Page() {
  return (
    <Suspense>
      <Step1 />
    </Suspense>
  );
}

function Step1() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, action, pending] = useActionState(submitLead, initial);
  const [selected, setSelected] = useState(COUNTRIES[0]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const phoneRef = useRef<HTMLInputElement>(null);

  const formatPhone = (digits: string, iso: string) => {
    if (!digits) return "";
    const formatter = new AsYouType(iso as CountryCode);
    return formatter.input(digits);
  };

  const phone = formatPhone(phoneDigits, selected.iso);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/[^\d]/g, "");
    setPhoneDigits(digits);
  };

  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && phoneDigits.length > 0) {
      e.preventDefault();
      setPhoneDigits(phoneDigits.slice(0, -1));
    }
  };
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Capture UTM params from URL
  const utms: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const val = searchParams.get(key);
    if (val) utms[key] = val;
  }
  const hasUtms = Object.keys(utms).length > 0;

  // Direct assignment slug (?u=ywbty4ew)
  const assignSlug = searchParams.get("u") || "";

  // Track funnel view for this user's slug
  useEffect(() => {
    if (assignSlug) {
      fetch("https://lzqzymvzgxdgrhghepyy.supabase.co/rest/v1/rpc/increment_funnel_views", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6cXp5bXZ6Z3hkZ3JoZ2hlcHl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDA0NDQsImV4cCI6MjA5MjYxNjQ0NH0.6sF__jhX_Xah3M6Xmd9phdrU5-fXzvJoGrtvGkzcQbM",
          Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6cXp5bXZ6Z3hkZ3JoZ2hlcHl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDA0NDQsImV4cCI6MjA5MjYxNjQ0NH0.6sF__jhX_Xah3M6Xmd9phdrU5-fXzvJoGrtvGkzcQbM",
        },
        body: JSON.stringify({ p_user_slug: assignSlug, p_type: "lead_capture" }),
      }).catch(() => {});
    }
  }, [assignSlug]);

  useEffect(() => {
    fetch("https://ipapi.co/json/")
      .then((r) => r.json())
      .then((data) => {
        if (data?.country_code) {
          const match = COUNTRIES.find(
            (c) => c.iso === data.country_code.toUpperCase()
          );
          if (match) setSelected(match);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (state.ok) {
      if (state.email) localStorage.setItem("af_lead_email", state.email);
      if (state.name) localStorage.setItem("af_lead_name", state.name);
      if (state.phone) localStorage.setItem("af_lead_phone", state.phone);
      if (state.assignedTo) localStorage.setItem("af_owner_id", state.assignedTo);
      if (state.campaignId) localStorage.setItem("af_campaign_id", state.campaignId);
      router.push("/step/2");
    }
  }, [state.ok, state.email, state.assignedTo, state.campaignId, router]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const filtered = search
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.code.includes(search) ||
          c.iso.toLowerCase().includes(search.toLowerCase())
      )
    : COUNTRIES;

  return (
    <main
      className="min-h-screen flex flex-col overflow-x-hidden"
      style={{
        background: "linear-gradient(160deg, #0B0D10 0%, #12161C 40%, #0d1a3a 65%, #0B0D10 100%)",
      }}
    >
      {/* Content — Two column on desktop */}
      <section className="flex-1 flex items-center justify-center px-4 sm:px-5 md:px-10 py-14 md:py-16 safe-top">
        <div className="w-full max-w-[1100px] grid md:grid-cols-[1.1fr_0.9fr] gap-6 md:gap-16 items-center">
          {/* Left: Copy */}
          <div className="text-center md:text-left">
            <div className="h-[50px] md:h-0" />
            {/* Pre-headline badge — pattern interrupt */}
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md mb-5 md:mb-6"
              style={{
                background: "rgba(74, 222, 128, 0.08)",
                border: "1px solid rgba(74, 222, 128, 0.3)",
                boxShadow: "0 0 20px rgba(74, 222, 128, 0.06)",
              }}
            >
              <span
                className="text-[12px] md:text-[13px] font-semibold uppercase"
                style={{
                  letterSpacing: "0.08em",
                  color: "#4ADE80",
                }}
              >
                ⚠️ Presentación exclusiva — Cupos de certificación limitados por capacidad operativa
              </span>
            </div>

            <h1
              className="text-[1.55rem] md:text-[2.55rem] font-bold text-white mb-5 md:mb-6"
              style={{
                lineHeight: "1.12",
                letterSpacing: "-0.02em",
                fontFamily: "var(--font-satoshi)",
              }}
            >
              Mientras tú miras contenido sobre inteligencia artificial, otros ya están{" "}
              <span
                className="relative inline"
                style={{
                  color: "#4ADE80",
                }}
              >
                cobrando miles de dólares
                <span
                  className="absolute -bottom-1 left-0 w-full h-[3px] hidden md:block rounded-full"
                  style={{
                    background: "linear-gradient(90deg, #4ADE80, #86EFAC, #4ADE80)",
                    opacity: 0.5,
                  }}
                />
              </span>{" "}
              por instalar sistemas de ventas con IA a negocios reales.
            </h1>

            <p
              className="text-[14px] md:text-[1.02rem] leading-relaxed mb-6 md:mb-0"
              style={{ color: "rgba(255,255,255,0.62)" }}
            >
              Esta es la presentación oficial de la única certificación respaldada por una compañía que construye estos sistemas para sus clientes a{" "}
              <strong className="font-semibold text-white/85">más de 15.000 dólares por proyecto</strong>. Lo que vas a ver en los próximos minutos no es teoría. Es el sistema funcionando. <em style={{ fontFamily: "var(--font-instrument-serif)", fontStyle: "italic", color: "#4ADE80" }}>Contigo adentro.</em>
            </p>
          </div>

          {/* Right: Form card */}
          <div
            className="w-full max-w-[420px] mx-auto md:mx-0 md:ml-auto rounded-2xl p-5 sm:p-6 md:p-8"
            style={{
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset",
            }}
          >
            <div className="text-center mb-6">
              <h2
                className="text-lg md:text-xl font-bold text-white mb-1.5"
                style={{ fontFamily: "var(--font-satoshi)", letterSpacing: "-0.015em" }}
              >
                Reservá tu acceso
              </h2>
              <p
                className="text-xs"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                Completá tus datos para ver la presentación
              </p>
            </div>

            <form action={action} className="space-y-3.5">
              <input
                name="name"
                type="text"
                placeholder="Tu nombre"
                required
                className="w-full px-4 py-3.5 rounded-lg text-white placeholder-white/25 outline-none transition-all duration-200 text-sm"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(74, 222, 128, 0.5)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(74, 222, 128, 0.08)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              <input
                name="email"
                type="email"
                placeholder="Tu email"
                required
                className="w-full px-4 py-3.5 rounded-lg text-white placeholder-white/25 outline-none transition-all duration-200 text-sm"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(74, 222, 128, 0.5)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(74, 222, 128, 0.08)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />

              <input type="hidden" name="countryCode" value={selected.code} />
              <input type="hidden" name="countryIso" value={selected.iso} />
              <input type="hidden" name="timezone" value={typeof window !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : ""} />
              {hasUtms && (
                <input type="hidden" name="utms" value={JSON.stringify(utms)} />
              )}
              {assignSlug && (
                <input type="hidden" name="assignSlug" value={assignSlug} />
              )}

              {/* Phone */}
              <div className="relative" ref={dropdownRef}>
                <div
                  className="flex items-center rounded-lg overflow-hidden transition-all duration-200"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => { setOpen(!open); setSearch(""); }}
                    className="flex items-center gap-1 pl-4 pr-2 py-3.5 transition-colors shrink-0 cursor-pointer hover:bg-white/5"
                  >
                    <span className="text-base leading-none">{selected.flag}</span>
                    <span className="text-xs font-medium text-white/50">{selected.code}</span>
                    <svg
                      className={`w-3 h-3 text-white/25 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="w-px h-5 bg-white/8 shrink-0" />
                  <input
                    name="phone"
                    type="tel"
                    placeholder="Tu WhatsApp"
                    required
                    ref={phoneRef}
                    value={phone}
                    onChange={handlePhoneChange}
                    onKeyDown={handlePhoneKeyDown}
                    autoComplete="tel-national"
                    className="flex-1 py-3.5 pl-3 pr-4 text-white placeholder-white/25 outline-none bg-transparent text-sm"
                  />
                </div>

                {open && (
                  <div
                    className="absolute z-50 bottom-full md:bottom-auto md:top-full left-0 right-0 mb-1.5 md:mb-0 md:mt-1.5 rounded-lg overflow-hidden shadow-2xl shadow-black/60"
                    style={{
                      background: "rgba(8, 14, 30, 0.98)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      backdropFilter: "blur(20px)",
                    }}
                  >
                    <div className="p-2 border-b border-white/8">
                      <div className="flex items-center gap-2 bg-white/5 rounded-md px-3 py-2">
                        <svg className="w-3.5 h-3.5 text-white/25 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          ref={searchRef}
                          type="text"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Buscar país..."
                          className="bg-transparent text-white text-xs placeholder-white/25 outline-none w-full"
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto overscroll-contain scrollbar-thin">
                      {filtered.length === 0 ? (
                        <div className="px-4 py-4 text-center text-white/25 text-xs">
                          No se encontraron países
                        </div>
                      ) : (
                        filtered.map((country) => (
                          <button
                            key={country.iso}
                            type="button"
                            onClick={() => { setSelected(country); setOpen(false); setSearch(""); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer text-xs ${
                              selected.iso === country.iso
                                ? "bg-[#4ADE80]/10 text-[#4ADE80]"
                                : "text-white/60 hover:bg-white/5"
                            }`}
                          >
                            <span className="text-base leading-none">{country.flag}</span>
                            <span className="flex-1 truncate">{country.name}</span>
                            <span className="text-[10px] text-white/20 font-mono">{country.code}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {state.error && (
                <p className="text-xs text-red-400 text-center">{state.error}</p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="w-full py-4 rounded-lg text-sm font-bold uppercase transition-all duration-300 disabled:opacity-50 cursor-pointer mt-2"
                style={{
                  letterSpacing: "0.08em",
                  background: "linear-gradient(135deg, #4ADE80 0%, #86EFAC 50%, #4ADE80 100%)",
                  color: "#0B0D10",
                  boxShadow: "0 4px 24px rgba(74, 222, 128, 0.3), 0 1px 0 rgba(255,255,255,0.15) inset",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 8px 40px rgba(74, 222, 128, 0.5), 0 1px 0 rgba(255,255,255,0.15) inset";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "0 4px 24px rgba(74, 222, 128, 0.3), 0 1px 0 rgba(255,255,255,0.15) inset";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {pending ? "Enviando..." : "QUIERO VER LA PRESENTACIÓN AHORA"}
              </button>

              <p
                className="pt-1 text-[10px] md:text-[11px] text-center leading-relaxed"
                style={{ color: "rgba(255,255,255,0.32)" }}
              >
                Acceso inmediato al video. Sin costo. Esta presentación no estará disponible de forma permanente.
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="px-4 sm:px-5 py-4 text-[9px] md:text-[10px] leading-relaxed safe-bottom"
        style={{ color: "rgba(255,255,255,0.15)", borderTop: "1px solid rgba(255,255,255,0.04)" }}
      >
        <div className="max-w-[1100px] mx-auto space-y-1.5">
          <p>
            Esta página no es parte del sitio web de Facebook o Facebook Inc.
            Este sitio no está respaldado por Facebook de alguna manera. FACEBOOK es una marca registrada de FACEBOOK, Inc.
            Este sitio y esta oportunidad no están afiliados ni respaldados por Instagram.
          </p>
          <p style={{ color: "rgba(255,255,255,0.2)" }}>
            <strong>IMPORTANTE:</strong> Las ganancias mostradas son aspiracionales. Los resultados varían según capacidad individual, ética laboral, experiencia y otros factores.
          </p>
          <div className="flex flex-wrap gap-2 pt-0.5" style={{ color: "rgba(74, 222, 128, 0.3)" }}>
            <a href="#" className="hover:underline">Disclaimer</a>
            <span style={{ color: "rgba(255,255,255,0.08)" }}>|</span>
            <a href="#" className="hover:underline">Privacidad</a>
            <span style={{ color: "rgba(255,255,255,0.08)" }}>|</span>
            <a href="#" className="hover:underline">Términos</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

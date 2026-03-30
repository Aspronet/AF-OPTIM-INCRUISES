"use client";

import { useActionState, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { submitLead, type FormState } from "@/app/actions";

const COUNTRIES = [
  { code: "+54", iso: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "+1", iso: "US", name: "Estados Unidos", flag: "🇺🇸" },
  { code: "+52", iso: "MX", name: "México", flag: "🇲🇽" },
  { code: "+57", iso: "CO", name: "Colombia", flag: "🇨🇴" },
  { code: "+56", iso: "CL", name: "Chile", flag: "🇨🇱" },
  { code: "+51", iso: "PE", name: "Perú", flag: "🇵🇪" },
  { code: "+593", iso: "EC", name: "Ecuador", flag: "🇪🇨" },
  { code: "+58", iso: "VE", name: "Venezuela", flag: "🇻🇪" },
  { code: "+34", iso: "ES", name: "España", flag: "🇪🇸" },
  { code: "+55", iso: "BR", name: "Brasil", flag: "🇧🇷" },
  { code: "+598", iso: "UY", name: "Uruguay", flag: "🇺🇾" },
  { code: "+595", iso: "PY", name: "Paraguay", flag: "🇵🇾" },
  { code: "+591", iso: "BO", name: "Bolivia", flag: "🇧🇴" },
  { code: "+506", iso: "CR", name: "Costa Rica", flag: "🇨🇷" },
  { code: "+507", iso: "PA", name: "Panamá", flag: "🇵🇦" },
  { code: "+502", iso: "GT", name: "Guatemala", flag: "🇬🇹" },
  { code: "+503", iso: "SV", name: "El Salvador", flag: "🇸🇻" },
  { code: "+504", iso: "HN", name: "Honduras", flag: "🇭🇳" },
  { code: "+505", iso: "NI", name: "Nicaragua", flag: "🇳🇮" },
  { code: "+1", iso: "DO", name: "Rep. Dominicana", flag: "🇩🇴" },
  { code: "+53", iso: "CU", name: "Cuba", flag: "🇨🇺" },
  { code: "+39", iso: "IT", name: "Italia", flag: "🇮🇹" },
  { code: "+49", iso: "DE", name: "Alemania", flag: "🇩🇪" },
  { code: "+44", iso: "GB", name: "Reino Unido", flag: "🇬🇧" },
  { code: "+33", iso: "FR", name: "Francia", flag: "🇫🇷" },
  { code: "+351", iso: "PT", name: "Portugal", flag: "🇵🇹" },
];

const initial: FormState = { ok: false, error: "" };

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export default function Step1() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, action, pending] = useActionState(submitLead, initial);
  const [selected, setSelected] = useState(COUNTRIES[0]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Capture UTM params from URL
  const utms: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const val = searchParams.get(key);
    if (val) utms[key] = val;
  }
  const hasUtms = Object.keys(utms).length > 0;

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
      router.push("/step/2");
    }
  }, [state.ok, state.email, state.assignedTo, router]);

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

  const inputStyle = {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    backdropFilter: "blur(12px)",
  };

  const inputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "rgba(201, 168, 76, 0.6)";
    e.currentTarget.style.background = "rgba(255,255,255,0.12)";
  };
  const inputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
    e.currentTarget.style.background = "rgba(255,255,255,0.08)";
  };

  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Full-screen cruise background */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1548574505-5e239809ee19?w=1920&q=80"
          alt=""
          className="w-full h-full object-cover"
        />
        {/* Dark overlay gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(8,16,35,0.85) 0%, rgba(8,16,35,0.75) 30%, rgba(8,16,35,0.88) 70%, rgba(8,16,35,0.95) 100%)",
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-center py-6 px-6">
        <img
          src="https://www.incruises.com/images/incruises_logo.png"
          alt="inCruises"
          className="h-8 md:h-10 object-contain brightness-0 invert opacity-90"
        />
      </header>

      {/* Content — Two column on desktop */}
      <section className="relative z-10 flex-1 flex items-center justify-center px-5 md:px-8 py-6 md:py-12">
        <div className="w-full max-w-5xl grid md:grid-cols-2 gap-6 md:gap-14 items-center">
          {/* Left: Copy */}
          <div className="text-center md:text-left">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4 md:mb-5 text-[11px] font-semibold tracking-[0.15em] uppercase"
              style={{
                background: "rgba(201, 168, 76, 0.12)",
                border: "1px solid rgba(201, 168, 76, 0.25)",
                color: "#c9a84c",
              }}
            >
              <span>Oportunidad Exclusiva 2026</span>
            </div>

            <h1 className="text-2xl md:text-[2.6rem] md:leading-[1.15] font-bold text-white mb-3 md:mb-5">
              Viajá Por El Mundo En{" "}
              <span className="relative inline-block" style={{ color: "#c9a84c" }}>
                Cruceros De Lujo
                <svg className="absolute -bottom-1 left-0 w-full hidden md:block" height="5" viewBox="0 0 200 5" fill="none">
                  <path d="M0 4C60 0 140 0 200 4" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
                </svg>
              </span>{" "}
              Y Generá Ingresos Desde Cualquier Lugar
            </h1>

            <p className="text-sm md:text-base leading-relaxed mb-4 md:mb-6 hidden md:block" style={{ color: "rgba(255,255,255,0.55)" }}>
              Únete al club de viajes más grande del mundo. Descubrí cómo miles
              de personas ya están viajando con descuentos de hasta el 80% y
              construyendo un negocio con inCruises.
            </p>
            <p className="text-xs leading-relaxed mb-4 md:hidden" style={{ color: "rgba(255,255,255,0.5)" }}>
              Descubrí cómo miles de personas viajan con hasta 80% de descuento
              y construyen un negocio con inCruises.
            </p>

            {/* Social proof */}
            <div className="flex items-center gap-4 md:gap-5 justify-center md:justify-start mb-6 md:mb-0">
              <div className="text-center">
                <div className="text-lg md:text-xl font-bold text-white">+500K</div>
                <div className="text-[9px] md:text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Miembros</div>
              </div>
              <div className="w-px h-7 md:h-8" style={{ background: "rgba(255,255,255,0.1)" }} />
              <div className="text-center">
                <div className="text-lg md:text-xl font-bold text-white">195</div>
                <div className="text-[9px] md:text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Países</div>
              </div>
              <div className="w-px h-7 md:h-8" style={{ background: "rgba(255,255,255,0.1)" }} />
              <div className="text-center">
                <div className="text-lg md:text-xl font-bold text-white">+80%</div>
                <div className="text-[9px] md:text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Descuento</div>
              </div>
            </div>
          </div>

          {/* Right: Form card */}
          <div
            className="w-full max-w-[400px] mx-auto md:mx-0 md:ml-auto rounded-2xl p-5 md:p-8"
            style={{
              background: "rgba(12, 20, 40, 0.75)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(24px)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            }}
          >
            <div className="text-center mb-5 md:mb-6">
              <h2 className="text-base md:text-lg font-bold text-white mb-1">
                Accedé a la presentación
              </h2>
              <p className="text-[11px] md:text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                Completá tus datos y mirá el video exclusivo
              </p>
            </div>

            <form action={action} className="space-y-3">
              <input
                name="name"
                type="text"
                placeholder="Tu nombre completo"
                required
                className="w-full px-4 py-3.5 rounded-lg text-white placeholder-white/30 outline-none transition-all duration-200 text-sm"
                style={inputStyle}
                onFocus={inputFocus}
                onBlur={inputBlur}
              />
              <input
                name="email"
                type="email"
                placeholder="Tu mejor email"
                required
                className="w-full px-4 py-3.5 rounded-lg text-white placeholder-white/30 outline-none transition-all duration-200 text-sm"
                style={inputStyle}
                onFocus={inputFocus}
                onBlur={inputBlur}
              />

              <input type="hidden" name="countryCode" value={selected.code} />
              <input type="hidden" name="countryIso" value={selected.iso} />
              {hasUtms && (
                <input type="hidden" name="utms" value={JSON.stringify(utms)} />
              )}

              {/* Phone */}
              <div className="relative" ref={dropdownRef}>
                <div
                  className="flex items-center rounded-lg overflow-hidden transition-all duration-200"
                  style={inputStyle}
                >
                  <button
                    type="button"
                    onClick={() => { setOpen(!open); setSearch(""); }}
                    className="flex items-center gap-1 pl-4 pr-2 py-3.5 transition-colors shrink-0 cursor-pointer hover:bg-white/5"
                  >
                    <span className="text-base leading-none">{selected.flag}</span>
                    <span className="text-xs font-medium text-white/60">{selected.code}</span>
                    <svg
                      className={`w-3 h-3 text-white/30 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="w-px h-5 bg-white/10 shrink-0" />
                  <input
                    name="phone"
                    type="tel"
                    placeholder="Tu WhatsApp"
                    required
                    className="flex-1 py-3.5 pl-3 pr-4 text-white placeholder-white/30 outline-none bg-transparent text-sm"
                  />
                </div>

                {open && (
                  <div
                    className="absolute z-50 bottom-full md:bottom-auto md:top-full left-0 right-0 mb-1.5 md:mb-0 md:mt-1.5 rounded-lg overflow-hidden shadow-2xl shadow-black/60"
                    style={{
                      background: "rgba(10, 18, 38, 0.98)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      backdropFilter: "blur(20px)",
                    }}
                  >
                    <div className="p-2 border-b border-white/10">
                      <div className="flex items-center gap-2 bg-white/5 rounded-md px-3 py-2">
                        <svg className="w-3.5 h-3.5 text-white/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          ref={searchRef}
                          type="text"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Buscar país..."
                          className="bg-transparent text-white text-xs placeholder-white/30 outline-none w-full"
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto overscroll-contain scrollbar-thin">
                      {filtered.length === 0 ? (
                        <div className="px-4 py-4 text-center text-white/30 text-xs">
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
                                ? "bg-[#c9a84c]/10 text-[#c9a84c]"
                                : "text-white/70 hover:bg-white/5"
                            }`}
                          >
                            <span className="text-base leading-none">{country.flag}</span>
                            <span className="flex-1 truncate">{country.name}</span>
                            <span className="text-[10px] text-white/25 font-mono">{country.code}</span>
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
                className="w-full py-3.5 rounded-lg text-sm font-bold tracking-wide uppercase transition-all duration-300 disabled:opacity-50 cursor-pointer mt-1"
                style={{
                  background: "linear-gradient(135deg, #c9a84c 0%, #e0c068 50%, #c9a84c 100%)",
                  color: "#0a1628",
                  boxShadow: "0 4px 20px rgba(201, 168, 76, 0.25)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 6px 30px rgba(201, 168, 76, 0.45)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "0 4px 20px rgba(201, 168, 76, 0.25)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {pending ? "Enviando..." : "Quiero Ver La Presentación"}
              </button>

              <div className="flex items-center justify-center gap-3 pt-1">
                <div className="flex items-center gap-1 text-white/25 text-[10px]">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Datos seguros</span>
                </div>
                <div className="w-px h-2.5 bg-white/10" />
                <div className="flex items-center gap-1 text-white/25 text-[10px]">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>100% gratis</span>
                </div>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="relative z-10 px-4 py-6 text-[10px] leading-relaxed"
        style={{ color: "rgba(255,255,255,0.2)", borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="max-w-5xl mx-auto space-y-2">
          <p>
            Esta página no es parte del sitio web de Facebook o Facebook Inc.
            Este sitio no está respaldado por Facebook de alguna manera. FACEBOOK es una marca registrada de FACEBOOK, Inc.
            Este sitio y esta oportunidad no están afiliados a, ni respaldados por Instagram.
          </p>
          <p style={{ color: "rgba(255,255,255,0.3)" }}>
            <strong>IMPORTANTE:</strong> Las ganancias mostradas son aspiracionales. Los resultados varían según capacidad individual, ética laboral, experiencia y otros factores.
          </p>
          <div className="flex flex-wrap gap-2 pt-1" style={{ color: "rgba(201, 168, 76, 0.4)" }}>
            <a href="#" className="hover:underline">Disclaimer</a>
            <span style={{ color: "rgba(255,255,255,0.1)" }}>·</span>
            <a href="#" className="hover:underline">Privacidad</a>
            <span style={{ color: "rgba(255,255,255,0.1)" }}>·</span>
            <a href="#" className="hover:underline">Términos</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

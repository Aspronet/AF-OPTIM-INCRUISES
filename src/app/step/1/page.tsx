"use client";

import { useActionState, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
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

export default function Step1() {
  const router = useRouter();
  const [state, action, pending] = useActionState(submitLead, initial);
  const [selected, setSelected] = useState(COUNTRIES[0]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Auto-detect country by IP
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

  // Save email & redirect on success
  useEffect(() => {
    if (state.ok) {
      if (state.email) localStorage.setItem("af_lead_email", state.email);
      router.push("/step/2");
    }
  }, [state.ok, state.email, router]);

  // Close dropdown on click outside
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

  // Focus search when dropdown opens
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
    <main className="min-h-screen bg-black text-white flex flex-col">
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-2xl w-full text-center">
          <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-4">
            Descubre Como Estamos Ayudando A Personas Como TU, A Ganar $10,000*
            USD Mensuales
          </h1>
          <p className="text-lg md:text-xl text-gray-300 mb-10">
            Convirtiendote En Vendedor Digital Certificado En Tan Solo 60 Días
          </p>

          <form action={action} className="space-y-4 max-w-lg mx-auto">
            <input
              name="name"
              type="text"
              placeholder="Ingresa tu nombre...*"
              required
              className="w-full px-6 py-4 rounded-full bg-white text-black text-center placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
            />
            <input
              name="email"
              type="email"
              placeholder="Ingresa tu email...*"
              required
              className="w-full px-6 py-4 rounded-full bg-white text-black text-center placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
            />

            {/* Hidden field: full country code */}
            <input type="hidden" name="countryCode" value={selected.code} />
            <input type="hidden" name="countryIso" value={selected.iso} />

            {/* Phone with custom country selector */}
            <div className="relative" ref={dropdownRef}>
              <div className="flex items-center bg-white rounded-full overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-shadow">
                {/* Country selector button */}
                <button
                  type="button"
                  onClick={() => {
                    setOpen(!open);
                    setSearch("");
                  }}
                  className="flex items-center gap-1.5 pl-4 pr-2 py-4 hover:bg-gray-50 transition-colors shrink-0 cursor-pointer"
                >
                  <span className="text-xl leading-none">{selected.flag}</span>
                  <span className="text-sm font-semibold text-gray-800">
                    {selected.code}
                  </span>
                  <svg
                    className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Divider */}
                <div className="w-px h-6 bg-gray-200 shrink-0" />

                <input
                  name="phone"
                  type="tel"
                  placeholder="Tu número de WhatsApp...*"
                  required
                  className="flex-1 py-4 pl-3 pr-6 text-black placeholder-gray-400 outline-none bg-transparent text-sm"
                />
              </div>

              {/* Dropdown */}
              {open && (
                <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Search */}
                  <div className="p-3 border-b border-white/10">
                    <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2.5">
                      <svg
                        className="w-4 h-4 text-gray-400 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                      <input
                        ref={searchRef}
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar país..."
                        className="bg-transparent text-white text-sm placeholder-gray-500 outline-none w-full"
                      />
                    </div>
                  </div>

                  {/* Country list */}
                  <div className="max-h-64 overflow-y-auto overscroll-contain scrollbar-thin">
                    {filtered.length === 0 ? (
                      <div className="px-4 py-6 text-center text-gray-500 text-sm">
                        No se encontraron países
                      </div>
                    ) : (
                      filtered.map((country) => (
                        <button
                          key={country.iso}
                          type="button"
                          onClick={() => {
                            setSelected(country);
                            setOpen(false);
                            setSearch("");
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer ${
                            selected.iso === country.iso
                              ? "bg-blue-600/20 text-blue-400"
                              : "text-white hover:bg-white/5"
                          }`}
                        >
                          <span className="text-xl leading-none">{country.flag}</span>
                          <span className="flex-1 text-sm font-medium truncate">
                            {country.name}
                          </span>
                          <span className="text-xs text-gray-400 font-mono tabular-nums">
                            {country.code}
                          </span>
                          {selected.iso === country.iso && (
                            <svg
                              className="w-4 h-4 text-blue-400 shrink-0"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2.5}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {state.error && (
              <p className="text-sm text-red-400">{state.error}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full py-4 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all text-white text-lg font-bold tracking-wide disabled:opacity-50"
            >
              {pending ? "Enviando..." : "¡MUESTRAME EL ENTRENAMIENTO!"}
            </button>
          </form>
        </div>
      </section>

      <footer className="bg-black border-t border-gray-800 px-4 py-8 text-xs text-gray-400 leading-relaxed">
        <div className="max-w-4xl mx-auto space-y-4">
          <p>
            Esta página no es parte del sitio web de Facebook o de Facebook Inc.
            Adicionalmente, este sitio no está respaldado por Facebook de alguna
            manera. FACEBOOK es una marca registrada de FACEBOOK, Inc.
          </p>
          <p>
            Digital Entrepreneur LLC y este entrenamiento y oportunidad no estan
            afiliados a, ni respaldados por Instagram.
          </p>
          <p className="font-semibold text-gray-300">
            IMPORTANTE: ganancias y disclaimers legales
          </p>
          <p>
            Las ganancias y representaciones de ingresos hechas por Digital
            Entrepreneur LLC y sus promotores/patrocinadores/miembros/dueños son
            muestras aspiracionales del potencial de tus ganancias. El éxito de
            Digital Entrepreneur LLC, los testimonios y otros ejemplos utilizados
            son casos excepcionales, y no son resultados típicos. No estan hechos
            para ser y no son una garantía de que tu u otras personas van a lograr
            los mismos resultados. Los resultados de cada individuo siempre van a
            variar y van a depender completamente de tu capacidad individual,
            ética laboral, habilidad de negocios y experiencia, nivel de
            motivación, diligencia al aplicar los programas de Digital
            Entrepreneur LLC, la economía, el riesgo normal e inesperado de hacer
            negocios, y otros factores.
          </p>
          <p>
            Digital Entrepreneur LLC no es responsable de tus acciones. Eres el
            único responsable de tus propias acciones y decisiones y la evaluación
            y uso de nuestros productos y servicios debe basarse en tu propia
            diligencia. Al visitar esta y cualquiera de las páginas de Digital
            Entrepreneur LLC, aceptas que Digital Entrepreneur LLC no es
            responsable o culpable de tus resultados al usar nuestros productos y
            servicios.
          </p>
          <p>
            Revisa nuestros{" "}
            <a href="#" className="text-blue-400 hover:underline">
              Términos & Condiciones
            </a>{" "}
            para ver nuestro disclaimer completo sobre responsabilidad legal y
            otras restricciones.
          </p>
          <p>
            ¿Tienes preguntas sobre cualquiera de los programas de Digital
            Entrepreneur LLC? ¿Estás preguntándote si los programas funcionarán
            para ti? Envíanos un email a info@emprendedordigital.co. Estaremos
            felices de discutir tus objetivos y como nuestros programas podrían
            ayudarte.
          </p>
          <p>Dirección Del Negocio: 3632 red road miramar 33025 FL</p>
          <div className="flex flex-wrap gap-2 text-blue-400">
            <a href="#" className="hover:underline">Disclaimer</a>
            <span>·</span>
            <a href="#" className="hover:underline">Política de privacidad</a>
            <span>·</span>
            <a href="#" className="hover:underline">Términos de servicio</a>
            <span>·</span>
            <a href="#" className="hover:underline">Política de reembolsos</a>
          </div>
          <p className="text-center text-gray-500">
            © 2026 Digital Entrepreneur · Todos Los Derechos Reservados
          </p>
        </div>
      </footer>
    </main>
  );
}

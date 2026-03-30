"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { lookupLead, trackFunnelStep } from "@/app/actions";

export default function Step2() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);

  // Support ?ref=email to enter directly (skip Step 1)
  // Track stage: entering Step 2 = confirmar_cita (48hr_qual_conf)
  useEffect(() => {
    const ref = searchParams.get("ref");

    if (ref) {
      // Direct entry via link — lookup lead and store data
      localStorage.setItem("af_lead_email", ref);
      lookupLead(ref).then((res) => {
        if (res.ok && res.userId) {
          localStorage.setItem("af_owner_id", res.userId);
        }
        // Track: lead entered video/booking step
        trackFunnelStep(ref, "confirmar_cita");
        setReady(true);
      });
    } else {
      // Normal flow from Step 1 — data already in localStorage
      const email = localStorage.getItem("af_lead_email");
      if (email) trackFunnelStep(email, "confirmar_cita");
      setReady(true);
    }
  }, [searchParams]);

  if (!ready) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#0a1628" }}
      >
        <div className="w-6 h-6 border-2 border-white/20 border-t-[#c9a84c] rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, #0a1628 0%, #0e1f3d 40%, #132a4a 70%, #0a1628 100%)",
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-center py-5 px-6">
        <img
          src="https://www.incruises.com/images/incruises_logo.png"
          alt="inCruises"
          className="h-8 md:h-10 object-contain brightness-0 invert opacity-90"
        />
      </header>

      {/* Content */}
      <section className="relative z-10 flex-1 flex flex-col items-center px-5 md:px-8 pb-10">
        <div className="w-full max-w-3xl">
          {/* Step badge */}
          <div className="text-center mb-5">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold tracking-[0.12em] uppercase mb-4"
              style={{
                background: "rgba(201, 168, 76, 0.12)",
                border: "1px solid rgba(201, 168, 76, 0.25)",
                color: "#c9a84c",
              }}
            >
              Paso 1: Mirá el Video
            </div>
            <h1 className="text-xl md:text-3xl font-bold text-white leading-tight">
              Descubrí Cómo Miles De Personas Viajan En{" "}
              <span style={{ color: "#c9a84c" }}>Cruceros De Lujo</span>{" "}
              Y Generan Ingresos
            </h1>
          </div>

          {/* Video */}
          <div
            className="relative w-full aspect-video rounded-xl overflow-hidden mb-8"
            style={{
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            }}
          >
            {/* Replace with real video iframe */}
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#0e1f3d] to-[#0a1628]">
              <button className="group flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full transition-all duration-300 cursor-pointer"
                style={{
                  background: "rgba(201, 168, 76, 0.15)",
                  border: "2px solid rgba(201, 168, 76, 0.4)",
                }}
              >
                <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[18px] border-b-[10px] border-b-transparent ml-1 transition-all"
                  style={{ borderLeftColor: "#c9a84c" }}
                />
              </button>
            </div>
            {/* Para video real:
            <iframe
              src="https://www.youtube.com/embed/VIDEO_ID"
              className="absolute inset-0 w-full h-full"
              allow="autoplay; fullscreen; encrypted-media"
              allowFullScreen
            /> */}
          </div>

          {/* CTA */}
          <div className="text-center">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold tracking-[0.12em] uppercase mb-5"
              style={{
                background: "rgba(201, 168, 76, 0.12)",
                border: "1px solid rgba(201, 168, 76, 0.25)",
                color: "#c9a84c",
              }}
            >
              Paso 2: Agendá Tu Llamada
            </div>

            <button
              onClick={() => router.push("/step/3")}
              className="block w-full max-w-md mx-auto py-4 rounded-xl text-sm md:text-base font-bold tracking-wide uppercase transition-all duration-300 cursor-pointer"
              style={{
                background:
                  "linear-gradient(135deg, #c9a84c 0%, #e0c068 50%, #c9a84c 100%)",
                color: "#0a1628",
                boxShadow: "0 4px 20px rgba(201, 168, 76, 0.25)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 6px 30px rgba(201, 168, 76, 0.45)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 4px 20px rgba(201, 168, 76, 0.25)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              Agendar Consultoría Gratuita
            </button>

            <p
              className="text-xs mt-3"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              Cupos limitados — Reservá tu lugar ahora
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="relative z-10 px-4 py-6 text-[10px] leading-relaxed"
        style={{
          color: "rgba(255,255,255,0.2)",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div className="max-w-3xl mx-auto space-y-2">
          <p>
            Esta página no es parte del sitio web de Facebook o Facebook Inc.
            Este sitio no está respaldado por Facebook de alguna manera.
          </p>
          <p style={{ color: "rgba(255,255,255,0.3)" }}>
            <strong>IMPORTANTE:</strong> Las ganancias mostradas son
            aspiracionales. Los resultados varían según capacidad individual,
            ética laboral, experiencia y otros factores.
          </p>
          <div
            className="flex flex-wrap gap-2 pt-1"
            style={{ color: "rgba(201, 168, 76, 0.4)" }}
          >
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

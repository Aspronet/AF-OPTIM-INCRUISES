"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { lookupLead, trackVideoEvent, trackVisitorGeo } from "@/app/actions";
import VideoPlayer from "@/components/VideoPlayer";
import type { VideoEventPayload } from "@/components/VideoPlayer";

// ─── CONFIGURATION ──────────────────────────────────────
// Change these to swap the video for each funnel
const VIDEO_URL = "https://incruises.b-cdn.net/in%20cruises%201.mov";
const VIDEO_POSTER = "";
const VIDEO_NAME = "VSL Principal"; // name shown in lead_activity metadata
// ────────────────────────────────────────────────────────

export default function Step2Page() {
  return (
    <Suspense>
      <Step2 />
    </Suspense>
  );
}

function Step2() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);

  const handleVideoEvent = useCallback((payload: VideoEventPayload) => {
    const email = localStorage.getItem("af_lead_email") || "";
    const userId = localStorage.getItem("af_owner_id") || "";
    trackVideoEvent({
      email,
      userId,
      event: payload.event,
      currentTime: payload.currentTime,
      duration: payload.duration,
      percentWatched: payload.percentWatched,
      totalWatchTime: payload.totalWatchTime,
      milestone: payload.milestone,
      videoName: VIDEO_NAME,
      step: 2,
    });
  }, []);

  // Beacon data for abandon tracking (read once, stays stable)
  const beaconData = useMemo(() => ({
    leadId: typeof window !== "undefined" ? localStorage.getItem("af_lead_id") || "" : "",
    userId: typeof window !== "undefined" ? localStorage.getItem("af_owner_id") || "" : "",
    videoName: VIDEO_NAME,
    step: 2,
  }), []);

  // Support ?ref=email to enter directly (skip Step 1)
  useEffect(() => {
    const ref = searchParams.get("ref");

    if (ref) {
      localStorage.setItem("af_lead_email", ref);
      lookupLead(ref).then((res) => {
        if (res.ok && res.userId) {
          localStorage.setItem("af_owner_id", res.userId);
        }
        if (res.ok && res.leadId) {
          localStorage.setItem("af_lead_id", res.leadId);
        }
        setReady(true);
      });
    } else {
      // Ensure we have leadId if coming from Step 1
      const email = localStorage.getItem("af_lead_email");
      if (email && !localStorage.getItem("af_lead_id")) {
        lookupLead(email).then((res) => {
          if (res.ok && res.leadId) localStorage.setItem("af_lead_id", res.leadId);
          if (res.ok && res.userId && !localStorage.getItem("af_owner_id")) localStorage.setItem("af_owner_id", res.userId);
          setReady(true);
        });
      } else {
        setReady(true);
      }
    }
  }, [searchParams]);

  // Track visitor IP + country on page load
  useEffect(() => {
    if (!ready) return;
    const leadId = localStorage.getItem("af_lead_id");
    const userId = localStorage.getItem("af_owner_id");
    if (!leadId || !userId) return;

    fetch("/api/visitor-geo")
      .then((r) => r.json())
      .then((geo) => {
        trackVisitorGeo({
          leadId,
          userId,
          ip: geo.ip,
          country: geo.country,
          countryName: geo.countryName,
          region: geo.region,
          city: geo.city,
          step: 2,
        });
      })
      .catch(() => {});
  }, [ready]);

  if (!ready) {
    return (
      <main
        className="h-screen flex items-center justify-center"
        style={{ background: "#060b18" }}
      >
        <div className="w-6 h-6 border-2 border-white/10 border-t-[#d4a843] rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main
      className="min-h-screen flex flex-col overflow-x-hidden relative"
      style={{
        background: "linear-gradient(160deg, #060b18 0%, #0a1230 40%, #0d1a3a 65%, #060b18 100%)",
      }}
    >
      {/* Background depth layers */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 55%, rgba(212, 168, 67, 0.03) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
      />

      {/* Content */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-5 md:px-8 py-14 md:py-16 safe-top">
        <div className="w-full max-w-[740px]">
          <div className="hidden md:block h-[60px]" />

          {/* Badge — VIDEO EXCLUSIVO */}
          <div className="text-center mb-2.5 md:mb-3 vsl-fade-1">
            <div
              className="badge-shine inline-flex items-center px-3 py-1.5 rounded-md"
              style={{
                border: "1px solid rgba(212, 168, 67, 0.3)",
              }}
            >
              <span
                className="text-[10px] md:text-[11px] font-semibold uppercase"
                style={{
                  letterSpacing: "0.15em",
                  color: "#d4a843",
                }}
              >
                Video Exclusivo
              </span>
            </div>
          </div>

          {/* Headline */}
          <div className="text-center mb-4 md:mb-5 vsl-fade-2">
            <h1
              className="text-[1.35rem] sm:text-[1.6rem] md:text-[2.1rem] lg:text-[2.4rem] font-bold text-white max-w-[700px] mx-auto"
              style={{
                lineHeight: "1.2",
                letterSpacing: "-0.015em",
                textShadow: "0 2px 20px rgba(0,0,0,0.3)",
              }}
            >
              Cómo Construir Un Negocio Global En Una Industria Multimillonaria Sin Crear Producto, Sin Saber De Marketing Y Con Un Sistema Que Te Guía Paso A Paso.
            </h1>
          </div>

          {/* PASO 1 indicator */}
          <div className="flex items-center justify-center gap-2.5 mb-3 vsl-fade-3">
            <div
              className="flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold shrink-0"
              style={{
                background: "linear-gradient(135deg, #d4a843, #e8c45a)",
                color: "#060b18",
              }}
            >
              1
            </div>
            <span
              className="text-[11px] font-semibold uppercase"
              style={{
                letterSpacing: "0.1em",
                color: "#d4a843",
              }}
            >
              Mira El Video
            </span>
            <div className="hidden md:block w-12 h-px" style={{ background: "rgba(212, 168, 67, 0.2)" }} />
            <div
              className="hidden md:flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold shrink-0"
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.3)",
              }}
            >
              2
            </div>
            <span
              className="hidden md:inline text-[11px] font-semibold uppercase"
              style={{
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.25)",
              }}
            >
              Agenda Tu Cita
            </span>
          </div>

          {/* Video player */}
          <div className="vsl-fade-4 mb-4 md:mb-5">
            <VideoPlayer
              src={VIDEO_URL}
              poster={VIDEO_POSTER || undefined}
              onVideoEvent={handleVideoEvent}
              abandonBeaconUrl="/api/video-abandon"
              abandonBeaconData={beaconData}
              autoplay
            />
          </div>

          {/* PASO 2 indicator */}
          <div className="flex items-center justify-center gap-2.5 mb-3 vsl-fade-5">
            <div
              className="flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold shrink-0"
              style={{
                background: "linear-gradient(135deg, #d4a843, #e8c45a)",
                color: "#060b18",
              }}
            >
              2
            </div>
            <span
              className="text-[11px] font-semibold uppercase"
              style={{
                letterSpacing: "0.1em",
                color: "#d4a843",
              }}
            >
              Agenda Tu Cita
            </span>
          </div>

          {/* CTA */}
          <div className="flex flex-col items-center vsl-fade-6">
            <button
              onClick={() => router.push("/step/3")}
              className="vsl-cta-btn inline-flex items-center justify-center gap-2 rounded-xl font-bold uppercase cursor-pointer whitespace-nowrap"
              style={{
                fontSize: "14px",
                padding: "14px 32px",
                letterSpacing: "0.08em",
                color: "#060b18",
                backgroundColor: "#d4a843",
                boxShadow: "0 6px 30px rgba(212, 168, 67, 0.4)",
                transition: "all 0.25s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 10px 50px rgba(212, 168, 67, 0.6)";
                e.currentTarget.style.transform = "translateY(-2px) scale(1.02)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 6px 30px rgba(212, 168, 67, 0.4)";
                e.currentTarget.style.transform = "translateY(0) scale(1)";
              }}
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              AGENDAR MI LLAMADA
            </button>

            <p
              className="text-[12px] md:text-[13px] mt-2.5"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              Vamos a evaluar juntos si este negocio encaja con tu situación.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="relative z-10 px-4 sm:px-5 py-4 text-[9px] md:text-[10px] leading-relaxed safe-bottom"
        style={{ color: "rgba(255,255,255,0.15)", borderTop: "1px solid rgba(255,255,255,0.04)" }}
      >
        <div className="max-w-3xl mx-auto space-y-1">
          <p>
            Esta página no es parte del sitio web de Facebook o Facebook Inc.
            Este sitio no está respaldado por Facebook de alguna manera. FACEBOOK es una marca registrada de FACEBOOK, Inc.
            Este sitio y esta oportunidad no están afiliados ni respaldados por Instagram.
          </p>
          <p style={{ color: "rgba(255,255,255,0.2)" }}>
            <strong>IMPORTANTE:</strong> Las ganancias mostradas son aspiracionales. Los resultados varían según capacidad individual, ética laboral, experiencia y otros factores.
          </p>
          <div className="flex flex-wrap gap-2 pt-0.5" style={{ color: "rgba(212, 168, 67, 0.3)" }}>
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

"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { lookupLead, trackVideoEvent, trackVisitorGeo } from "@/app/actions";
import VideoPlayer from "@/components/VideoPlayer";
import type { VideoEventPayload } from "@/components/VideoPlayer";

// ─── CONFIGURATION ──────────────────────────────────────
// Change these to swap the video for each funnel
const VIDEO_URL = "https://vz-2228bbe6-62d.b-cdn.net/2f9d378c-0bf6-4c91-9d9e-4bcb3fa53927/playlist.m3u8";
const VIDEO_POSTER = "";
const VIDEO_NAME = "VSL Nexfy Certificación"; // name shown in lead_activity metadata

// TODO: replace with WhatsApp link to Nexy agent once available
const HABLAR_CON_NEXY_HREF = "/step/3?intent=call-now";
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
        style={{ background: "#0B0D10" }}
      >
        <div className="w-6 h-6 border-2 border-white/10 border-t-[#4ADE80] rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main
      className="min-h-screen flex flex-col overflow-x-hidden relative"
      style={{
        background: "linear-gradient(160deg, #0B0D10 0%, #12161C 40%, #0d1a3a 65%, #0B0D10 100%)",
      }}
    >
      {/* Background depth layers */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 55%, rgba(74, 222, 128, 0.03) 0%, transparent 70%)",
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

          {/* Pre-headline */}
          <div className="text-center mb-4 md:mb-5 vsl-fade-1">
            <p
              className="text-[12px] md:text-[13px] font-semibold uppercase max-w-[640px] mx-auto"
              style={{
                letterSpacing: "0.08em",
                color: "#4ADE80",
                lineHeight: "1.5",
              }}
            >
              Estás a punto de ver algo que el 97% de las personas que hablan de IA no saben que existe.
            </p>
          </div>

          {/* Headline */}
          <div className="text-center mb-4 md:mb-5 vsl-fade-2">
            <h1
              className="text-[1.6rem] sm:text-[1.9rem] md:text-[2.4rem] lg:text-[2.7rem] font-bold text-white max-w-[760px] mx-auto"
              style={{
                lineHeight: "1.15",
                letterSpacing: "-0.02em",
                textShadow: "0 2px 20px rgba(0,0,0,0.3)",
              }}
            >
              Certificación Profesional en Sistemas de Ventas con IA — <span style={{ color: "#4ADE80" }}>Nexfy</span>
            </h1>
          </div>

          {/* Subheadline */}
          <div className="text-center mb-6 md:mb-7 vsl-fade-3">
            <p
              className="text-[14px] md:text-[16px] leading-relaxed max-w-[680px] mx-auto"
              style={{ color: "rgba(255,255,255,0.62)" }}
            >
              Mira el video completo. Lo que vas a ver no es una promesa. Es el sistema funcionando en tiempo real. Y al final vas a entender por qué esta puede ser la decisión profesional más importante que tomes este año.
            </p>
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

          {/* CTA Headline */}
          <div className="text-center mb-3 md:mb-4 vsl-fade-5">
            <h2
              className="text-[1.15rem] sm:text-[1.3rem] md:text-[1.55rem] font-bold text-white max-w-[680px] mx-auto"
              style={{
                lineHeight: "1.25",
                letterSpacing: "-0.015em",
              }}
            >
              Los cupos para esta certificación se están llenando. <span style={{ color: "#4ADE80" }}>No esperes a que se agoten para actuar.</span>
            </h2>
          </div>

          {/* CTA body copy */}
          <div className="text-center mb-6 md:mb-7 vsl-fade-6">
            <p
              className="text-[13px] md:text-[15px] leading-relaxed max-w-[640px] mx-auto"
              style={{ color: "rgba(255,255,255,0.62)" }}
            >
              El siguiente paso es hablar con <strong className="font-semibold text-white/85">Nexy</strong>, nuestro agente de inteligencia artificial, para evaluar si tu perfil califica. Si no califica, te lo decimos directamente. Si califica, accedes al portal exclusivo donde vas a ver todo lo que necesitas para tomar tu decisión.
            </p>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col items-center gap-3 vsl-fade-6">
            {/* Botón primario */}
            <a
              href={HABLAR_CON_NEXY_HREF}
              className="vsl-cta-btn inline-flex items-center justify-center gap-2 rounded-xl font-bold uppercase cursor-pointer text-center w-full max-w-[520px]"
              style={{
                fontSize: "14px",
                padding: "16px 24px",
                letterSpacing: "0.05em",
                color: "#0B0D10",
                backgroundColor: "#4ADE80",
                boxShadow: "0 6px 30px rgba(74, 222, 128, 0.4)",
                transition: "all 0.25s ease",
                lineHeight: "1.2",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 10px 50px rgba(74, 222, 128, 0.6)";
                e.currentTarget.style.transform = "translateY(-2px) scale(1.01)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 6px 30px rgba(74, 222, 128, 0.4)";
                e.currentTarget.style.transform = "translateY(0) scale(1)";
              }}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              HABLAR CON NEXY AHORA — ME LLAMAN EN 5 MINUTOS
            </a>

            {/* Botón secundario */}
            <button
              onClick={() => router.push("/step/3")}
              className="inline-flex items-center justify-center gap-2 rounded-xl font-semibold cursor-pointer text-center w-full max-w-[520px] transition-all duration-200"
              style={{
                fontSize: "13px",
                padding: "14px 24px",
                letterSpacing: "0.04em",
                color: "rgba(255,255,255,0.7)",
                background: "transparent",
                border: "1px solid rgba(74, 222, 128, 0.3)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(74, 222, 128, 0.6)";
                e.currentTarget.style.color = "#4ADE80";
                e.currentTarget.style.background = "rgba(74, 222, 128, 0.04)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(74, 222, 128, 0.3)";
                e.currentTarget.style.color = "rgba(255,255,255,0.7)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              AGENDAR MI LLAMADA CON NEXY →
            </button>

            <p
              className="text-[12px] md:text-[13px] mt-3 max-w-[560px] text-center leading-relaxed"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              Cada día que pasa, más personas se certifican y ocupan posición en un mercado que todavía tiene poca competencia. La ventana no dura para siempre.
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

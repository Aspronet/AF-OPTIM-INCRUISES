"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { lookupLead, trackVideoEvent, trackVisitorGeo } from "@/app/actions";
import VideoPlayer from "@/components/VideoPlayer";
import type { VideoEventPayload } from "@/components/VideoPlayer";
import { NexyCallOverlay } from "@/components/NexyCallOverlay";

// ─── CONFIGURATION ──────────────────────────────────────
// Change these to swap the video for each funnel
const VIDEO_URL = "https://vz-2228bbe6-62d.b-cdn.net/2f9d378c-0bf6-4c91-9d9e-4bcb3fa53927/playlist.m3u8";
const VIDEO_POSTER = "";
const VIDEO_NAME = "VSL Nexfy Certificación"; // name shown in lead_activity metadata
const REQUIRED_WATCH_SECONDS = 300; // 5 min — gates the CTA buttons
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
  const [callOpen, setCallOpen] = useState(false);
  const [leadInfo, setLeadInfo] = useState<{ email: string; name?: string; phone?: string; country?: string }>({ email: "" });
  const [watchSeconds, setWatchSeconds] = useState(0);

  const handleWatchTime = useCallback((seconds: number) => {
    setWatchSeconds((prev) => (seconds > prev ? seconds : prev));
  }, []);

  // Dev shortcut: press "9" on localhost to instantly mark the gate complete
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (typeof window === "undefined") return;
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "9") setWatchSeconds(REQUIRED_WATCH_SECONDS);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const unlocked = watchSeconds >= REQUIRED_WATCH_SECONDS;
  const remaining = Math.max(0, REQUIRED_WATCH_SECONDS - watchSeconds);
  const progressPct = Math.min(100, (watchSeconds / REQUIRED_WATCH_SECONDS) * 100);
  const remMin = Math.floor(remaining / 60);
  const remSec = Math.floor(remaining % 60);
  const remainingLabel = `${remMin}:${remSec.toString().padStart(2, "0")}`;
  const wMin = Math.floor(watchSeconds / 60);
  const wSec = Math.floor(watchSeconds % 60);
  const watchedLabel = `${wMin}:${wSec.toString().padStart(2, "0")}`;
  const totalLabel = `${Math.floor(REQUIRED_WATCH_SECONDS / 60)}:${(REQUIRED_WATCH_SECONDS % 60).toString().padStart(2, "0")}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setLeadInfo({
      email: localStorage.getItem("af_lead_email") || "",
      name: localStorage.getItem("af_lead_name") || undefined,
      phone: localStorage.getItem("af_lead_phone") || undefined,
      country: localStorage.getItem("af_lead_country") || undefined,
    });
  }, []);

  // Notify n8n when WhatsApp lead reaches the video page
  useEffect(() => {
    if (typeof window === "undefined") return;
    const phone = localStorage.getItem("af_lead_phone");
    if (!phone) return;
    fetch("https://n8n.srv1267733.hstgr.cloud/webhook/optim-video-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        email: localStorage.getItem("af_lead_email") || "",
        ts: Date.now(),
      }),
    }).catch(() => {});
  }, []);

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
    // Notify n8n when WhatsApp lead completes the video
    if (payload.event === "completed") {
      const phone = localStorage.getItem("af_lead_phone");
      if (phone) {
        fetch("https://n8n.srv1267733.hstgr.cloud/webhook/optim-video-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone,
            email,
            video_progress: 100,
            ts: Date.now(),
          }),
        }).catch(() => {});
      }
    }
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
    const emailToLookup = ref || localStorage.getItem("af_lead_email");

    if (ref) {
      localStorage.setItem("af_lead_email", ref);
    }

    if (!emailToLookup) {
      setReady(true);
      return;
    }

    // Always lookup so we can hydrate name/phone/country (used by the call action).
    // Step 1 saves these to localStorage, but ?ref deep-link entries skip Step 1.
    lookupLead(emailToLookup).then((res) => {
      if (res.ok) {
        if (res.leadId) localStorage.setItem("af_lead_id", res.leadId);
        if (res.userId) localStorage.setItem("af_owner_id", res.userId);
        if (res.name) localStorage.setItem("af_lead_name", res.name);
        if (res.phone) localStorage.setItem("af_lead_phone", res.phone);
        if (res.country) localStorage.setItem("af_lead_country", res.country);

        // Refresh in-memory state so the Retell call gets the fresh values
        setLeadInfo((prev) => ({
          email: emailToLookup,
          name: res.name || prev.name,
          phone: res.phone || prev.phone,
          country: res.country || prev.country,
        }));
      }
      setReady(true);
    });
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

          {/* Pre-headline badge */}
          <div className="text-center mb-4 md:mb-5 vsl-fade-1">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md"
              style={{
                background: "rgba(74, 222, 128, 0.08)",
                border: "1px solid rgba(74, 222, 128, 0.3)",
                boxShadow: "0 0 20px rgba(74, 222, 128, 0.06)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: "#4ADE80",
                  boxShadow: "0 0 8px rgba(74, 222, 128, 0.8)",
                }}
              />
              <span
                className="text-[12px] md:text-[13px] font-semibold uppercase"
                style={{
                  letterSpacing: "0.12em",
                  color: "#4ADE80",
                }}
              >
                PRESENTACIÓN OFICIAL — NEXFY
              </span>
            </div>
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
              Certificación Profesional en <span style={{ color: "#4ADE80" }}>Sistemas de Ventas con IA</span>
            </h1>
          </div>

          {/* Subheadline */}
          <div className="text-center mb-6 md:mb-7 vsl-fade-3">
            <p
              className="text-[14px] md:text-[16px] leading-relaxed max-w-[720px] mx-auto"
              style={{ color: "rgba(255,255,255,0.62)" }}
            >
              Mira el video completo. Lo que vas a ver no es una promesa. <span className="text-white/85">Es el sistema funcionando en tiempo real.</span>
            </p>
          </div>

          {/* Video player */}
          <div className="vsl-fade-4 mb-4 md:mb-5">
            <VideoPlayer
              src={VIDEO_URL}
              poster={VIDEO_POSTER || undefined}
              onVideoEvent={handleVideoEvent}
              onWatchTime={handleWatchTime}
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
              ¿Quieres evaluar si tu perfil califica? <span style={{ color: "#4ADE80" }}>Habla con Nexy.</span>
            </h2>
          </div>

          {/* CTA body copy */}
          <div className="text-center mb-6 md:mb-7 vsl-fade-6">
            <p
              className="text-[13px] md:text-[15px] leading-relaxed max-w-[640px] mx-auto"
              style={{ color: "rgba(255,255,255,0.62)" }}
            >
              <strong className="font-semibold text-white/85">Nexy</strong> es nuestro agente de inteligencia artificial. En 5 minutos evalúa tu perfil y te da claridad sobre cómo avanzar.
            </p>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col items-center gap-3 vsl-fade-6 w-full">
            {/* Lock progress indicator (above buttons until unlocked) */}
            {!unlocked && (
              <div className="w-full max-w-[520px] flex flex-col items-center gap-2 mb-1">
                <div className="flex items-center justify-between w-full text-[12px] md:text-[13px]">
                  <div className="flex items-center gap-2" style={{ color: "rgba(255,255,255,0.55)" }}>
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-7a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z" />
                    </svg>
                    <span>Mira el video al menos 5 min para activar el acceso</span>
                  </div>
                  <span
                    className="font-mono font-semibold tabular-nums"
                    style={{ color: "#4ADE80" }}
                  >
                    {watchedLabel} <span style={{ color: "rgba(255,255,255,0.3)" }}>/ {totalLabel}</span>
                  </span>
                </div>
                {/* Progress bar with per-minute chapter ticks */}
                <div className="relative w-full h-1.5">
                  <div
                    className="absolute inset-0 rounded-full overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out lock-progress-shimmer"
                      style={{
                        width: `${progressPct}%`,
                        background: "linear-gradient(90deg, #4ADE80 0%, #86EFAC 50%, #4ADE80 100%)",
                        boxShadow: "0 0 12px rgba(74, 222, 128, 0.4)",
                      }}
                    />
                  </div>
                  {/* Tick marks at every minute boundary */}
                  {Array.from({ length: Math.floor(REQUIRED_WATCH_SECONDS / 60) - 1 }, (_, i) => {
                    const pos = ((i + 1) * 60 / REQUIRED_WATCH_SECONDS) * 100;
                    const passed = progressPct >= pos;
                    return (
                      <div
                        key={i}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full"
                        style={{
                          left: `${pos}%`,
                          width: "3px",
                          height: "3px",
                          background: passed ? "#0B0D10" : "rgba(255,255,255,0.35)",
                          boxShadow: passed ? "0 0 0 1.5px rgba(11,13,16,0.6)" : "none",
                        }}
                      />
                    );
                  })}
                </div>
                <p
                  className="text-[10.5px] md:text-[11px] text-center mt-0.5 leading-snug"
                  style={{ color: "rgba(255,255,255,0.32)" }}
                >
                  El tiempo solo cuenta mientras el video reproduce — saltar adelante no acelera el desbloqueo.
                </p>
              </div>
            )}

            {/* Botón primario */}
            <button
              onClick={() => unlocked && leadInfo.email && setCallOpen(true)}
              disabled={!unlocked || !leadInfo.email}
              aria-disabled={!unlocked || !leadInfo.email}
              className={`vsl-cta-btn relative inline-flex items-center justify-center gap-2 rounded-xl font-bold uppercase text-center w-full max-w-[520px] transition-all duration-300 ${unlocked ? "cursor-pointer" : "cursor-not-allowed"}`}
              style={{
                fontSize: "14px",
                padding: "16px 24px",
                letterSpacing: "0.05em",
                color: unlocked ? "#0B0D10" : "rgba(255,255,255,0.4)",
                backgroundColor: unlocked ? "#4ADE80" : "rgba(74, 222, 128, 0.08)",
                boxShadow: unlocked
                  ? "0 6px 30px rgba(74, 222, 128, 0.4)"
                  : "0 0 0 1px rgba(74, 222, 128, 0.18) inset",
                lineHeight: "1.2",
                opacity: unlocked ? (leadInfo.email ? 1 : 0.5) : 1,
              }}
              onMouseEnter={(e) => {
                if (!unlocked) return;
                e.currentTarget.style.boxShadow = "0 10px 50px rgba(74, 222, 128, 0.6)";
                e.currentTarget.style.transform = "translateY(-2px) scale(1.01)";
              }}
              onMouseLeave={(e) => {
                if (!unlocked) return;
                e.currentTarget.style.boxShadow = "0 6px 30px rgba(74, 222, 128, 0.4)";
                e.currentTarget.style.transform = "translateY(0) scale(1)";
              }}
            >
              {unlocked ? (
                <>
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  HABLAR CON NEXY AHORA
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-7a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z" />
                  </svg>
                  SE DESBLOQUEA EN {remainingLabel}
                </>
              )}
            </button>

            {/* Botón secundario */}
            <button
              onClick={() => unlocked && router.push("/step/3")}
              disabled={!unlocked}
              aria-disabled={!unlocked}
              className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-center w-full max-w-[520px] transition-all duration-200 ${unlocked ? "cursor-pointer" : "cursor-not-allowed"}`}
              style={{
                fontSize: "13px",
                padding: "14px 24px",
                letterSpacing: "0.04em",
                color: unlocked ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)",
                background: "transparent",
                border: `1px solid ${unlocked ? "rgba(74, 222, 128, 0.3)" : "rgba(255,255,255,0.08)"}`,
              }}
              onMouseEnter={(e) => {
                if (!unlocked) return;
                e.currentTarget.style.borderColor = "rgba(74, 222, 128, 0.6)";
                e.currentTarget.style.color = "#4ADE80";
                e.currentTarget.style.background = "rgba(74, 222, 128, 0.04)";
              }}
              onMouseLeave={(e) => {
                if (!unlocked) return;
                e.currentTarget.style.borderColor = "rgba(74, 222, 128, 0.3)";
                e.currentTarget.style.color = "rgba(255,255,255,0.7)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              AGENDAR MI LLAMADA CON NEXY →
            </button>
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

      <NexyCallOverlay
        open={callOpen}
        onClose={() => setCallOpen(false)}
        leadEmail={leadInfo.email}
        leadName={leadInfo.name}
        leadPhone={leadInfo.phone}
        leadCountry={leadInfo.country}
      />
    </main>
  );
}

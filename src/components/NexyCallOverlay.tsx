"use client";

import { useEffect, useRef, useState } from "react";
import { RetellWebClient } from "retell-client-js-sdk";
import { startRetellCall, logRetellCallEnded } from "@/app/actions";

type Phase = "idle" | "requesting_mic" | "connecting" | "live" | "ended" | "redirecting" | "error";

const PORTAL_URL = "https://portal.nexfy.io";
const REDIRECT_DELAY_MS = 2500;

interface NexyCallOverlayProps {
  open: boolean;
  onClose: () => void;
  leadEmail: string;
  leadName?: string;
  leadPhone?: string;
  leadCountry?: string;
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function NexyCallOverlay({
  open,
  onClose,
  leadEmail,
  leadName,
  leadPhone,
  leadCountry,
}: NexyCallOverlayProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string>("");
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [endReason, setEndReason] = useState<"user" | "agent" | null>(null);
  const clientRef = useRef<RetellWebClient | null>(null);
  const callIdRef = useRef<string>("");
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userEndedRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    // Reset per-call flags so a previous run doesn't leak into a new call
    userEndedRef.current = false;
    setEndReason(null);
    setMuted(false);

    let cancelled = false;
    const client = new RetellWebClient();
    clientRef.current = client;

    client.on("call_started", () => {
      if (cancelled) return;
      setPhase("live");
      startedAtRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 1000);
    });

    client.on("call_ended", () => {
      if (cancelled) return;
      const wasUserEnded = userEndedRef.current;
      setPhase("ended");
      setEndReason(wasUserEnded ? "user" : "agent");
      setIsAgentSpeaking(false);
      if (timerRef.current) clearInterval(timerRef.current);
      const duration = startedAtRef.current
        ? Math.floor((Date.now() - startedAtRef.current) / 1000)
        : 0;
      if (callIdRef.current && leadEmail) {
        logRetellCallEnded({
          email: leadEmail,
          callId: callIdRef.current,
          durationSec: duration,
          outcome: wasUserEnded ? "cancelled_by_user" : "completed",
        }).catch(() => {});
      }
      // Auto-redirect only when Nexy ends the call (qualification completed).
      // If the user cuts the call short, stay in the modal and show options.
      if (!wasUserEnded && leadEmail) {
        setTimeout(() => {
          if (cancelled) return;
          setPhase("redirecting");
          const url = `${PORTAL_URL}/?ref=${encodeURIComponent(leadEmail)}`;
          window.location.href = url;
        }, REDIRECT_DELAY_MS);
      }
    });

    client.on("agent_start_talking", () => setIsAgentSpeaking(true));
    client.on("agent_stop_talking", () => setIsAgentSpeaking(false));
    client.on("error", (err: unknown) => {
      console.error("Retell error:", err);
      if (cancelled) return;
      setPhase("error");
      setError(typeof err === "string" ? err : "Error en la llamada");
    });

    (async () => {
      try {
        setPhase("requesting_mic");
        await navigator.mediaDevices.getUserMedia({ audio: true });

        setPhase("connecting");
        const res = await startRetellCall({
          email: leadEmail,
          name: leadName,
          phone: leadPhone,
          country: leadCountry,
        });

        if (cancelled) return;
        if (!res.ok || !res.accessToken) {
          setPhase("error");
          setError(res.error || "No se pudo iniciar la llamada");
          return;
        }
        callIdRef.current = res.callId || "";
        await client.startCall({ accessToken: res.accessToken });
      } catch (e) {
        if (cancelled) return;
        console.error("startCall error:", e);
        setPhase("error");
        setError(
          e instanceof Error && e.name === "NotAllowedError"
            ? "Necesitamos acceso al micrófono para la llamada"
            : "Error al iniciar la llamada"
        );
      }
    })();

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      try {
        client.stopCall();
      } catch {}
      clientRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const handleHangup = () => {
    userEndedRef.current = true;
    clientRef.current?.stopCall();
  };

  const toggleMute = () => {
    const c = clientRef.current as unknown as { mute?: () => void; unmute?: () => void } | null;
    if (!c) return;
    try {
      if (muted) {
        c.unmute?.();
        setMuted(false);
      } else {
        c.mute?.();
        setMuted(true);
      }
    } catch (e) {
      console.warn("mute toggle failed:", e);
    }
  };

  const handleClose = () => {
    userEndedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      clientRef.current?.stopCall();
    } catch {}
    setPhase("idle");
    setSeconds(0);
    setError("");
    setEndReason(null);
    onClose();
  };

  const statusLabel =
    phase === "live"
      ? "En vivo"
      : phase === "connecting"
        ? "Conectando"
        : phase === "ended"
          ? "Finalizada"
          : phase === "redirecting"
            ? "Redirigiendo"
            : phase === "error"
              ? "Error"
              : phase === "requesting_mic"
                ? "Permisos"
                : "Iniciando";

  const statusColor =
    phase === "live"
      ? "#4ADE80"
      : phase === "error"
        ? "#F87171"
        : phase === "ended" || phase === "redirecting"
          ? "#86EFAC"
          : "rgba(255,255,255,0.45)";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "rgba(4, 7, 11, 0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      {/* Ambient backdrop pulse */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 50% 50%, rgba(74,222,128,0.10) 0%, transparent 60%)",
          animation: phase === "live" ? "nexy-ambient 4s ease-in-out infinite" : "none",
        }}
      />

      {/* Subtle noise overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-[440px] rounded-[28px] overflow-hidden nexy-modal-in"
        style={{
          background:
            "linear-gradient(180deg, rgba(15,18,22,0.96) 0%, rgba(10,12,16,0.98) 100%)",
          border: "1px solid rgba(74, 222, 128, 0.22)",
          boxShadow:
            "0 40px 120px rgba(0,0,0,0.7), 0 0 80px rgba(74,222,128,0.18), 0 0 0 1px rgba(255,255,255,0.04) inset",
        }}
      >
        {/* Top accent shimmer */}
        <div
          className="absolute top-0 left-0 right-0 h-[1.5px] pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(74,222,128,0.8), transparent)",
            animation: phase === "live" ? "nexy-shimmer 3s ease-in-out infinite" : "none",
          }}
        />

        {/* Header: status pill + timer */}
        <div className="px-7 pt-6 pb-4 flex items-center justify-between">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{
              background:
                phase === "live"
                  ? "rgba(74,222,128,0.08)"
                  : "rgba(255,255,255,0.04)",
              border: `1px solid ${
                phase === "live"
                  ? "rgba(74,222,128,0.35)"
                  : "rgba(255,255,255,0.08)"
              }`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: statusColor,
                boxShadow:
                  phase === "live"
                    ? "0 0 10px rgba(74,222,128,0.9)"
                    : "none",
                animation:
                  phase === "live" ? "nexy-pulse-dot 1.5s ease-in-out infinite" : "none",
              }}
            />
            <span
              className="text-[10px] uppercase font-bold"
              style={{
                color: statusColor,
                letterSpacing: "0.16em",
              }}
            >
              {statusLabel}
            </span>
          </div>

          {(phase === "live" || phase === "ended") && (
            <span
              className="font-mono text-[12px] tabular-nums px-2.5 py-1 rounded-md"
              style={{
                color: "rgba(255,255,255,0.55)",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {formatDuration(seconds)}
            </span>
          )}
        </div>

        {/* Avatar / visualizer */}
        <div className="relative flex items-center justify-center pt-4 pb-6">
          {/* Outer pulse rings (live only) */}
          {phase === "live" && (
            <>
              <span
                className="absolute rounded-full pointer-events-none nexy-ring-1"
                style={{
                  width: 220,
                  height: 220,
                  border: "1px solid rgba(74,222,128,0.22)",
                }}
              />
              <span
                className="absolute rounded-full pointer-events-none nexy-ring-2"
                style={{
                  width: 220,
                  height: 220,
                  border: "1px solid rgba(74,222,128,0.14)",
                }}
              />
            </>
          )}

          {/* Main disc */}
          <div
            className="relative flex items-center justify-center rounded-full"
            style={{
              width: 144,
              height: 144,
              background:
                "radial-gradient(circle at 30% 28%, rgba(74,222,128,0.32), rgba(74,222,128,0.06) 70%)",
              border: "1.5px solid rgba(74, 222, 128, 0.45)",
              transform: isAgentSpeaking ? "scale(1.04)" : "scale(1)",
              transition: "transform 0.25s ease, box-shadow 0.3s ease",
              boxShadow: isAgentSpeaking
                ? "0 0 80px rgba(74,222,128,0.55), 0 0 0 6px rgba(74,222,128,0.10), 0 0 0 1px rgba(255,255,255,0.05) inset"
                : "0 0 30px rgba(74,222,128,0.22), 0 0 0 1px rgba(255,255,255,0.05) inset",
            }}
          >
            {/* Voice visualizer bars */}
            {phase === "live" || phase === "ended" || phase === "connecting" ? (
              <div className="flex items-center justify-center gap-1.5 h-14">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={
                      isAgentSpeaking
                        ? "nexy-bar nexy-bar-talking"
                        : phase === "live"
                          ? "nexy-bar nexy-bar-idle"
                          : "nexy-bar"
                    }
                    style={{
                      width: 4,
                      borderRadius: 2,
                      background:
                        "linear-gradient(180deg, #BBF7D0 0%, #86EFAC 50%, #4ADE80 100%)",
                      animationDelay: `${i * 0.08}s`,
                    }}
                  />
                ))}
              </div>
            ) : (
              // Connecting / requesting_mic state: spinner
              <div
                className="w-10 h-10 border-2 rounded-full"
                style={{
                  borderColor: "rgba(74,222,128,0.2)",
                  borderTopColor: "#4ADE80",
                  animation: "nexy-spin 0.9s linear infinite",
                }}
              />
            )}
          </div>
        </div>

        {/* Status text */}
        <div className="px-7 pb-1 text-center min-h-[60px]">
          <h2
            className="text-white text-[22px] font-bold mb-1"
            style={{ letterSpacing: "-0.015em" }}
          >
            Nexy
          </h2>

          {phase === "requesting_mic" && (
            <p className="text-white/55 text-[13px]">Permití el micrófono para hablar...</p>
          )}
          {phase === "connecting" && (
            <p className="text-white/55 text-[13px]">Conectando con Nexy...</p>
          )}
          {phase === "live" && (
            <div className="flex items-center justify-center gap-2 mt-0.5">
              {isAgentSpeaking ? (
                <>
                  <svg
                    className="w-3.5 h-3.5"
                    style={{ color: "#4ADE80" }}
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  </svg>
                  <span className="text-[#4ADE80] text-[13px] font-semibold">
                    Nexy está hablando
                  </span>
                </>
              ) : (
                <>
                  <svg
                    className="w-3.5 h-3.5"
                    style={{ color: "rgba(74,222,128,0.85)" }}
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                  </svg>
                  <span
                    className="text-[13px] font-semibold"
                    style={{ color: "rgba(74,222,128,0.85)" }}
                  >
                    Te está escuchando
                  </span>
                </>
              )}
            </div>
          )}
          {phase === "ended" && endReason === "agent" && (
            <>
              <p className="text-white text-[14px] font-semibold mb-1">Llamada finalizada</p>
              <p className="text-white/40 text-[12px] leading-relaxed">
                Te enviamos el acceso al portal por email.
              </p>
            </>
          )}
          {phase === "ended" && endReason === "user" && (
            <>
              <p className="text-white text-[14px] font-semibold mb-1">Llamada cancelada</p>
              <p className="text-white/40 text-[12px] leading-relaxed">
                Tu evaluación quedó incompleta. Cuando quieras, podés volver a hablar con Nexy.
              </p>
            </>
          )}
          {phase === "redirecting" && (
            <>
              <p className="text-[#4ADE80] text-[14px] font-semibold mb-1">
                Redirigiendo al portal
              </p>
              <p className="text-white/40 text-[12px]">Preparando tu acceso...</p>
            </>
          )}
          {phase === "error" && (
            <p className="text-red-400 text-[13px] leading-relaxed">{error}</p>
          )}
        </div>

        {/* Live tip */}
        {phase === "live" && (
          <div className="px-7 mt-3 mb-1">
            <div
              className="rounded-xl px-3.5 py-2.5 text-[11px] flex items-center gap-2 justify-center"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              <svg
                className="w-3.5 h-3.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                style={{ color: "rgba(74,222,128,0.7)" }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>
                Hablá normal — Nexy responde como una persona.
              </span>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="px-6 pt-4 pb-6 flex flex-col items-center gap-3">
          {phase === "live" && (
            <div className="flex items-center justify-center gap-3 w-full">
              {/* Mute toggle */}
              <button
                onClick={toggleMute}
                aria-label={muted ? "Activar micrófono" : "Silenciar micrófono"}
                className="flex items-center justify-center rounded-full transition-all cursor-pointer"
                style={{
                  width: 52,
                  height: 52,
                  background: muted ? "rgba(248, 113, 113, 0.12)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${
                    muted ? "rgba(248, 113, 113, 0.4)" : "rgba(255,255,255,0.1)"
                  }`,
                  color: muted ? "#F87171" : "rgba(255,255,255,0.7)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                {muted ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zM14.98 11.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                  </svg>
                )}
              </button>

              {/* Hangup */}
              <button
                onClick={handleHangup}
                aria-label="Terminar llamada"
                className="group relative flex items-center justify-center gap-2 rounded-full transition-all cursor-pointer flex-1 max-w-[260px]"
                style={{
                  height: 52,
                  background: "linear-gradient(180deg, #EF4444 0%, #B91C1C 100%)",
                  boxShadow:
                    "0 10px 36px rgba(220, 38, 38, 0.45), 0 0 0 1px rgba(255,255,255,0.08) inset",
                  color: "white",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px) scale(1.01)";
                  e.currentTarget.style.boxShadow =
                    "0 14px 50px rgba(220, 38, 38, 0.55), 0 0 0 1px rgba(255,255,255,0.08) inset";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0) scale(1)";
                  e.currentTarget.style.boxShadow =
                    "0 10px 36px rgba(220, 38, 38, 0.45), 0 0 0 1px rgba(255,255,255,0.08) inset";
                }}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
                </svg>
                <span className="text-[13px] font-bold tracking-wide">Terminar llamada</span>
              </button>
            </div>
          )}

          {phase === "ended" && endReason === "agent" && leadEmail && (
            <a
              href={`${PORTAL_URL}/?ref=${encodeURIComponent(leadEmail)}`}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3.5 font-bold text-[13px] uppercase transition-all"
              style={{
                background: "linear-gradient(135deg, #4ADE80 0%, #86EFAC 100%)",
                color: "#0B0D10",
                letterSpacing: "0.06em",
                boxShadow: "0 10px 36px rgba(74, 222, 128, 0.45)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px) scale(1.01)";
                e.currentTarget.style.boxShadow =
                  "0 14px 50px rgba(74, 222, 128, 0.6)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0) scale(1)";
                e.currentTarget.style.boxShadow =
                  "0 10px 36px rgba(74, 222, 128, 0.45)";
              }}
            >
              Ir al portal ahora →
            </a>
          )}

          {phase === "ended" && endReason === "user" && (
            <button
              onClick={handleClose}
              className="w-full rounded-xl py-3.5 font-semibold text-[13px] transition-all cursor-pointer"
              style={{
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.8)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
              }}
            >
              Cerrar
            </button>
          )}

          {(phase === "error" ||
            phase === "requesting_mic" ||
            phase === "connecting") && (
            <button
              onClick={handleClose}
              className="w-full rounded-xl py-3 font-semibold text-[13px] transition-all cursor-pointer"
              style={{
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.75)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              Cancelar
            </button>
          )}
        </div>

        {/* Bottom accent */}
        <div
          className="h-[1px] opacity-50"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(74,222,128,0.4), transparent)",
          }}
        />

        {/* Trust line */}
        <div className="px-6 py-3 flex items-center justify-center gap-1.5 text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-7a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z" />
          </svg>
          <span>Llamada cifrada · Powered by Nexfy</span>
        </div>
      </div>

      <style>{`
        @keyframes nexy-pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }

        @keyframes nexy-shimmer {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0); }
          100% { transform: translateX(100%); }
        }

        @keyframes nexy-ambient {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }

        @keyframes nexy-spin {
          to { transform: rotate(360deg); }
        }

        @keyframes nexy-ring-1 {
          0% { transform: scale(0.7); opacity: 0.6; }
          100% { transform: scale(1.35); opacity: 0; }
        }

        @keyframes nexy-ring-2 {
          0% { transform: scale(0.7); opacity: 0.5; }
          100% { transform: scale(1.55); opacity: 0; }
        }

        .nexy-ring-1 { animation: nexy-ring-1 3s ease-out infinite; }
        .nexy-ring-2 { animation: nexy-ring-2 3s ease-out 1.5s infinite; }

        @keyframes nexy-bar-talking {
          0%, 100% { height: 22%; }
          25% { height: 100%; }
          50% { height: 55%; }
          75% { height: 88%; }
        }

        @keyframes nexy-bar-idle {
          0%, 100% { height: 18%; }
          50% { height: 32%; }
        }

        .nexy-bar { height: 22%; }
        .nexy-bar-talking { animation: nexy-bar-talking 0.7s ease-in-out infinite; }
        .nexy-bar-idle { animation: nexy-bar-idle 2.4s ease-in-out infinite; }

        @keyframes nexy-modal-in {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .nexy-modal-in { animation: nexy-modal-in 0.32s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
}

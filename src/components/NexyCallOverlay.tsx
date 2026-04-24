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
  const clientRef = useRef<RetellWebClient | null>(null);
  const callIdRef = useRef<string>("");
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) return;

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
      setPhase("ended");
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
        }).catch(() => {});
      }
      if (leadEmail) {
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
    clientRef.current?.stopCall();
  };

  const handleClose = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      clientRef.current?.stopCall();
    } catch {}
    setPhase("idle");
    setSeconds(0);
    setError("");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(5, 8, 12, 0.92)", backdropFilter: "blur(12px)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 text-center"
        style={{
          background: "linear-gradient(180deg, #0F1216 0%, #0A0C10 100%)",
          border: "1px solid rgba(74, 222, 128, 0.25)",
          boxShadow: "0 30px 100px rgba(74, 222, 128, 0.15)",
        }}
      >
        {/* Avatar / waveform */}
        <div className="flex items-center justify-center mb-6">
          <div
            className="relative flex items-center justify-center rounded-full"
            style={{
              width: 120,
              height: 120,
              background: "radial-gradient(circle, rgba(74,222,128,0.2) 0%, rgba(74,222,128,0.05) 70%)",
              border: "2px solid rgba(74, 222, 128, 0.4)",
              transform: isAgentSpeaking ? "scale(1.05)" : "scale(1)",
              transition: "transform 0.15s ease",
              boxShadow: isAgentSpeaking
                ? "0 0 60px rgba(74, 222, 128, 0.6)"
                : "0 0 20px rgba(74, 222, 128, 0.2)",
            }}
          >
            <span style={{ fontSize: 56 }}>🤖</span>
            {phase === "live" && (
              <span
                className="absolute -bottom-1 -right-1 rounded-full"
                style={{
                  width: 18,
                  height: 18,
                  background: "#4ADE80",
                  border: "3px solid #0F1216",
                  animation: "pulse 2s ease-in-out infinite",
                }}
              />
            )}
          </div>
        </div>

        <h2 className="text-white text-xl font-bold mb-2">Nexy</h2>

        {phase === "requesting_mic" && (
          <p className="text-white/70 text-sm">Permití el micrófono para hablar...</p>
        )}
        {phase === "connecting" && (
          <p className="text-white/70 text-sm">Conectando con Nexy...</p>
        )}
        {phase === "live" && (
          <>
            <p className="text-[#4ADE80] text-sm font-semibold mb-1">
              {isAgentSpeaking ? "Hablando..." : "Escuchando..."}
            </p>
            <p className="text-white/50 text-xs font-mono">{formatDuration(seconds)}</p>
          </>
        )}
        {phase === "ended" && (
          <>
            <p className="text-white text-sm mb-1">Llamada finalizada</p>
            <p className="text-white/50 text-xs">Gracias por hablar con Nexy. Te llevamos al portal...</p>
          </>
        )}
        {phase === "redirecting" && (
          <>
            <p className="text-[#4ADE80] text-sm font-semibold mb-1">Redirigiendo al portal</p>
            <p className="text-white/50 text-xs">Preparando tu acceso...</p>
          </>
        )}
        {phase === "error" && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        {/* Controls */}
        <div className="mt-8 flex flex-col gap-3">
          {phase === "live" && (
            <button
              onClick={handleHangup}
              className="w-full rounded-xl py-3 font-semibold text-white transition-all"
              style={{
                background: "#DC2626",
                boxShadow: "0 6px 24px rgba(220, 38, 38, 0.4)",
              }}
            >
              Terminar llamada
            </button>
          )}
          {phase === "ended" && leadEmail && (
            <a
              href={`${PORTAL_URL}/?ref=${encodeURIComponent(leadEmail)}`}
              className="w-full rounded-xl py-3 font-semibold transition-all block text-center"
              style={{ background: "#4ADE80", color: "#0B0D10" }}
            >
              Ir al portal ahora →
            </a>
          )}
          {(phase === "error" || phase === "requesting_mic" || phase === "connecting") && (
            <button
              onClick={handleClose}
              className="w-full rounded-xl py-3 font-semibold transition-all"
              style={{
                background: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.8)",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

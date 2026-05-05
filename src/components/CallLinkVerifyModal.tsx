"use client";

import { useEffect, useRef, useState } from "react";
import { requestCallLink } from "@/app/actions";

interface Props {
  open: boolean;
  onClose: () => void;
  initialEmail: string;
  initialPhone?: string;
  initialName?: string;
  initialCountry?: string;
}

type Phase = "form" | "submitting" | "redirecting" | "error";

const REDIRECT_DELAY_MS = 600; // brief visual confirmation before navigating away

export function CallLinkVerifyModal({
  open,
  onClose,
  initialEmail,
  initialPhone = "",
  initialName = "",
  initialCountry,
}: Props) {
  const [phase, setPhase] = useState<Phase>("form");
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (!open) return;
    setPhase("form");
    setError("");
    setEmail(initialEmail);
    setPhone(initialPhone);
    setName(initialName);
  }, [open, initialEmail, initialPhone, initialName]);

  // Esc to close (only when not actively submitting/redirecting)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "submitting" && phase !== "redirecting") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, phase, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimEmail = email.trim().toLowerCase();
    const trimPhone = phone.trim();
    const trimName = name.trim();

    if (!trimEmail || !trimPhone || !trimName) {
      setError("Completá todos los campos.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) {
      setError("El email no parece válido.");
      return;
    }
    if (trimPhone.replace(/\D/g, "").length < 8) {
      setError("Tu teléfono se ve corto. Revisalo.");
      return;
    }

    setPhase("submitting");
    try {
      const res = await requestCallLink({
        email: trimEmail,
        phone: trimPhone,
        name: trimName,
        country: initialCountry,
      });
      if (!res.ok || !res.callUrl) {
        setError(res.error || "Algo salió mal. Probá de nuevo.");
        setPhase("error");
        return;
      }
      // Persist updated values for downstream steps
      try {
        localStorage.setItem("af_lead_email", trimEmail);
        localStorage.setItem("af_lead_name", trimName);
        localStorage.setItem("af_lead_phone", trimPhone);
      } catch {}
      // Brief confirmation, then go straight to call.nexfy.io.
      // The email is fire-and-forget (backup if user comes back later).
      setPhase("redirecting");
      const target = res.callUrl;
      setTimeout(() => {
        window.location.href = target;
      }, REDIRECT_DELAY_MS);
    } catch (err) {
      console.error("requestCallLink error:", err);
      setError("Error de red. Reintentá en un momento.");
      setPhase("error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "rgba(4, 7, 11, 0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && phase !== "submitting" && phase !== "redirecting") onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-[440px] rounded-3xl overflow-hidden vp-modal-in"
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
              "linear-gradient(90deg, transparent, rgba(74,222,128,0.7), transparent)",
          }}
        />

        {/* Close button */}
        {phase !== "submitting" && phase !== "redirecting" && (
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full transition-all cursor-pointer z-10"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.55)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              e.currentTarget.style.color = "rgba(255,255,255,0.85)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              e.currentTarget.style.color = "rgba(255,255,255,0.55)";
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        <div className="p-7 md:p-9">
          {/* ─── Form ─── */}
          {(phase === "form" || phase === "submitting" || phase === "error") && (
            <form onSubmit={handleSubmit}>
              {/* Pill */}
              <div className="flex justify-center mb-5">
                <span
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                  style={{
                    background: "rgba(74,222,128,0.08)",
                    border: "1px solid rgba(74,222,128,0.3)",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: "#4ADE80",
                      boxShadow: "0 0 8px rgba(74,222,128,0.8)",
                    }}
                  />
                  <span
                    className="text-[10px] font-bold uppercase"
                    style={{ color: "#4ADE80", letterSpacing: "0.16em" }}
                  >
                    Último paso
                  </span>
                </span>
              </div>

              {/* Title */}
              <h2
                className="text-center mb-2"
                style={{
                  fontFamily: "var(--font-satoshi)",
                  fontWeight: 700,
                  fontSize: "24px",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                  color: "var(--nexfy-text)",
                }}
              >
                Confirmá tus datos
              </h2>

              <p
                className="text-center mb-7"
                style={{
                  color: "var(--nexfy-text-tertiary)",
                  fontSize: "14px",
                  lineHeight: 1.55,
                }}
              >
                Te vamos a enviar el link por <strong style={{ color: "var(--nexfy-text)" }}>email</strong> para que tengas tu sala privada con Nexy. Asegurate de que estos datos sean correctos.
              </p>

              {/* Fields */}
              <div className="space-y-3.5 mb-6">
                <Field label="Nombre completo">
                  <input
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={phase === "submitting"}
                    placeholder="Tu nombre y apellido"
                    className="input"
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={phase === "submitting"}
                    placeholder="tu@email.com"
                    className="input"
                  />
                </Field>
                <Field label="WhatsApp / Teléfono">
                  <input
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={phase === "submitting"}
                    placeholder="+54 9 11 ..."
                    className="input"
                  />
                </Field>
              </div>

              {error && phase === "error" && (
                <div
                  className="rounded-xl px-3 py-2.5 mb-4 text-[13px]"
                  style={{
                    background: "rgba(248,113,113,0.08)",
                    border: "1px solid rgba(248,113,113,0.3)",
                    color: "#FCA5A5",
                  }}
                >
                  {error}
                </div>
              )}

              {error && phase === "form" && (
                <p className="text-[12px] mb-3 text-center" style={{ color: "#FCA5A5" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={phase === "submitting"}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3.5 font-bold text-[13px] uppercase transition-all cursor-pointer btn-shimmer"
                style={{
                  color: "#0B0D10",
                  letterSpacing: "0.06em",
                  boxShadow: "0 10px 36px rgba(74, 222, 128, 0.4)",
                  opacity: phase === "submitting" ? 0.7 : 1,
                }}
              >
                {phase === "submitting" ? (
                  <>
                    <span
                      className="inline-block w-4 h-4 border-2 rounded-full"
                      style={{
                        borderColor: "rgba(11,13,16,0.25)",
                        borderTopColor: "#0B0D10",
                        animation: "nexy-spin 0.8s linear infinite",
                      }}
                    />
                    Enviando link...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M2 5C2 3.9 2.9 3 4 3h16c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V5zm2 0v.4l8 4.6 8-4.6V5H4zm0 2.6V19h16V7.6l-8 4.6-8-4.6z" />
                    </svg>
                    Enviarme el link al email
                  </>
                )}
              </button>

              <p
                className="text-center mt-3 text-[11px]"
                style={{ color: "var(--nexfy-text-muted)" }}
              >
                Llamada cifrada · Solo audio · Powered by Nexfy
              </p>
            </form>
          )}

          {/* ─── Redirecting to call.nexfy.io ─── */}
          {phase === "redirecting" && (
            <div className="text-center">
              <div className="flex justify-center mb-5">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{
                    background:
                      "radial-gradient(circle at 30% 28%, rgba(74,222,128,0.32), rgba(74,222,128,0.06) 70%)",
                    border: "1.5px solid rgba(74, 222, 128, 0.45)",
                    boxShadow: "0 0 30px rgba(74,222,128,0.3)",
                  }}
                >
                  <span
                    className="inline-block w-7 h-7 border-[3px] rounded-full"
                    style={{
                      borderColor: "rgba(74,222,128,0.18)",
                      borderTopColor: "#4ADE80",
                      animation: "nexy-spin 0.85s linear infinite",
                    }}
                  />
                </div>
              </div>

              <h2
                style={{
                  fontFamily: "var(--font-satoshi)",
                  fontWeight: 700,
                  fontSize: "22px",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                  color: "var(--nexfy-text)",
                }}
                className="mb-2"
              >
                Conectándote con Nexy…
              </h2>
              <p
                className="mb-5"
                style={{
                  color: "var(--nexfy-text-tertiary)",
                  fontSize: "14px",
                  lineHeight: 1.6,
                }}
              >
                Te llevamos a tu sala privada. Si no se abre sola en 2 segundos, tocá el botón.
              </p>

              <p
                className="text-[11px] mb-4"
                style={{ color: "var(--nexfy-text-muted)" }}
              >
                También te mandamos el link por email a{" "}
                <strong style={{ color: "var(--nexfy-text-secondary)" }}>{email}</strong> por si necesitás volver más tarde.
              </p>
            </div>
          )}
        </div>

        {/* Bottom trust line */}
        <div
          className="px-6 py-3 flex items-center justify-center gap-1.5 text-[10px]"
          style={{
            color: "rgba(255,255,255,0.25)",
            borderTop: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-7a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z"
            />
          </svg>
          <span>Tus datos están protegidos</span>
        </div>
      </div>

      <style>{`
        @keyframes nexy-spin { to { transform: rotate(360deg); } }
        @keyframes vp-modal-in {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .vp-modal-in { animation: vp-modal-in 0.32s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span
        className="block text-[11px] font-semibold uppercase mb-1.5"
        style={{
          color: "var(--nexfy-text-tertiary)",
          letterSpacing: "0.1em",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

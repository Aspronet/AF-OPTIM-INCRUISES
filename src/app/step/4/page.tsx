"use client";

import { useEffect, useState } from "react";

interface BookingData {
  date: string;
  time: string;
  host: string;
  duration: number;
  timezone: string;
}

function formatSlotTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export default function Step4() {
  const [booking, setBooking] = useState<BookingData | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("af_booking");
    if (raw) {
      try { setBooking(JSON.parse(raw)); } catch {}
    }
  }, []);

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-5 py-8 safe-top safe-bottom"
      style={{
        background: "linear-gradient(160deg, #060b18 0%, #0a1230 40%, #0d1a3a 65%, #060b18 100%)",
      }}
    >
      <div className="w-full max-w-md text-center">
        {/* Success icon */}
        <div
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: "rgba(34, 197, 94, 0.1)" }}
        >
          <svg
            className="w-10 h-10"
            style={{ color: "#22c55e" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1
          className="text-xl md:text-2xl font-bold text-white mb-3"
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
        >
          ¡Listo! Tu llamada está confirmada.
        </h1>

        <p
          className="text-sm mb-8 leading-relaxed"
          style={{
            fontFamily: "var(--font-inter), sans-serif",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          Vas a recibir un mensaje por WhatsApp con los detalles. Prepara tus preguntas — vamos a aprovechar cada minuto. ¡Nos vemos en la llamada!
        </p>

        {/* Booking details card */}
        {booking && (
          <div
            className="text-left rounded-xl p-5"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>Fecha y hora</span>
                <span className="text-[13px] font-medium text-right capitalize text-white">
                  {booking.date}
                  <br />
                  <span style={{ color: "#d4a843" }}>{formatSlotTime(booking.time)}</span>
                </span>
              </div>
              <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
              <div className="flex justify-between">
                <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>Duración</span>
                <span className="text-[13px] font-medium text-white">{booking.duration} min</span>
              </div>
              <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
              <div className="flex justify-between">
                <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>Con</span>
                <span className="text-[13px] font-medium text-white">{booking.host}</span>
              </div>
              <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
              <div className="flex justify-between">
                <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>Zona horaria</span>
                <span className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
                  {booking.timezone?.replace(/_/g, " ")}
                </span>
              </div>
            </div>
          </div>
        )}

        <p
          className="text-[11px] mt-6"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          Puedes cerrar esta página. Te contactaremos por WhatsApp o email.
        </p>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { trackFunnelStep } from "@/app/actions";

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
    // Track stage
    const email = localStorage.getItem("af_lead_email");
    if (email) trackFunnelStep(email, "llamada_filtro");

    // Read booking data from Step 3
    const raw = localStorage.getItem("af_booking");
    if (raw) {
      try { setBooking(JSON.parse(raw)); } catch {}
    }
  }, []);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-8"
      style={{ fontFamily: "Inter, sans-serif", backgroundColor: "#0A0A0A" }}
    >
      <div
        className="w-full max-w-md overflow-hidden"
        style={{
          borderRadius: 16,
          backgroundColor: "#1A1A1A",
          boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
          border: "1px solid #2A2A2A",
        }}
      >
        <div className="flex flex-col items-center gap-5 p-8 text-center">
          {/* Success icon */}
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(34, 197, 94, 0.1)" }}
          >
            <svg
              className="w-8 h-8"
              style={{ color: "#22C55E" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div>
            <h1 className="text-[20px] font-bold mb-1" style={{ color: "#F5F5F5" }}>
              ¡Reunión agendada!
            </h1>
            <p className="text-[13px]" style={{ color: "#A3A3A3" }}>
              Recibirás un recordatorio antes de la llamada
            </p>
          </div>

          {/* Booking details */}
          {booking && (
            <div
              className="w-full flex flex-col gap-3 text-left"
              style={{
                padding: 20,
                borderRadius: 12,
                backgroundColor: "#141414",
                border: "1px solid #2A2A2A",
              }}
            >
              <div className="flex justify-between items-start">
                <span className="text-[12px]" style={{ color: "#737373" }}>Fecha y hora</span>
                <span className="text-[13px] font-medium text-right capitalize" style={{ color: "#F5F5F5" }}>
                  {booking.date}
                  <br />
                  <span style={{ color: "#F59E0B" }}>{formatSlotTime(booking.time)}</span>
                </span>
              </div>
              <div className="h-px" style={{ backgroundColor: "#2A2A2A" }} />
              <div className="flex justify-between">
                <span className="text-[12px]" style={{ color: "#737373" }}>Duración</span>
                <span className="text-[13px] font-medium" style={{ color: "#F5F5F5" }}>
                  {booking.duration} min
                </span>
              </div>
              <div className="h-px" style={{ backgroundColor: "#2A2A2A" }} />
              <div className="flex justify-between">
                <span className="text-[12px]" style={{ color: "#737373" }}>Con</span>
                <span className="text-[13px] font-medium" style={{ color: "#F5F5F5" }}>
                  {booking.host}
                </span>
              </div>
              <div className="h-px" style={{ backgroundColor: "#2A2A2A" }} />
              <div className="flex justify-between">
                <span className="text-[12px]" style={{ color: "#737373" }}>Zona horaria</span>
                <span className="text-[13px] font-medium" style={{ color: "#D4D4D4" }}>
                  {booking.timezone?.replace(/_/g, " ")}
                </span>
              </div>
            </div>
          )}

          <p className="text-[11px] pt-2" style={{ color: "#525252" }}>
            Podés cerrar esta página. Te contactaremos por WhatsApp o email.
          </p>
        </div>
      </div>

      <div className="mt-6 text-center">
        <span className="text-[11px]" style={{ color: "#525252" }}>Powered by AsproFunnel</span>
      </div>
    </div>
  );
}

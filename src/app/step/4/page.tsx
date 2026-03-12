"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { trackFunnelStep } from "@/app/actions";

export default function Step4() {
  const router = useRouter();

  // Track: lead confirmó la llamada → Paso 2: Confirmación día de qual call
  useEffect(() => {
    const email = localStorage.getItem("af_lead_email");
    if (email) trackFunnelStep(email, "day_qual_conf");
  }, []);

  // Auto-redirect after a few seconds (like "One Moment...")
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/step/5");
    }, 4000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="min-h-screen bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
        {/* Checkmark */}
        <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-1">
          Reserva confirmada
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          Tienes una cita con <span className="font-medium">Pablo Collomb</span>
        </p>

        {/* Appointment Details */}
        <div className="border border-gray-200 rounded-xl p-5 text-left space-y-3 mb-6">
          <h3 className="text-lg font-bold text-gray-900">
            Llamada de Calificación
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>15 min Appointment</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>10:45 AM - 11:00 AM &nbsp; mar, 10 de marzo</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
            </svg>
            <span>Zona horaria local</span>
          </div>
        </div>

        {/* Loading / Redirect */}
        <p className="text-gray-400 text-sm animate-pulse">One Moment...</p>
      </div>
    </main>
  );
}

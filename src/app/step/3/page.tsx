"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trackFunnelStep } from "@/app/actions";

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = lastDay.getDate();

  const days: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  return days;
}

const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const AVAILABLE_TIMES = ["10:45 AM", "11:15 AM", "11:45 AM", "12:15 PM", "1:00 PM", "1:30 PM"];

export default function Step3() {
  const router = useRouter();
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const days = getCalendarDays(currentYear, currentMonth);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDay(null);
    setSelectedTime(null);
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDay(null);
    setSelectedTime(null);
  };

  const handleConfirm = async () => {
    if (selectedDay && selectedTime) {
      // Track: lead agendó llamada de calificación → Paso 2: Confirmación Qual Call
      const email = localStorage.getItem("af_lead_email");
      if (email) await trackFunnelStep(email, "48hr_qual_conf");
      router.push("/step/4");
    }
  };

  const selectedDateLabel = selectedDay
    ? `${DAYS_OF_WEEK[(new Date(currentYear, currentMonth, selectedDay).getDay() + 6) % 7].toLowerCase()}, ${selectedDay} de ${MONTH_NAMES[currentMonth]}`
    : null;

  return (
    <main className="min-h-screen bg-white text-gray-900 flex flex-col">
      {/* Hero */}
      <section className="bg-white px-4 pt-10 pb-6 text-center">
        <h1 className="text-2xl md:text-4xl font-bold leading-tight mb-3">
          Estás A Un Paso de Certificarte Como Vendedor Digital
        </h1>
        <p className="text-gray-600 text-base md:text-lg max-w-2xl mx-auto">
          Mira el video y completa el formulario en esta página para reservar tu
          consultoría gratuita
        </p>
      </section>

      {/* Video */}
      <section className="px-4 pb-8 flex justify-center">
        <div className="relative w-full max-w-3xl aspect-video bg-gray-900 rounded-lg overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-white/20 rounded-full flex items-center justify-center cursor-pointer hover:bg-white/30 transition">
              <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-white border-b-[12px] border-b-transparent ml-1" />
            </div>
          </div>
          {/* Reemplazar con iframe real del video */}
        </div>
      </section>

      {/* Booking Widget */}
      <section className="px-4 pb-12 flex justify-center">
        <div className="w-full max-w-3xl bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-gray-100">
            <p className="text-sm text-gray-500">Digital Entrepreneur</p>
            <h2 className="text-xl font-bold">Llamada de Calificación</h2>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                15 min Appointment
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                {selectedDateLabel || "Selecciona una fecha"}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" /></svg>
                Zona horaria
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-4">
              Tendrás una llamada con nuestro oficial de admisiones para
              determinar si cumples con todos los requisitos para ser parte de
              nuestra Academia de Ventas Digitales.
            </p>
          </div>

          {/* Calendar + Times */}
          <div className="flex flex-col md:flex-row">
            {/* Calendar */}
            <div className="p-6 md:border-r border-gray-100 flex-1">
              <div className="flex items-center gap-1 mb-4">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span className="font-medium">Seleccionar un día</span>
              </div>

              <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="font-medium capitalize">
                  {MONTH_NAMES[currentMonth]} {currentYear}
                </span>
                <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-sm">
                {DAYS_OF_WEEK.map((d) => (
                  <div key={d} className="font-medium text-gray-500 py-1">{d}</div>
                ))}
                {days.map((day, i) => (
                  <div key={i} className="py-1">
                    {day ? (
                      <button
                        onClick={() => { setSelectedDay(day); setSelectedTime(null); }}
                        className={`w-9 h-9 rounded-full text-sm font-medium transition ${
                          selectedDay === day
                            ? "bg-blue-600 text-white"
                            : "hover:bg-gray-100 text-gray-700"
                        }`}
                      >
                        {day}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>

              {/* Timezone */}
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                <span>Zona horaria</span>
                <select className="border border-gray-200 rounded px-2 py-1 text-sm bg-white">
                  <option>America/Argentina/Buenos_Aires</option>
                  <option>America/New_York</option>
                  <option>America/Mexico_City</option>
                  <option>America/Bogota</option>
                  <option>Europe/Madrid</option>
                </select>
              </div>
            </div>

            {/* Time Slots */}
            {selectedDay && (
              <div className="p-6 flex-1">
                <p className="font-medium mb-4 capitalize">
                  {selectedDateLabel}
                </p>
                <div className="space-y-2">
                  {AVAILABLE_TIMES.map((time) => (
                    <button
                      key={time}
                      onClick={() => setSelectedTime(time)}
                      className={`w-full py-3 rounded-lg border text-sm font-medium transition ${
                        selectedTime === time
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-blue-600 text-blue-600 hover:bg-blue-50"
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
                {selectedTime && (
                  <button
                    onClick={handleConfirm}
                    className="w-full mt-4 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
                  >
                    Confirmar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer / Disclaimers */}
      <footer className="bg-gray-50 border-t border-gray-200 px-4 py-8 text-sm text-gray-500 leading-relaxed">
        <div className="max-w-4xl mx-auto space-y-4">
          <p>
            Este sitio no es parte de los sitios web de Facebook o Instagram.
            Adicionalmente, este sitio NO esta respaldado por Facebook o
            Instagram de alguna manera. FACEBOOK es una marca registrada de
            Meta, Inc.
          </p>
          <p>
            Digital Entrepreneur LLC y este entrenamiento y oportunidad no esta
            afiliado con ni esta respaldado por Instagram.
          </p>
          <p className="font-semibold text-gray-700">
            IMPORTANTE: Disclaimers legales y de ganancias
          </p>
          <p>
            * Las ganancias y representaciones de ingresos hechas por Digital
            Entrepreneur LLC y sus promotores/patrocinadores/miembros/dueños son
            exclusivamente de uso aspiracional para tu potencial de ingresos. El
            éxito de Digital Entrepreneur LLC, los testimonios y otros ejemplos
            usados no son comunes y no estan hechos para ser, ni son una garantía
            de que tu u otras personas van a lograr los mismos resultados. Los
            resultados de cada individuo siempre van a variar y van a depender de
            tu capacidad individual, ética laboral, habilidades de negocio,
            experiencia, nivel de motivación, diligencia en aplicar los programas
            de Digital Entrepreneur LLC, la economía, los riesgos normales e
            imprevistos de hacer negocios, y otros factores.
          </p>
          <p>
            Digital Entrepreneur LLC no es responsable de tus acciones. Eres el
            único responsable de tus propias acciones y decisiones y la
            evaluación y uso de nuestros productos y servicios se debe basar en
            tu propia diligencia. Aceptas que Digital Entrepreneur LLC no es
            responsable de tus resultados al usar nuestros productos y servicios.
            Revisa nuestros Términos & Condiciones para nuestro disclaimer
            completo de responsabilidad y otras restricciones.
          </p>
          <p>
            ¿Tienes preguntas sobre cualquiera de los programas de Digital
            Entrepreneur LLC? ¿Te estas preguntando si los programas van a
            funcionar para ti? Envíanos un email a info@emprendedordigital.co y
            estaremos felices de discutir tus objetivos y mostrarte como nuestros
            programas podrían ayudarte.
          </p>
          <p>
            Dirección del negocio: 1309 Coffeen Ave Ste 1200 Sheridan, WY 82801
          </p>
          <div className="flex flex-wrap gap-2 text-blue-500">
            <a href="#" className="hover:underline">*Disclaimer de Ingresos</a>
            <span className="text-gray-400">|</span>
            <a href="#" className="hover:underline">Política de Privacidad</a>
            <span className="text-gray-400">|</span>
            <a href="#" className="hover:underline">Terminos de Servicio</a>
            <span className="text-gray-400">|</span>
            <a href="#" className="hover:underline">Política de Reembolsos</a>
          </div>
          <p className="text-center text-gray-400">
            © 2026 Digital Entrepreneur LLC - Todos los derechos reservados
          </p>
        </div>
      </footer>
    </main>
  );
}

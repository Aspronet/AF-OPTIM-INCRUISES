"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { trackFunnelStep, confirmNexyBooking } from "@/app/actions";

// ── Nexy availability config ──
// Lun-Vie, 06:00 a 21:00 cada hora (en TZ del lead). Hora 22 excluida
// para evitar que la llamada se pase del límite del día. Cambiar
// NEXY_HOUR_START/END acá si marketing pide ajustar la ventana.
const NEXY_HOST_NAME = "Nexy";
const NEXY_DURATION_MIN = 7;
const NEXY_AVAILABLE_DAYS = new Set([1, 2, 3, 4, 5]); // Mon-Fri (JS day-of-week, 0=Sun)
const NEXY_HOUR_START = 6;
const NEXY_HOUR_END = 22; // exclusive
const NEXY_BOOKING_BUFFER_MS = 60 * 60 * 1000; // no permitir bookings dentro de la próxima hora
const NEXY_MAX_LOOKAHEAD_DAYS = 14;

const NEXY_BASE_SLOTS = Array.from({ length: NEXY_HOUR_END - NEXY_HOUR_START }, (_, i) => {
  const h = NEXY_HOUR_START + i;
  return `${String(h).padStart(2, "0")}:00`;
});

// ── Helpers ──

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];
const DAY_HEADERS = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

const SUPABASE_URL = "https://lzqzymvzgxdgrhghepyy.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6cXp5bXZ6Z3hkZ3JoZ2hlcHl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDA0NDQsImV4cCI6MjA5MjYxNjQ0NH0.6sF__jhX_Xah3M6Xmd9phdrU5-fXzvJoGrtvGkzcQbM";

function getCalendarDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatSlotTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function formatTimezone(tz?: string): { city: string; iana: string } {
  if (!tz) return { city: "", iana: "" };
  const parts = tz.split("/");
  const last = parts[parts.length - 1] || tz;
  const city = last.replace(/_/g, " ");
  return { city, iana: tz.replace(/_/g, " ") };
}

// ── Booking time helpers ──

function parseBookingTimestamp(rawDate: string, time: string): number {
  const [y, m, d] = rawDate.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h, min, 0, 0).getTime();
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Empieza ahora";
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function pad2(n: number): string { return n.toString().padStart(2, "0"); }

function buildGcalUrl(rawDate: string, time: string, durationMin: number, host: string, tz: string): string {
  const [y, m, d] = rawDate.split("-");
  const [hh, mm] = time.split(":").map(Number);
  const start = `${y}${m}${d}T${pad2(hh)}${pad2(mm)}00`;
  const endMins = hh * 60 + mm + durationMin;
  const endH = Math.floor(endMins / 60) % 24;
  const endM = endMins % 60;
  const end = `${y}${m}${d}T${pad2(endH)}${pad2(endM)}00`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: "Llamada de evaluación con Nexy — Nexfy",
    dates: `${start}/${end}`,
    details: `Evaluación de 15 minutos con ${host} (Nexfy). No es una llamada de ventas — es un filtro real.`,
    ctz: tz || "America/Argentina/Buenos_Aires",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildIcs(rawDate: string, time: string, durationMin: number, host: string, tz: string): string {
  const [y, m, d] = rawDate.split("-");
  const [hh, mm] = time.split(":").map(Number);
  const start = `${y}${m}${d}T${pad2(hh)}${pad2(mm)}00`;
  const endMins = hh * 60 + mm + durationMin;
  const endH = Math.floor(endMins / 60) % 24;
  const endM = endMins % 60;
  const end = `${y}${m}${d}T${pad2(endH)}${pad2(endM)}00`;
  const now = new Date();
  const dtstamp = `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}T${pad2(now.getUTCHours())}${pad2(now.getUTCMinutes())}${pad2(now.getUTCSeconds())}Z`;
  const tzid = tz || "America/Argentina/Buenos_Aires";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nexfy//Funnel//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:nexfy-${Date.now()}@nexfy.io`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=${tzid}:${start}`,
    `DTEND;TZID=${tzid}:${end}`,
    "SUMMARY:Llamada de evaluación con Nexy — Nexfy",
    `DESCRIPTION:Evaluación de 15 minutos con ${host} (Nexfy). No es una llamada de ventas — es un filtro real.`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function downloadIcs(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Countries with flags ──

const PRIORITY_COUNTRIES = [
  { name: "Chile", flag: "🇨🇱" },
  { name: "Perú", flag: "🇵🇪" },
  { name: "Colombia", flag: "🇨🇴" },
  { name: "México", flag: "🇲🇽" },
  { name: "Argentina", flag: "🇦🇷" },
  { name: "Estados Unidos", flag: "🇺🇸" },
];

const OTHER_COUNTRIES = [
  { name: "Alemania", flag: "🇩🇪" },
  { name: "Arabia Saudita", flag: "🇸🇦" },
  { name: "Australia", flag: "🇦🇺" },
  { name: "Austria", flag: "🇦🇹" },
  { name: "Bélgica", flag: "🇧🇪" },
  { name: "Bolivia", flag: "🇧🇴" },
  { name: "Brasil", flag: "🇧🇷" },
  { name: "Bulgaria", flag: "🇧🇬" },
  { name: "Canadá", flag: "🇨🇦" },
  { name: "China", flag: "🇨🇳" },
  { name: "Corea del Sur", flag: "🇰🇷" },
  { name: "Costa Rica", flag: "🇨🇷" },
  { name: "Croacia", flag: "🇭🇷" },
  { name: "Cuba", flag: "🇨🇺" },
  { name: "Dinamarca", flag: "🇩🇰" },
  { name: "Ecuador", flag: "🇪🇨" },
  { name: "Egipto", flag: "🇪🇬" },
  { name: "El Salvador", flag: "🇸🇻" },
  { name: "Emiratos Árabes", flag: "🇦🇪" },
  { name: "Eslovaquia", flag: "🇸🇰" },
  { name: "Eslovenia", flag: "🇸🇮" },
  { name: "España", flag: "🇪🇸" },
  { name: "Filipinas", flag: "🇵🇭" },
  { name: "Finlandia", flag: "🇫🇮" },
  { name: "Francia", flag: "🇫🇷" },
  { name: "Grecia", flag: "🇬🇷" },
  { name: "Guatemala", flag: "🇬🇹" },
  { name: "Haití", flag: "🇭🇹" },
  { name: "Honduras", flag: "🇭🇳" },
  { name: "Hungría", flag: "🇭🇺" },
  { name: "India", flag: "🇮🇳" },
  { name: "Indonesia", flag: "🇮🇩" },
  { name: "Irlanda", flag: "🇮🇪" },
  { name: "Israel", flag: "🇮🇱" },
  { name: "Italia", flag: "🇮🇹" },
  { name: "Japón", flag: "🇯🇵" },
  { name: "Kenia", flag: "🇰🇪" },
  { name: "Malasia", flag: "🇲🇾" },
  { name: "Marruecos", flag: "🇲🇦" },
  { name: "Nicaragua", flag: "🇳🇮" },
  { name: "Nigeria", flag: "🇳🇬" },
  { name: "Noruega", flag: "🇳🇴" },
  { name: "Nueva Zelanda", flag: "🇳🇿" },
  { name: "Países Bajos", flag: "🇳🇱" },
  { name: "Panamá", flag: "🇵🇦" },
  { name: "Paraguay", flag: "🇵🇾" },
  { name: "Polonia", flag: "🇵🇱" },
  { name: "Portugal", flag: "🇵🇹" },
  { name: "Puerto Rico", flag: "🇵🇷" },
  { name: "Reino Unido", flag: "🇬🇧" },
  { name: "Rep. Checa", flag: "🇨🇿" },
  { name: "Rep. Dominicana", flag: "🇩🇴" },
  { name: "Rumanía", flag: "🇷🇴" },
  { name: "Rusia", flag: "🇷🇺" },
  { name: "Singapur", flag: "🇸🇬" },
  { name: "Sudáfrica", flag: "🇿🇦" },
  { name: "Suecia", flag: "🇸🇪" },
  { name: "Suiza", flag: "🇨🇭" },
  { name: "Tailandia", flag: "🇹🇭" },
  { name: "Turquía", flag: "🇹🇷" },
  { name: "Ucrania", flag: "🇺🇦" },
  { name: "Uruguay", flag: "🇺🇾" },
  { name: "Venezuela", flag: "🇻🇪" },
  { name: "Vietnam", flag: "🇻🇳" },
  { name: "Otro país", flag: "🌍" },
];

// ── Questions Data ──

type Question = {
  id: number;
  text: string;
  type: "text" | "country" | "cards";
  options?: string[];
  placeholder?: string;
};

const QUESTIONS: Question[] = [
  { id: 1, text: "¿Cuál es tu nombre completo?", type: "text", placeholder: "Escribe tu nombre completo" },
  { id: 2, text: "¿En qué país te encuentras?", type: "country" },
  { id: 3, text: "¿Cuál de estas opciones te describe mejor hoy?", type: "cards", options: [
      "Tengo un negocio de servicios y quiero vender más",
      "Trabajo en marketing digital, ventas o tecnología",
      "Tengo empleo en otra área y busco una habilidad nueva con salida real",
      "Estoy empezando desde cero",
    ] },
  { id: 4, text: "¿Dónde te gustaría aplicar lo que aprendas en la Certificación?", type: "cards", options: [
      "En mi propio negocio para vender más",
      "Ofrecer este servicio a otros negocios como profesional independiente",
      "Operar dentro del ecosistema comercial de Nexfy",
      "Todavía no estoy seguro",
    ] },
  { id: 5, text: "¿Qué es lo que más te interesa lograr con esto?", type: "cards", options: [
      "Generar una nueva fuente de ingresos",
      "Mejorar las ventas de mi negocio actual",
      "Dejar de depender de un empleo tradicional",
      "Aprender una habilidad con demanda real en el mercado",
      "Todavía no estoy seguro",
    ] },
];

// Stable keys for the JSONB `answers` payload — change with care, downstream
// dashboards/exports key off these.
const ANSWER_KEYS = ["nombre_completo", "pais", "perfil", "aplicar", "objetivo"] as const;

// Wizard stages — group questions to reduce form fatigue
const STAGES: { title: string; subtitle: string; indices: number[] }[] = [
  { title: "Sobre ti", subtitle: "Empezamos con lo básico", indices: [0, 1] },
  { title: "Tu camino", subtitle: "Última parte antes de agendar", indices: [2, 3, 4] },
];

// ── Phase type ──

type Phase = "form" | "calendar" | "confirmed";

// ── Component ──

export default function Step3() {
  const today = useMemo(() => new Date(), []);
  const leadTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const [phase, setPhase] = useState<Phase>("form");
  const [stage, setStage] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  // Country selector
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const countryRef = useRef<HTMLDivElement>(null);
  const countrySearchRef = useRef<HTMLInputElement>(null);

  // Calendar
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Booking — Nexy es AI, no hay slug ni asesor humano
  const hostName = NEXY_HOST_NAME;
  const durationMin = NEXY_DURATION_MIN;
  const availableDaysOfWeek = NEXY_AVAILABLE_DAYS;
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadCountry, setLeadCountry] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [confirmedBooking, setConfirmedBooking] = useState<{ date: string; rawDate: string; time: string; host: string; duration: number; timezone: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Tick every second while on confirmed screen (countdown)
  useEffect(() => {
    if (phase !== "confirmed") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const calendarRef = useRef<HTMLDivElement>(null);
  const calendarDays = useMemo(() => getCalendarDays(viewYear, viewMonth), [viewYear, viewMonth]);
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

  // ── Country filtered list ──
  const filteredCountries = useMemo(() => {
    const q = countrySearch.toLowerCase();
    const filterFn = (c: { name: string }) => c.name.toLowerCase().includes(q);
    if (!q) return { priority: PRIORITY_COUNTRIES, other: OTHER_COUNTRIES };
    return { priority: PRIORITY_COUNTRIES.filter(filterFn), other: OTHER_COUNTRIES.filter(filterFn) };
  }, [countrySearch]);

  // ── Close country dropdown on outside click ──
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
        setCountrySearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (countryOpen) countrySearchRef.current?.focus();
  }, [countryOpen]);

  // ── Hydrate lead context (sólo nombre/teléfono/país, no asesor) ──
  useEffect(() => {
    (async () => {
      try {
        const email = localStorage.getItem("af_lead_email");
        if (!email) { setInitialLoading(false); return; }

        const campaignId = localStorage.getItem("af_campaign_id");
        const campaignFilter = campaignId ? `&campaign_id=eq.${campaignId}` : "";
        const leadRes = await fetch(
          `${SUPABASE_URL}/rest/v1/leads?email=eq.${encodeURIComponent(email)}${campaignFilter}&select=name,phone,country&order=created_at.desc&limit=1`,
          { headers }
        );
        const leads = await leadRes.json();
        if (leads?.[0]) {
          if (leads[0].name) {
            setLeadName(leads[0].name);
            setAnswers((prev) => ({ ...prev, 0: leads[0].name }));
          }
          if (leads[0].phone) setLeadPhone(leads[0].phone);
          if (leads[0].country) setLeadCountry(leads[0].country);
        }
      } catch (e) {
        console.error("[Step3] Init error:", e);
      }
      setInitialLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Slot generator (Nexy = AI, lun-vie 06-22h en TZ del lead) ──
  function generateSlots(date: Date): string[] {
    const isToday = sameDay(date, today);
    if (!isToday) return [...NEXY_BASE_SLOTS];
    const cutoff = Date.now() + NEXY_BOOKING_BUFFER_MS;
    return NEXY_BASE_SLOTS.filter((slot) => {
      const [h, m] = slot.split(":").map(Number);
      const slotMs = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0, 0).getTime();
      return slotMs > cutoff;
    });
  }

  function loadSlots(date: Date) {
    setSlotsLoading(true);
    setSelectedSlot(null);
    const next = generateSlots(date);
    setSlots(next);
    setSlotsLoading(false);
  }

  const handleDateSelect = (date: Date) => {
    if (date < today && !sameDay(date, today)) return;
    setSelectedDate(date);
    loadSlots(date);
  };

  const handleConfirm = async () => {
    if (!selectedDate || !selectedSlot) return;
    setConfirming(true);
    setBookingError("");

    const email = localStorage.getItem("af_lead_email") || "";
    const campaignId = localStorage.getItem("af_campaign_id") || undefined;
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;

    // Build scheduled_at from local picker → UTC ISO
    const [h, m] = selectedSlot.split(":").map(Number);
    const localDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), h, m, 0, 0);
    const scheduledAtUtc = localDate.toISOString();

    if (!email) {
      setBookingError("No encontramos tu email. Volvé al paso 1 y completá tus datos.");
      setConfirming(false);
      return;
    }

    // JSONB answers payload (mismas keys que lead_filter_answers)
    const answersJson: Record<string, string> = {};
    ANSWER_KEYS.forEach((key, i) => {
      const a = answers[i];
      if (a) answersJson[key] = a;
    });
    const notesLines = QUESTIONS.map((q, i) => `${q.text}\n→ ${answers[i] || "Sin respuesta"}`);

    try {
      const res = await confirmNexyBooking({
        email,
        name: leadName || answers[0] || "Lead",
        phone: leadPhone || undefined,
        country: leadCountry || answers[1] || undefined,
        scheduledAt: scheduledAtUtc,
        timezone: leadTimezone,
        durationMin: NEXY_DURATION_MIN,
        answers: answersJson,
        notes: notesLines.join("\n\n"),
        campaignId,
      });
      if (!res.ok) {
        setBookingError(res.error || "Error al confirmar. Intenta de nuevo.");
        setConfirming(false);
        loadSlots(selectedDate);
        return;
      }
    } catch (e) {
      console.error("confirmNexyBooking failed:", e);
      setBookingError("Error de conexión. Intenta de nuevo.");
      setConfirming(false);
      return;
    }

    await trackFunnelStep(email, "confirmar_cita");

    const bookingData = {
      date: formatDate(selectedDate),
      rawDate: dateStr,
      time: selectedSlot,
      host: hostName,
      duration: durationMin,
      timezone: leadTimezone,
    };
    localStorage.setItem("af_booking", JSON.stringify(bookingData));
    localStorage.setItem("af_filter_answers", JSON.stringify(answers));

    // Send confirmation email (fire-and-forget)
    fetch("/api/send-confirmation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        name: leadName || answers[0] || "",
        date: bookingData.date,
        rawDate: dateStr,
        time: bookingData.time,
        host: bookingData.host,
        duration: bookingData.duration,
        timezone: bookingData.timezone,
      }),
    }).catch((e) => console.error("Failed to send confirmation email:", e));

    setConfirmedBooking(bookingData);
    setPhase("confirmed");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const maxBookingDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + NEXY_MAX_LOOKAHEAD_DAYS);
  const prevMonth = () => { if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); } else setViewMonth((m) => m - 1); };
  const canGoNext = new Date(viewYear, viewMonth + 1, 1) <= maxBookingDate;
  const nextMonth = () => { if (!canGoNext) return; if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); } else setViewMonth((m) => m + 1); };

  const allAnswered = QUESTIONS.every((_, i) => answers[i] && answers[i].trim() !== "");
  const currentStage = STAGES[stage];
  const stageAllAnswered = currentStage.indices.every((i) => answers[i] && answers[i].trim() !== "");
  const isLastStage = stage === STAGES.length - 1;

  function handleContinue() {
    if (!allAnswered) return;
    setPhase("calendar");
    setTimeout(() => calendarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);

    // Save filter answers to Supabase (fire-and-forget, non-blocking)
    const email = localStorage.getItem("af_lead_email");
    const ownerId = localStorage.getItem("af_owner_id");
    const campaignId = localStorage.getItem("af_campaign_id");
    if (email) {
      const answersJson: Record<string, string> = {};
      ANSWER_KEYS.forEach((key, i) => {
        const a = answers[i];
        if (a) answersJson[key] = a;
      });
      const payload: Record<string, unknown> = {
        lead_email: email,
        answers: answersJson,
      };
      if (ownerId) payload.owner_id = ownerId;
      if (campaignId) payload.campaign_id = campaignId;
      fetch(`${SUPABASE_URL}/rest/v1/lead_filter_answers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify(payload),
      }).then((res) => {
        if (!res.ok) res.json().then((err) => console.error("lead_filter_answers error:", err));
      }).catch(() => {});
    }
  }

  // ── Loading ──
  if (initialLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "#0B0D10" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 border-2 border-white/10 border-t-[#4ADE80] rounded-full animate-spin" />
          <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.35)" }}>Cargando disponibilidad...</span>
        </div>
      </main>
    );
  }

  // ── Country selector component ──
  function renderCountrySelector(idx: number) {
    const selectedCountry = [...PRIORITY_COUNTRIES, ...OTHER_COUNTRIES].find((c) => c.name === answers[idx]);
    return (
      <div className="relative" ref={countryRef}>
        <button
          onClick={() => { setCountryOpen(!countryOpen); setCountrySearch(""); }}
          className="w-full flex items-center justify-between px-5 py-4 rounded-lg text-sm cursor-pointer transition-all"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${countryOpen ? "rgba(74, 222, 128, 0.5)" : "rgba(255,255,255,0.1)"}`,
            color: answers[idx] ? "white" : "rgba(255,255,255,0.25)",
          }}
        >
          <span className="flex items-center gap-2">
            {selectedCountry && <span className="text-base">{selectedCountry.flag}</span>}
            {answers[idx] || "Selecciona tu país"}
          </span>
          <svg className={`w-4 h-4 text-white/30 transition-transform duration-200 ${countryOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {countryOpen && (
          <div className="absolute z-50 top-full left-0 right-0 mt-2 rounded-lg overflow-hidden shadow-2xl" style={{ background: "rgba(8, 14, 30, 0.98)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}>
            <div className="p-2 border-b border-white/8">
              <div className="flex items-center gap-2 bg-white/5 rounded-md px-3 py-2">
                <svg className="w-3.5 h-3.5 text-white/25 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input ref={countrySearchRef} type="text" value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)} placeholder="Buscar país..." className="bg-transparent text-white text-xs placeholder-white/25 outline-none w-full" />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto overscroll-contain scrollbar-thin">
              {filteredCountries.priority.length > 0 && (
                <>
                  {filteredCountries.priority.map((c) => (
                    <button key={c.name} onClick={() => { setAnswers((prev) => ({ ...prev, [idx]: c.name })); setCountryOpen(false); setCountrySearch(""); }}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors cursor-pointer text-sm ${answers[idx] === c.name ? "bg-[#4ADE80]/10 text-[#4ADE80]" : "text-white/70 hover:bg-white/5"}`}>
                      <span className="text-base">{c.flag}</span><span>{c.name}</span>
                    </button>
                  ))}
                  {filteredCountries.other.length > 0 && <div className="h-px mx-3 my-1" style={{ background: "rgba(255,255,255,0.06)" }} />}
                </>
              )}
              {filteredCountries.other.map((c) => (
                <button key={c.name} onClick={() => { setAnswers((prev) => ({ ...prev, [idx]: c.name })); setCountryOpen(false); setCountrySearch(""); }}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors cursor-pointer text-sm ${answers[idx] === c.name ? "bg-[#4ADE80]/10 text-[#4ADE80]" : "text-white/60 hover:bg-white/5"}`}>
                  <span className="text-base">{c.flag}</span><span>{c.name}</span>
                </button>
              ))}
              {filteredCountries.priority.length === 0 && filteredCountries.other.length === 0 && (
                <div className="px-4 py-4 text-center text-white/25 text-xs">No se encontraron países</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Render ──
  return (
    <main className="min-h-screen flex flex-col relative" style={{ background: "linear-gradient(160deg, #0B0D10 0%, #12161C 40%, #0d1a3a 65%, #0B0D10 100%)" }}>
      {/* Background depth */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 40% at 50% 30%, rgba(74, 222, 128, 0.02) 0%, transparent 70%)" }} />
      <div className="absolute inset-0 pointer-events-none opacity-[0.025]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundRepeat: "repeat", backgroundSize: "128px 128px" }} />

      {/* ── CONFIRMED ── */}
      {phase === "confirmed" && confirmedBooking && (() => {
        const bookingMs = parseBookingTimestamp(confirmedBooking.rawDate, confirmedBooking.time);
        const msUntil = bookingMs - now;
        const countdownLabel = formatCountdown(msUntil);
        const isImminent = msUntil > 0 && msUntil < 60 * 60 * 1000; // < 1h
        const gcalUrl = buildGcalUrl(confirmedBooking.rawDate, confirmedBooking.time, confirmedBooking.duration, confirmedBooking.host, confirmedBooking.timezone);
        const handleIcsDownload = () => {
          const ics = buildIcs(confirmedBooking.rawDate, confirmedBooking.time, confirmedBooking.duration, confirmedBooking.host, confirmedBooking.timezone);
          downloadIcs(`nexfy-${confirmedBooking.rawDate}.ics`, ics);
        };
        return (
          <div className="relative z-10 flex-1 flex items-start justify-center px-5 py-12">
            <div className="w-full max-w-md text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full" style={{ background: "rgba(34, 197, 94, 0.1)" }}>
                <svg className="w-10 h-10" style={{ color: "#22c55e" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-white mb-3" style={{ lineHeight: "1.2", letterSpacing: "-0.015em" }}>Tu evaluación con <span style={{ color: "#4ADE80" }}>Nexy</span> está confirmada.</h2>

              {/* Live countdown */}
              <div className="mb-5 rounded-xl px-4 py-4" style={{ background: isImminent ? "rgba(248, 113, 113, 0.08)" : "rgba(74, 222, 128, 0.06)", border: `1px solid ${isImminent ? "rgba(248, 113, 113, 0.25)" : "rgba(74, 222, 128, 0.22)"}` }}>
                <p className="text-[10px] uppercase font-bold tracking-widest mb-1.5" style={{ color: isImminent ? "#F87171" : "rgba(74, 222, 128, 0.85)", letterSpacing: "0.18em" }}>
                  {msUntil <= 0 ? "Tu llamada está empezando" : "Tu llamada empieza en"}
                </p>
                <p className="font-mono font-bold tabular-nums" style={{ fontSize: msUntil <= 0 ? "20px" : "26px", color: isImminent ? "#F87171" : "#4ADE80", letterSpacing: "0.02em" }}>
                  {countdownLabel}
                </p>
              </div>

              <p className="text-sm mb-4 leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
                <span className="mr-1">📲</span>Vas a recibir una confirmación por WhatsApp. Asegúrate de atender la llamada en el horario que elegiste.
              </p>
              <p className="text-[13px] mb-6 leading-relaxed text-left rounded-lg px-4 py-3" style={{ color: "rgba(255,255,255,0.75)", background: "rgba(248, 113, 113, 0.06)", border: "1px solid rgba(248, 113, 113, 0.2)" }}>
                <strong className="font-semibold" style={{ color: "#F87171" }}>Importante:</strong> si no atiendes la llamada, tu lugar se reasigna automáticamente. No hay segundas oportunidades para el mismo horario.
              </p>

              <div className="text-left rounded-xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-start"><span className="text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>Fecha y hora</span><span className="text-[13px] font-medium text-right capitalize text-white">{confirmedBooking.date}<br /><span style={{ color: "#4ADE80" }}>{formatSlotTime(confirmedBooking.time)}</span></span></div>
                  <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                  <div className="flex justify-between"><span className="text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>Duración</span><span className="text-[13px] font-medium text-white">{confirmedBooking.duration} min</span></div>
                  <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                  <div className="flex justify-between"><span className="text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>Con</span><span className="text-[13px] font-medium text-white">{confirmedBooking.host}</span></div>
                  <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                  <div className="flex justify-between items-start">
                    <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>Zona horaria</span>
                    <span className="text-right">
                      <span className="block text-[13px] font-medium text-white">{formatTimezone(confirmedBooking.timezone).city}</span>
                      <span className="block text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{formatTimezone(confirmedBooking.timezone).iana}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Add to calendar */}
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <a
                  href={gcalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg py-3 text-[12px] font-semibold transition-all cursor-pointer"
                  style={{ background: "rgba(74, 222, 128, 0.1)", border: "1px solid rgba(74, 222, 128, 0.35)", color: "#4ADE80" }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Agregar a Google Calendar
                </a>
                <button
                  type="button"
                  onClick={handleIcsDownload}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg py-3 text-[12px] font-semibold transition-all cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)" }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
                  Descargar .ics (Apple/Outlook)
                </button>
              </div>

              {/* Portal teaser */}
              <div className="mt-8 rounded-xl p-5 text-left" style={{ background: "linear-gradient(135deg, rgba(74,222,128,0.04) 0%, rgba(74,222,128,0.02) 100%)", border: "1px solid rgba(74,222,128,0.18)" }}>
                <p className="text-[10px] font-bold uppercase mb-2" style={{ letterSpacing: "0.18em", color: "rgba(74,222,128,0.85)" }}>Mientras esperás</p>
                <h3 className="text-[15px] font-bold text-white mb-1.5" style={{ lineHeight: "1.3" }}>Conocé el portal de la Certificación</h3>
                <p className="text-[12px] mb-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Si tu perfil encaja en la llamada, vas a entrar acá. Mirá los 4 pasos que te esperan y empezá a familiarizarte.
                </p>
                <a
                  href="https://portal.nexfy.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold"
                  style={{ color: "#4ADE80" }}
                >
                  Ver portal →
                </a>
              </div>

              <p className="text-[11px] mt-6" style={{ color: "rgba(255,255,255,0.2)" }}>Puedes cerrar esta página. Te contactaremos por WhatsApp o email.</p>
            </div>
          </div>
        );
      })()}

      {/* ── FORM + CALENDAR ── */}
      {phase !== "confirmed" && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-5 md:px-8 py-14 md:py-16 safe-top">
          <div className="w-full max-w-[750px]">

            {/* Spacer */}
            <div className="h-[30px]" />

            {/* Headline */}
            <div className="text-center mb-5 md:mb-6 vsl-fade-1">
              <h1
                className="agenda-headline font-bold text-white mb-3"
                style={{ fontSize: "30px", lineHeight: "1.15", letterSpacing: "-0.02em", textShadow: "0 2px 20px rgba(0,0,0,0.3)" }}
              >
                Agenda tu evaluación con <span style={{ color: "#4ADE80" }}>Nexy</span>
              </h1>
              <p
                className="agenda-subheadline leading-relaxed max-w-[640px] mx-auto"
                style={{ fontSize: "15px", color: "rgba(255,255,255,0.7)", marginTop: "12px" }}
              >
                Nexy es nuestro agente de inteligencia artificial. Te va a llamar en el horario que elijas para evaluar si tu perfil encaja con la Certificación Profesional en Sistemas de Ventas con IA.
              </p>
            </div>

            {/* Video Nexy */}
            <div className="vsl-fade-2 mb-8 md:mb-10">
              <div
                className="relative w-full aspect-video rounded-2xl overflow-hidden"
                style={{
                  border: "1px solid rgba(255,255,255,0.1)",
                  boxShadow:
                    "0 20px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.05) inset, 0 0 60px rgba(74, 222, 128, 0.03)",
                  background: "#000",
                }}
              >
                <iframe
                  src="https://iframe.mediadelivery.net/embed/642321/dc211a3d-75a9-4c39-a597-8dc0c7f5cc09?autoplay=false&preload=true&responsive=true"
                  loading="lazy"
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                  style={{ border: "none" }}
                />
              </div>
            </div>

            {/* Bloque de urgencia */}
            <div
              className="vsl-fade-2 mb-8 md:mb-10 text-left rounded-xl px-5 py-4"
              style={{
                background: "rgba(251, 191, 36, 0.06)",
                border: "1px solid rgba(251, 191, 36, 0.25)",
              }}
            >
              <p className="text-[13px] md:text-[14px] leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
                <span className="mr-1.5">⏱</span>
                <strong className="font-semibold" style={{ color: "#FCD34D" }}>Los horarios disponibles se asignan por orden de llegada.</strong>{" "}
                Si el horario que quieres ya no está disponible cuando vuelvas, vas a tener que esperar a la próxima apertura de agenda.
              </p>
            </div>

            {/* ── Wizard form (phase: form) ── */}
            {phase === "form" && (
              <div>
                {/* Stage progress indicator */}
                <div className="mb-6 md:mb-7">
                  <div className="flex items-center justify-between mb-3 gap-3">
                    <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(74,222,128,0.85)" }}>
                      Paso {stage + 1} de {STAGES.length} · {currentStage.title}
                    </span>
                    <span className="text-[10px] md:text-[11px] text-right truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
                      {currentStage.subtitle}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {STAGES.map((_, i) => (
                      <div key={i} className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: i <= stage ? "100%" : "0%",
                            background: i < stage
                              ? "linear-gradient(90deg, rgba(74,222,128,0.5), rgba(74,222,128,0.7))"
                              : i === stage
                                ? "linear-gradient(90deg, #4ADE80, #86EFAC)"
                                : "transparent",
                            boxShadow: i === stage ? "0 0 12px rgba(74,222,128,0.4)" : "none",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stage questions */}
                <div className="space-y-0">
                  {currentStage.indices.map((idx, posInStage) => {
                    const q = QUESTIONS[idx];
                    const isLastInStage = posInStage === currentStage.indices.length - 1;
                    return (
                      <div key={q.id} className={`py-5 sm:py-7 md:py-8 ${!isLastInStage ? "border-b" : ""}`} style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                        <h3 className="text-[16px] md:text-[19px] font-bold text-white mb-4" style={{ lineHeight: "1.35" }}>{q.text}</h3>

                        {/* Text input */}
                        {q.type === "text" && (
                          <input type="text" value={answers[idx] || ""} onChange={(e) => setAnswers((prev) => ({ ...prev, [idx]: e.target.value }))} placeholder={q.placeholder}
                            className="w-full px-5 py-4 rounded-lg text-white placeholder-white/25 outline-none text-sm transition-all duration-200"
                            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(74, 222, 128, 0.5)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(74, 222, 128, 0.08)"; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
                          />
                        )}

                        {/* Country selector */}
                        {q.type === "country" && renderCountrySelector(idx)}

                        {/* Cards */}
                        {q.type === "cards" && q.options && (
                          <div className="space-y-2.5">
                            {q.options.map((opt) => {
                              const isSelected = answers[idx] === opt;
                              return (
                                <button key={opt} onClick={() => setAnswers((prev) => ({ ...prev, [idx]: opt }))}
                                  className="w-full text-left px-5 py-4 rounded-xl text-sm transition-all duration-200 cursor-pointer flex items-center gap-3"
                                  style={{
                                    background: isSelected ? "rgba(74, 222, 128, 0.1)" : "rgba(255,255,255,0.03)",
                                    border: `1px solid ${isSelected ? "rgba(74, 222, 128, 0.45)" : "rgba(255,255,255,0.08)"}`,
                                    color: isSelected ? "#4ADE80" : "rgba(255,255,255,0.7)",
                                  }}>
                                  <div className="w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all" style={{ borderColor: isSelected ? "#4ADE80" : "rgba(255,255,255,0.15)", background: isSelected ? "#4ADE80" : "transparent" }}>
                                    {isSelected && <svg className="w-3 h-3 text-[#0B0D10]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                  </div>
                                  <span>{opt}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Stage navigation */}
                <div className="pt-6 pb-2 flex flex-col-reverse sm:flex-row items-stretch gap-3">
                  {stage > 0 && (
                    <button
                      onClick={() => { setStage(stage - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      className="px-5 py-4 rounded-xl text-sm font-semibold cursor-pointer transition-all sm:w-auto"
                      style={{ color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.9)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
                    >
                      ← Atrás
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (!stageAllAnswered) return;
                      if (isLastStage) {
                        handleContinue();
                      } else {
                        setStage(stage + 1);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }
                    }}
                    disabled={!stageAllAnswered}
                    className="flex-1 py-4 rounded-xl text-sm font-bold uppercase cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ letterSpacing: "0.08em", color: "#0B0D10", backgroundColor: "#4ADE80", boxShadow: stageAllAnswered ? "0 6px 30px rgba(74, 222, 128, 0.4)" : "none", transition: "all 0.25s ease" }}
                    onMouseEnter={(e) => { if (stageAllAnswered) { e.currentTarget.style.boxShadow = "0 10px 50px rgba(74, 222, 128, 0.6)"; e.currentTarget.style.transform = "translateY(-2px) scale(1.01)"; } }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = stageAllAnswered ? "0 6px 30px rgba(74, 222, 128, 0.4)" : "none"; e.currentTarget.style.transform = "translateY(0) scale(1)"; }}
                  >
                    {isLastStage ? "VER HORARIOS DISPONIBLES" : "CONTINUAR"}
                  </button>
                </div>
              </div>
            )}

            {/* ── Calendar Section ── */}
            {phase === "calendar" && (
              <div ref={calendarRef} className="mt-10 md:mt-14">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md mb-4" style={{ background: "rgba(34, 197, 94, 0.08)", border: "1px solid rgba(34, 197, 94, 0.25)" }}>
                    <svg className="w-4 h-4" style={{ color: "#22c55e" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    <span className="text-xs font-semibold" style={{ color: "#22c55e" }}>Preguntas completadas</span>
                  </div>
                  <h2 className="text-lg md:text-2xl font-bold text-white mb-2" style={{ lineHeight: "1.15", letterSpacing: "-0.015em" }}>¡Perfecto! Ya Tenemos Tu Información.</h2>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>Ahora elige el día y horario que mejor te funcione.</p>
                </div>

                {/* Calendar card */}
                <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 80px rgba(0,0,0,0.4)" }}>
                  <div className="flex flex-col md:flex-row">
                    {/* Left panel */}
                    <div className="flex flex-col gap-3 sm:gap-4 md:w-56 shrink-0 p-4 sm:p-5 md:p-6 border-b md:border-b-0 md:border-r" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-full"
                          style={{
                            background: "radial-gradient(circle at 30% 28%, rgba(74,222,128,0.7), rgba(74,222,128,0.18) 70%)",
                            border: "1px solid rgba(74,222,128,0.55)",
                            color: "#0B0D10",
                            boxShadow: "0 0 16px rgba(74,222,128,0.35)",
                          }}
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[13px] font-medium text-white">{hostName}</span>
                          <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>Asesor IA · Llamada por audio</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 pt-1 text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                        <div className="flex items-center gap-2"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span>{durationMin} min</span></div>
                        <div className="flex items-center gap-2"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" /></svg><span>{leadTimezone.replace(/_/g, " ")}</span></div>
                        {selectedDate && selectedSlot && (
                          <div className="flex items-center gap-2 pt-1"><svg className="w-3.5 h-3.5" style={{ color: "#4ADE80" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><span className="font-medium capitalize" style={{ color: "#4ADE80" }}>{formatDate(selectedDate)} · {formatSlotTime(selectedSlot)}</span></div>
                        )}
                      </div>
                    </div>

                    {/* Right panel */}
                    <div className="flex flex-1 flex-col p-4 sm:p-5 md:p-6" style={{ minHeight: "auto" }}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:gap-5">
                        <div className="flex flex-col gap-3 lg:min-w-[280px] shrink-0">
                          <h3 className="text-[14px] font-bold text-white">Selecciona una fecha</h3>
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] font-bold text-white">{MONTH_NAMES[viewMonth]} {viewYear}</span>
                            <div className="flex items-center gap-1">
                              <button onClick={prevMonth} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md hover:bg-white/5" style={{ border: "1px solid rgba(255,255,255,0.1)" }}><svg className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.4)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg></button>
                              <button onClick={nextMonth} disabled={!canGoNext} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed" style={{ border: "1px solid rgba(255,255,255,0.1)" }}><svg className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.4)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg></button>
                            </div>
                          </div>
                          <div className="grid grid-cols-7">{DAY_HEADERS.map((d) => (<div key={d} className="flex items-center justify-center py-1"><span className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.25)" }}>{d}</span></div>))}</div>
                          <div className="grid grid-cols-7 gap-0.5">
                            {calendarDays.map((day) => {
                              const isCurrentMonth = day.getMonth() === viewMonth;
                              const isPast = day < today && !sameDay(day, today);
                              const isTooFar = day > maxBookingDate;
                              const isToday = sameDay(day, today);
                              const isSelected = selectedDate ? sameDay(day, selectedDate) : false;
                              const hasAvailability = availableDaysOfWeek.size === 0 || availableDaysOfWeek.has(day.getDay());
                              const isDisabled = isPast || isTooFar || !hasAvailability || !isCurrentMonth;
                              return (
                                <button key={day.toISOString()} onClick={() => !isDisabled && handleDateSelect(day)} disabled={isDisabled}
                                  className="flex h-8 w-8 sm:h-9 sm:w-9 cursor-pointer items-center justify-center rounded-full border-none text-[11px] sm:text-[12px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-20"
                                  style={{ backgroundColor: isSelected ? "#4ADE80" : isToday ? "rgba(74, 222, 128, 0.1)" : "transparent", color: isSelected ? "#0B0D10" : !isCurrentMonth ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.7)" }}>
                                  {day.getDate()}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Time slots */}
                        {selectedDate && (
                          <div className="flex flex-col gap-3 border-t pt-4 lg:w-[180px] lg:min-w-[180px] lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                            <h3 className="text-[13px] font-bold text-white">Elige un horario</h3>
                            <p className="text-[11px] capitalize" style={{ color: "rgba(255,255,255,0.4)" }}>{formatDate(selectedDate)}</p>
                            {slotsLoading ? (
                              <div className="flex flex-1 items-center justify-center py-8"><div className="w-5 h-5 border-2 border-white/10 border-t-[#4ADE80] rounded-full animate-spin" /></div>
                            ) : slots.length === 0 ? (
                              <div className="flex flex-col items-center justify-center gap-2 py-8"><span className="text-[11px] text-center" style={{ color: "rgba(255,255,255,0.25)" }}>No hay horarios disponibles</span></div>
                            ) : (
                              <div className="flex max-h-[280px] flex-col gap-1.5 overflow-y-auto pr-1 scrollbar-thin">
                                {slots.map((slot) => {
                                  const isSlotSelected = selectedSlot === slot;
                                  return (<button key={slot} onClick={() => setSelectedSlot(isSlotSelected ? null : slot)} className="cursor-pointer rounded-lg py-2.5 text-center text-[12px] font-semibold transition-all"
                                    style={{ border: `1px solid ${isSlotSelected ? "#4ADE80" : "rgba(255,255,255,0.1)"}`, backgroundColor: isSlotSelected ? "#4ADE80" : "rgba(255,255,255,0.03)", color: isSlotSelected ? "#0B0D10" : "rgba(255,255,255,0.7)" }}>
                                    {formatSlotTime(slot)}
                                  </button>);
                                })}
                              </div>
                            )}
                            {selectedSlot && (
                              <button onClick={handleConfirm} disabled={confirming}
                                className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-none py-3 text-[11px] font-bold uppercase text-[#0B0D10] transition-all disabled:cursor-not-allowed disabled:opacity-50"
                                style={{ letterSpacing: "0.06em", backgroundColor: "#4ADE80", boxShadow: "0 6px 30px rgba(74, 222, 128, 0.4)" }}>
                                {confirming && <div className="w-4 h-4 border-2 border-[#0B0D10]/30 border-t-[#0B0D10] rounded-full animate-spin" />}
                                CONFIRMAR MI EVALUACIÓN
                              </button>
                            )}
                            {bookingError && (
                              <p className="mt-2 text-[12px] text-center py-2 px-3 rounded-lg" style={{ color: "#f87171", background: "rgba(248, 113, 113, 0.08)", border: "1px solid rgba(248, 113, 113, 0.2)" }}>
                                {bookingError}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Texto de refuerzo */}
                <div className="mt-8 md:mt-10 max-w-[680px] mx-auto space-y-4 text-[14px] md:text-[15px] leading-relaxed" style={{ color: "rgba(255,255,255,0.72)" }}>
                  <p>
                    La evaluación dura entre <strong className="font-semibold text-white/90">5 y 7 minutos</strong>. No es una llamada de ventas. <span style={{ color: "#4ADE80" }}>Es un filtro real.</span>
                  </p>
                  <p>
                    Nexy va a hacerte preguntas sobre tu situación actual, tu interés y tu nivel de compromiso. Si tu perfil encaja, accedes al portal exclusivo de la Certificación. Si no encaja, te lo decimos y no avanzamos.
                  </p>
                  <p className="italic" style={{ color: "rgba(255,255,255,0.5)" }}>
                    No todo el mundo pasa esta etapa. Eso es intencional.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="w-full mt-8 md:mt-12 px-4 sm:px-5 py-4 text-[9px] md:text-[10px] leading-relaxed safe-bottom" style={{ color: "rgba(255,255,255,0.15)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="max-w-[750px] mx-auto space-y-1.5">
              <p>Esta página no es parte del sitio web de Facebook o Facebook Inc. Este sitio no está respaldado por Facebook de alguna manera. FACEBOOK es una marca registrada de FACEBOOK, Inc.</p>
              <p style={{ color: "rgba(255,255,255,0.2)" }}><strong>IMPORTANTE:</strong> Las ganancias mostradas son aspiracionales. Los resultados varían según capacidad individual, ética laboral, experiencia y otros factores.</p>
            </div>
          </footer>
        </div>
      )}
    </main>
  );
}

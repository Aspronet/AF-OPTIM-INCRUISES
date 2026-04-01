"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { trackFunnelStep } from "@/app/actions";

// ── Helpers ──

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];
const DAY_HEADERS = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

const SUPABASE_URL = "https://pcmuwwfivmstqnoiyqur.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjbXV3d2Zpdm1zdHFub2l5cXVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NzA1MTMsImV4cCI6MjA4NzA0NjUxM30.MQ3aBluqw3nBz8FcAL9lc564JGsgEkm-E_FGuqfEoZE";

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
  { id: 3, text: "¿Cuál describe mejor tu situación actual?", type: "cards", options: ["Empleado a tiempo completo", "Empleado medio tiempo", "Emprendedor o freelancer", "Dueño de negocio", "Estudiante", "Otro"] },
  { id: 4, text: "¿Alguna vez intentaste otro tipo de negocio por tu cuenta? (ecommerce, dropshipping, freelancing, ventas, etc.)", type: "cards", options: ["Sí, y me fue bien — busco algo mejor o complementario", "Sí, pero no me funcionó — me faltó sistema o guía", "Sí, pero lo dejé por falta de tiempo o capital", "No, esta sería mi primera vez"] },
  { id: 5, text: "¿Qué fue lo que más te llamó la atención del video?", type: "cards", options: ["La oportunidad de generar ingresos en dólares", "El sistema de ventas comprobado que te guía paso a paso", "La posibilidad de hacerlo part-time sin dejar mi trabajo", "La industria y el respaldo de la empresa", "Todavía tengo dudas pero quiero entender mejor"] },
  { id: 6, text: "¿Cuánto tiempo podrías dedicar a un proyecto nuevo fuera de tu actividad actual?", type: "cards", options: ["Menos de 1 hora al día — pero soy constante", "1 a 2 horas al día", "Más de 2 horas al día", "Podría dedicarme full-time si vale la pena"] },
  { id: 7, text: "Si después de la llamada vemos que este negocio encaja con tu perfil, ¿estás en posición de tomar una decisión e invertir en ti mismo para empezar?", type: "cards", options: ["Sí, estoy listo para empezar si tiene sentido", "Muy probablemente sí, quiero ver los detalles finales", "Depende de la inversión — necesito saber cuánto es", "Solo estoy explorando por ahora"] },
];

// ── Phase type ──

type Phase = "form" | "calendar" | "confirmed";

// ── Component ──

export default function Step3() {
  const today = useMemo(() => new Date(), []);
  const leadTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const [phase, setPhase] = useState<Phase>("form");
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

  // Booking
  const [slug, setSlug] = useState<string | null>(null);
  const [hostName, setHostName] = useState("");
  const [durationMin, setDurationMin] = useState(15);
  const [availableDaysOfWeek, setAvailableDaysOfWeek] = useState<Set<number>>(new Set());
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [confirmedBooking, setConfirmedBooking] = useState<{ date: string; time: string; host: string; duration: number; timezone: string } | null>(null);

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

  // ── Load booking info ──
  useEffect(() => {
    (async () => {
      try {
        const email = localStorage.getItem("af_lead_email");
        const storedOwnerId = localStorage.getItem("af_owner_id");
        console.log("[Step3] email:", email, "storedOwnerId:", storedOwnerId);
        if (!email) { console.log("[Step3] No email, aborting"); setInitialLoading(false); return; }

        // Always fetch fresh from DB — filter by campaign_id if available
        const campaignId = localStorage.getItem("af_campaign_id");
        const campaignFilter = campaignId ? `&campaign_id=eq.${campaignId}` : "";
        const leadRes = await fetch(
          `${SUPABASE_URL}/rest/v1/leads?email=eq.${encodeURIComponent(email)}${campaignFilter}&select=user_id,name,phone&order=created_at.desc&limit=1`,
          { headers }
        );
        const leads = await leadRes.json();
        console.log("[Step3] leads query result:", leads, "campaignFilter:", campaignFilter);

        // DB result is authoritative; fall back to localStorage only if DB returns nothing
        let ownerId: string | null = null;
        if (leads?.[0]?.user_id) {
          ownerId = leads[0].user_id as string;
          // Update localStorage to stay in sync
          localStorage.setItem("af_owner_id", ownerId);
          if (leads[0].name) { setLeadName(leads[0].name); setAnswers((prev) => ({ ...prev, 0: leads[0].name })); }
          if (leads[0].phone) setLeadPhone(leads[0].phone);
        } else if (storedOwnerId) {
          // Fallback: use localStorage if DB didn't return a result
          ownerId = storedOwnerId;
          console.log("[Step3] DB returned no lead, falling back to storedOwnerId:", storedOwnerId);
        }

        if (!ownerId) { console.log("[Step3] No ownerId found, aborting"); setInitialLoading(false); return; }
        console.log("[Step3] Using ownerId:", ownerId);

        // Get the 15-min booking link for the owner
        const linkRes = await fetch(`${SUPABASE_URL}/rest/v1/booking_links?user_id=eq.${ownerId}&is_active=eq.true&duration_minutes=eq.15&select=slug,duration_minutes,user_id`, { headers });
        const links = await linkRes.json();
        console.log("[Step3] booking_links result:", links);
        if (!links?.[0]) { console.log("[Step3] No booking link found for owner, aborting"); setInitialLoading(false); return; }
        const link = links[0];
        setSlug(link.slug);
        if (link.duration_minutes) setDurationMin(link.duration_minutes);

        // Get host name
        const profRes = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${ownerId}&select=first_name,last_name`, { headers });
        const profs = await profRes.json();
        console.log("[Step3] user_profiles result:", profs);
        if (profs?.[0]) setHostName(`${profs[0].first_name || ""} ${profs[0].last_name || ""}`.trim());

        // Get which days of week have availability
        const schedRes = await fetch(`${SUPABASE_URL}/rest/v1/availability_schedules?user_id=eq.${ownerId}&is_active=eq.true&select=day_of_week`, { headers });
        const scheds = await schedRes.json();
        console.log("[Step3] availability_schedules result:", scheds);
        if (Array.isArray(scheds)) {
          const jsDays = new Set(scheds.map((s: { day_of_week: number }) => (s.day_of_week === 6 ? 0 : s.day_of_week + 1)));
          console.log("[Step3] Available JS days:", [...jsDays]);
          setAvailableDaysOfWeek(jsDays);
        }

        console.log("[Step3] Fetching slots for today with slug:", link.slug);
        fetchSlots(today, link.slug);
      } catch (e) { console.error("[Step3] Init error:", e); }
      setInitialLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch slots ──
  const slugRef = useRef(slug);
  slugRef.current = slug;

  async function fetchSlots(date: Date, overrideSlug?: string) {
    const s = overrideSlug || slugRef.current;
    if (!s) return;
    setSlotsLoading(true); setSlots([]); setSelectedSlot(null);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/booking-availability?slug=${encodeURIComponent(s)}&date=${dateStr}&timezone=${encodeURIComponent(tz)}`);
      const data = await res.json();
      if (res.ok && data.slots) { setSlots(data.slots); if (data.host) setHostName(data.host); }
    } catch (e) { console.error("Failed to fetch slots:", e); }
    setSlotsLoading(false);
  }

  const handleDateSelect = (date: Date) => { if (date < today && !sameDay(date, today)) return; setSelectedDate(date); fetchSlots(date); };

  const handleConfirm = async () => {
    if (!selectedDate || !selectedSlot || !slugRef.current) return;
    setConfirming(true);
    setBookingError("");
    const email = localStorage.getItem("af_lead_email");
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
    const notesLines = QUESTIONS.map((q, i) => `${q.text}\n→ ${answers[i] || "Sin respuesta"}`);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/booking-confirm`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: slugRef.current, date: dateStr, time: selectedSlot, name: leadName || answers[0] || "Lead", email: email || "", phone: leadPhone || null, timezone: leadTimezone, notes: notesLines.join("\n\n") }),
      });
      if (!res.ok) {
        const err = await res.json();
        console.error("Booking confirm error:", err);
        setBookingError(res.status === 409
          ? "Este horario ya no está disponible. Elige otro."
          : "Error al confirmar. Intenta de nuevo.");
        setConfirming(false);
        // Refresh slots so the taken one disappears
        fetchSlots(selectedDate);
        return;
      }
    } catch (e) { console.error("Booking confirm failed:", e); setBookingError("Error de conexión. Intenta de nuevo."); setConfirming(false); return; }
    if (email) await trackFunnelStep(email, "confirmar_cita");
    const bookingData = { date: formatDate(selectedDate), time: selectedSlot, host: hostName, duration: durationMin, timezone: leadTimezone };
    localStorage.setItem("af_booking", JSON.stringify(bookingData));
    localStorage.setItem("af_filter_answers", JSON.stringify(answers));

    // Send confirmation email (fire-and-forget)
    if (email) {
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
    }

    setConfirmedBooking(bookingData);
    setPhase("confirmed");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const maxBookingDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5);
  const prevMonth = () => { if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); } else setViewMonth((m) => m - 1); };
  const canGoNext = new Date(viewYear, viewMonth + 1, 1) <= maxBookingDate;
  const nextMonth = () => { if (!canGoNext) return; if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); } else setViewMonth((m) => m + 1); };

  const allAnswered = QUESTIONS.every((_, i) => answers[i] && answers[i].trim() !== "");

  function handleContinue() {
    if (!allAnswered) return;
    setPhase("calendar");
    setTimeout(() => calendarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);

    // Save filter answers to Supabase (fire-and-forget, non-blocking)
    const email = localStorage.getItem("af_lead_email");
    const ownerId = localStorage.getItem("af_owner_id");
    const campaignId = localStorage.getItem("af_campaign_id");
    if (email) {
      const payload: Record<string, string> = { lead_email: email };
      if (ownerId) payload.owner_id = ownerId;
      if (campaignId) payload.campaign_id = campaignId;
      if (answers[0]) payload.q1_nombre_completo = answers[0];
      if (answers[1]) payload.q2_pais = answers[1];
      if (answers[2]) payload.q3_situacion_actual = answers[2];
      if (answers[3]) payload.q4_experiencia_negocios = answers[3];
      if (answers[4]) payload.q5_atencion_video = answers[4];
      if (answers[5]) payload.q6_tiempo_disponible = answers[5];
      if (answers[6]) payload.q7_disposicion_inversion = answers[6];
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
      <main className="min-h-screen flex items-center justify-center" style={{ background: "#060b18" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 border-2 border-white/10 border-t-[#d4a843] rounded-full animate-spin" />
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
            border: `1px solid ${countryOpen ? "rgba(212, 168, 67, 0.5)" : "rgba(255,255,255,0.1)"}`,
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
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors cursor-pointer text-sm ${answers[idx] === c.name ? "bg-[#d4a843]/10 text-[#d4a843]" : "text-white/70 hover:bg-white/5"}`}>
                      <span className="text-base">{c.flag}</span><span>{c.name}</span>
                    </button>
                  ))}
                  {filteredCountries.other.length > 0 && <div className="h-px mx-3 my-1" style={{ background: "rgba(255,255,255,0.06)" }} />}
                </>
              )}
              {filteredCountries.other.map((c) => (
                <button key={c.name} onClick={() => { setAnswers((prev) => ({ ...prev, [idx]: c.name })); setCountryOpen(false); setCountrySearch(""); }}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors cursor-pointer text-sm ${answers[idx] === c.name ? "bg-[#d4a843]/10 text-[#d4a843]" : "text-white/60 hover:bg-white/5"}`}>
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
    <main className="min-h-screen flex flex-col relative" style={{ background: "linear-gradient(160deg, #060b18 0%, #0a1230 40%, #0d1a3a 65%, #060b18 100%)" }}>
      {/* Background depth */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 40% at 50% 30%, rgba(212, 168, 67, 0.02) 0%, transparent 70%)" }} />
      <div className="absolute inset-0 pointer-events-none opacity-[0.025]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundRepeat: "repeat", backgroundSize: "128px 128px" }} />

      {/* ── CONFIRMED ── */}
      {phase === "confirmed" && confirmedBooking && (
        <div className="relative z-10 flex-1 flex items-center justify-center px-5 py-12">
          <div className="w-full max-w-md text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full" style={{ background: "rgba(34, 197, 94, 0.1)" }}>
              <svg className="w-10 h-10" style={{ color: "#22c55e" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white mb-3" style={{ lineHeight: "1.15", letterSpacing: "-0.015em" }}>¡Listo! Tu Llamada Está Confirmada.</h2>
            <p className="text-sm mb-8 leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>Vas a recibir un mensaje por WhatsApp con los detalles. Prepara tus preguntas — vamos a aprovechar cada minuto. ¡Nos vemos en la llamada!</p>
            <div className="text-left rounded-xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-start"><span className="text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>Fecha y hora</span><span className="text-[13px] font-medium text-right capitalize text-white">{confirmedBooking.date}<br /><span style={{ color: "#d4a843" }}>{formatSlotTime(confirmedBooking.time)}</span></span></div>
                <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                <div className="flex justify-between"><span className="text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>Duración</span><span className="text-[13px] font-medium text-white">{confirmedBooking.duration} min</span></div>
                <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                <div className="flex justify-between"><span className="text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>Con</span><span className="text-[13px] font-medium text-white">{confirmedBooking.host}</span></div>
                <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                <div className="flex justify-between"><span className="text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>Zona horaria</span><span className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>{confirmedBooking.timezone?.replace(/_/g, " ")}</span></div>
              </div>
            </div>
            <p className="text-[11px] mt-6" style={{ color: "rgba(255,255,255,0.2)" }}>Puedes cerrar esta página. Te contactaremos por WhatsApp o email.</p>
          </div>
        </div>
      )}

      {/* ── FORM + CALENDAR ── */}
      {phase !== "confirmed" && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-5 md:px-8 py-14 md:py-16 safe-top">
          <div className="w-full max-w-[750px]">

            {/* Spacer */}
            <div className="h-[30px]" />

            {/* Headline */}
            <div className="text-center mb-6 md:mb-8 vsl-fade-1">
              <h1
                className="agenda-headline font-bold text-white mb-3"
                style={{ fontSize: "26px", lineHeight: "1.15", letterSpacing: "-0.015em", textShadow: "0 2px 20px rgba(0,0,0,0.3)" }}
              >
                ¡Bien! Estás A Un Paso De Tu Llamada De Validación.
              </h1>
              <p
                className="agenda-subheadline leading-relaxed"
                style={{ fontSize: "15px", color: "rgba(255,255,255,0.85)", marginTop: "12px" }}
              >
                Antes de agendar, necesitamos conocerte. Responde estas preguntas rápidas (menos de 2 minutos) y luego elige tu horario.
              </p>
              <div
                className="agenda-context text-left leading-relaxed italic"
                style={{ fontSize: "14px", color: "rgba(255,255,255,0.7)", marginTop: "8px", padding: "10px 16px", borderLeft: "2px solid rgba(212, 168, 67, 0.5)", background: "rgba(255,255,255,0.03)", borderRadius: "0 8px 8px 0" }}
              >
                ¿Por qué te pedimos esto? Porque no trabajamos con todo el mundo. Queremos que esta conversación sea útil para ti y que tu tiempo esté bien invertido.
              </div>
            </div>

            {/* Video */}
            <div className="vsl-fade-2 mb-8 md:mb-10">
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 25px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset, 0 0 80px rgba(212, 168, 67, 0.04)" }}>
                <div className="absolute top-0 left-0 w-1/2 h-1/3 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 60%)" }} />
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(10, 18, 48, 0.9) 0%, rgba(6, 11, 24, 0.95) 100%)" }}>
                  <button className="play-pulse flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full cursor-pointer" style={{ background: "rgba(212, 168, 67, 0.12)", border: "2px solid rgba(212, 168, 67, 0.4)" }}>
                    <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[18px] border-b-[10px] border-b-transparent ml-1" style={{ borderLeftColor: "#d4a843" }} />
                  </button>
                </div>
              </div>
            </div>

            {/* PASO 3 Banner */}
            <div className="vsl-fade-3 mb-8 md:mb-10 flex flex-col items-center">
              <div className="flex items-center justify-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 rounded-xl w-full" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212, 168, 67, 0.2)", backdropFilter: "blur(8px)", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
                <div className="flex items-center justify-center w-9 h-9 rounded-full shrink-0 text-[15px] font-bold" style={{ background: "linear-gradient(135deg, #d4a843, #e8c45a)", color: "#060b18" }}>3</div>
                <span className="text-[12px] md:text-[14px] font-bold uppercase" style={{ letterSpacing: "0.08em", color: "#d4a843" }}>
                  Rellena El Formulario Y Elige Tu Horario De Cita
                </span>
              </div>
              <svg className="paso3-arrow mt-3" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            {/* ── 7 Questions ── */}
            {(phase === "form" || phase === "calendar") && (
              <div className="space-y-0">
                {QUESTIONS.map((q, idx) => (
                  <div key={q.id} className={`py-5 sm:py-7 md:py-8 ${idx < QUESTIONS.length - 1 ? "border-b" : ""}`} style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                    {/* Separator before Q7 */}
                    {idx === 6 && (
                      <div className="flex items-center gap-4 mb-5 -mt-2">
                        <div className="flex-1 h-px" style={{ background: "rgba(212, 168, 67, 0.2)" }} />
                        <span className="text-[10px] tracking-widest uppercase font-semibold" style={{ color: "rgba(212, 168, 67, 0.6)" }}>Última Pregunta</span>
                        <div className="flex-1 h-px" style={{ background: "rgba(212, 168, 67, 0.2)" }} />
                      </div>
                    )}

                    <h3 className="text-[16px] md:text-[19px] font-bold text-white mb-4" style={{ lineHeight: "1.35" }}>{q.text}</h3>

                    {/* Text input */}
                    {q.type === "text" && (
                      <input type="text" value={answers[idx] || ""} onChange={(e) => setAnswers((prev) => ({ ...prev, [idx]: e.target.value }))} placeholder={q.placeholder}
                        className="w-full px-5 py-4 rounded-lg text-white placeholder-white/25 outline-none text-sm transition-all duration-200"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(212, 168, 67, 0.5)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(212, 168, 67, 0.08)"; }}
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
                                background: isSelected ? "rgba(212, 168, 67, 0.1)" : "rgba(255,255,255,0.03)",
                                border: `1px solid ${isSelected ? "rgba(212, 168, 67, 0.45)" : "rgba(255,255,255,0.08)"}`,
                                color: isSelected ? "#d4a843" : "rgba(255,255,255,0.7)",
                              }}>
                              <div className="w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all" style={{ borderColor: isSelected ? "#d4a843" : "rgba(255,255,255,0.15)", background: isSelected ? "#d4a843" : "transparent" }}>
                                {isSelected && <svg className="w-3 h-3 text-[#060b18]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                              </div>
                              <span>{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}

                {/* Continue button */}
                {phase === "form" && (
                  <div className="pt-6 pb-2">
                    <button onClick={handleContinue} disabled={!allAnswered}
                      className="w-full py-4 rounded-xl text-sm font-bold uppercase cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ letterSpacing: "0.08em", color: "#060b18", backgroundColor: "#d4a843", boxShadow: allAnswered ? "0 6px 30px rgba(212, 168, 67, 0.4)" : "none", transition: "all 0.25s ease" }}
                      onMouseEnter={(e) => { if (allAnswered) { e.currentTarget.style.boxShadow = "0 10px 50px rgba(212, 168, 67, 0.6)"; e.currentTarget.style.transform = "translateY(-2px) scale(1.02)"; } }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = allAnswered ? "0 6px 30px rgba(212, 168, 67, 0.4)" : "none"; e.currentTarget.style.transform = "translateY(0) scale(1)"; }}>
                      CONTINUAR
                    </button>
                  </div>
                )}
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
                      {hostName && (
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold" style={{ background: "linear-gradient(135deg, #d4a843, #e8c45a)", color: "#060b18" }}>
                            {hostName.split(" ").map((w) => w[0]?.toUpperCase() || "").join("").slice(0, 2)}
                          </div>
                          <div className="flex flex-col"><span className="text-[13px] font-medium text-white">{hostName}</span><span className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>Tu asesor</span></div>
                        </div>
                      )}
                      <div className="flex flex-col gap-2 pt-1 text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                        <div className="flex items-center gap-2"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span>{durationMin} min</span></div>
                        <div className="flex items-center gap-2"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" /></svg><span>{leadTimezone.replace(/_/g, " ")}</span></div>
                        {selectedDate && selectedSlot && (
                          <div className="flex items-center gap-2 pt-1"><svg className="w-3.5 h-3.5" style={{ color: "#d4a843" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><span className="font-medium capitalize" style={{ color: "#d4a843" }}>{formatDate(selectedDate)} · {formatSlotTime(selectedSlot)}</span></div>
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
                              const maxDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5);
                              const isTooFar = day > maxDate;
                              const isToday = sameDay(day, today);
                              const isSelected = selectedDate ? sameDay(day, selectedDate) : false;
                              const hasAvailability = availableDaysOfWeek.size === 0 || availableDaysOfWeek.has(day.getDay());
                              const isDisabled = isPast || isTooFar || !hasAvailability || !isCurrentMonth;
                              return (
                                <button key={day.toISOString()} onClick={() => !isDisabled && handleDateSelect(day)} disabled={isDisabled}
                                  className="flex h-8 w-8 sm:h-9 sm:w-9 cursor-pointer items-center justify-center rounded-full border-none text-[11px] sm:text-[12px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-20"
                                  style={{ backgroundColor: isSelected ? "#d4a843" : isToday ? "rgba(212, 168, 67, 0.1)" : "transparent", color: isSelected ? "#060b18" : !isCurrentMonth ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.7)" }}>
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
                              <div className="flex flex-1 items-center justify-center py-8"><div className="w-5 h-5 border-2 border-white/10 border-t-[#d4a843] rounded-full animate-spin" /></div>
                            ) : slots.length === 0 ? (
                              <div className="flex flex-col items-center justify-center gap-2 py-8"><span className="text-[11px] text-center" style={{ color: "rgba(255,255,255,0.25)" }}>No hay horarios disponibles</span></div>
                            ) : (
                              <div className="flex max-h-[280px] flex-col gap-1.5 overflow-y-auto pr-1 scrollbar-thin">
                                {slots.map((slot) => {
                                  const isSlotSelected = selectedSlot === slot;
                                  return (<button key={slot} onClick={() => setSelectedSlot(isSlotSelected ? null : slot)} className="cursor-pointer rounded-lg py-2.5 text-center text-[12px] font-semibold transition-all"
                                    style={{ border: `1px solid ${isSlotSelected ? "#d4a843" : "rgba(255,255,255,0.1)"}`, backgroundColor: isSlotSelected ? "#d4a843" : "rgba(255,255,255,0.03)", color: isSlotSelected ? "#060b18" : "rgba(255,255,255,0.7)" }}>
                                    {formatSlotTime(slot)}
                                  </button>);
                                })}
                              </div>
                            )}
                            {selectedSlot && (
                              <button onClick={handleConfirm} disabled={confirming}
                                className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-none py-3 text-[11px] font-bold uppercase text-[#060b18] transition-all disabled:cursor-not-allowed disabled:opacity-50"
                                style={{ letterSpacing: "0.06em", backgroundColor: "#d4a843", boxShadow: "0 6px 30px rgba(212, 168, 67, 0.4)" }}>
                                {confirming && <div className="w-4 h-4 border-2 border-[#060b18]/30 border-t-[#060b18] rounded-full animate-spin" />}
                                CONFIRMAR MI LLAMADA
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

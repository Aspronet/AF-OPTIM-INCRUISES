"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
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

// ── Theme (dark, matching BookingPage.tsx) ──

const c = {
  pageBg: "#0A0A0A",
  cardBg: "#1A1A1A",
  cardBorder: "#2A2A2A",
  sideBg: "#141414",
  sideBorder: "#2A2A2A",
  textPrimary: "#F5F5F5",
  textSecondary: "#D4D4D4",
  textMuted: "#A3A3A3",
  textSubtle: "#737373",
  textDisabled: "#525252",
  inputBg: "#1A1A1A",
  inputBorder: "#333333",
  dayHoverBg: "#2A2A2A",
  slotBg: "#1A1A1A",
  slotBorder: "#333333",
  slotText: "#F5F5F5",
  navBtnBg: "#1A1A1A",
  navBtnBorder: "#333333",
  navBtnIcon: "#A3A3A3",
  confirmBg: "#141414",
  confirmBorder: "#2A2A2A",
  shadow: "0 4px 24px rgba(0,0,0,0.3)",
};

// ── Component ──

export default function Step3() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const leadTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  // Calendar
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Booking
  const [slug, setSlug] = useState<string | null>(null);
  const [hostName, setHostName] = useState("");
  const [accentColor, setAccentColor] = useState("#0066FF");
  const [bookingTitle, setBookingTitle] = useState("");
  const [bookingDesc, setBookingDesc] = useState("");
  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [durationMin, setDurationMin] = useState(15);
  const [availableDaysOfWeek, setAvailableDaysOfWeek] = useState<Set<number>>(new Set());

  // Lead info (from DB, for booking-confirm)
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");

  // Slots
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const calendarDays = useMemo(() => getCalendarDays(viewYear, viewMonth), [viewYear, viewMonth]);

  // ── Load: email → lead.user_id → booking_link (15min) → availability ──

  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

  useEffect(() => {
    (async () => {
      try {
        // 1. Get lead email from localStorage
        const email = localStorage.getItem("af_lead_email");
        if (!email) { setInitialLoading(false); return; }

        // 2. Find the lead → get the owner's user_id + lead info
        const leadRes = await fetch(
          `${SUPABASE_URL}/rest/v1/leads?email=eq.${encodeURIComponent(email)}&select=user_id,name,phone&order=created_at.desc&limit=1`,
          { headers }
        );
        const leads = await leadRes.json();
        if (!leads?.[0]?.user_id) { setInitialLoading(false); return; }
        const ownerId = leads[0].user_id;
        if (leads[0].name) setLeadName(leads[0].name);
        if (leads[0].phone) setLeadPhone(leads[0].phone);

        // 3. Get the 15-min booking link for that owner
        const linkRes = await fetch(
          `${SUPABASE_URL}/rest/v1/booking_links?user_id=eq.${ownerId}&is_active=eq.true&duration_minutes=eq.15&select=slug,accent_color,title,description,welcome_message,duration_minutes,user_id`,
          { headers }
        );
        const links = await linkRes.json();
        if (!links?.[0]) { setInitialLoading(false); return; }
        const link = links[0];

        setSlug(link.slug);
        if (link.accent_color) setAccentColor(link.accent_color);
        if (link.title) setBookingTitle(link.title);
        if (link.description) setBookingDesc(link.description);
        if (link.welcome_message) setWelcomeMsg(link.welcome_message);
        if (link.duration_minutes) setDurationMin(link.duration_minutes);

        // 4. Get host name
        const profRes = await fetch(
          `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${ownerId}&select=first_name,last_name`,
          { headers }
        );
        const profs = await profRes.json();
        if (profs?.[0]) {
          setHostName(`${profs[0].first_name || ""} ${profs[0].last_name || ""}`.trim());
        }

        // 5. Get which days of week have availability
        const schedRes = await fetch(
          `${SUPABASE_URL}/rest/v1/availability_schedules?user_id=eq.${ownerId}&is_active=eq.true&select=day_of_week`,
          { headers }
        );
        const scheds = await schedRes.json();
        if (Array.isArray(scheds)) {
          const jsDays = new Set(
            scheds.map((s: { day_of_week: number }) => (s.day_of_week === 6 ? 0 : s.day_of_week + 1))
          );
          setAvailableDaysOfWeek(jsDays);
        }

        console.log(`Booking loaded: owner=${ownerId.slice(0,8)} slug=${link.slug} days=${scheds.length}`);

        // 6. Preload slots for today
        fetchSlots(today, link.slug);
      } catch (e) {
        console.error("Init error:", e);
        console.error("Failed to load booking info:", e);
      }
      setInitialLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch slots (direct client fetch, same as BookingPage) ──

  const slugRef = React.useRef(slug);
  slugRef.current = slug;

  async function fetchSlots(date: Date, overrideSlug?: string) {
    const s = overrideSlug || slugRef.current;
    if (!s) return;
    setSlotsLoading(true);
    setSlots([]);
    setSelectedSlot(null);

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/booking-availability?slug=${encodeURIComponent(s)}&date=${dateStr}&timezone=${encodeURIComponent(tz)}`
      );
      const data = await res.json();
      if (res.ok && data.slots) {
        setSlots(data.slots);
        if (data.host) setHostName(data.host);
      }
    } catch (e) {
      console.error("Failed to fetch slots:", e);
    }
    setSlotsLoading(false);
  }

  const handleDateSelect = (date: Date) => {
    if (date < today && !sameDay(date, today)) return;
    setSelectedDate(date);
    fetchSlots(date);
  };

  const handleConfirm = async () => {
    if (!selectedDate || !selectedSlot || !slugRef.current) return;
    setConfirming(true);

    const email = localStorage.getItem("af_lead_email");

    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const d = String(selectedDate.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;

    try {
      // Create the actual booking via booking-confirm edge function
      const res = await fetch(`${SUPABASE_URL}/functions/v1/booking-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slugRef.current,
          date: dateStr,
          time: selectedSlot,
          name: leadName || "Lead",
          email: email || "",
          phone: leadPhone || null,
          timezone: leadTimezone,
          notes: null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error("Booking confirm error:", err);
        setConfirming(false);
        return;
      }
    } catch (e) {
      console.error("Booking confirm failed:", e);
      setConfirming(false);
      return;
    }

    // Track stage
    if (email) await trackFunnelStep(email, "llamada_filtro");

    localStorage.setItem("af_booking", JSON.stringify({
      date: formatDate(selectedDate),
      time: selectedSlot,
      host: hostName,
      duration: durationMin,
      timezone: leadTimezone,
    }));
    router.push("/step/4");
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  // ── Loading state ──

  if (initialLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ fontFamily: "Inter, sans-serif", backgroundColor: c.pageBg }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: c.cardBorder, borderTopColor: accentColor }} />
          <span className="text-[13px]" style={{ color: c.textMuted }}>Cargando disponibilidad...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-8"
      style={{ fontFamily: "Inter, sans-serif", backgroundColor: c.pageBg }}
    >
      <div
        className="flex w-full flex-col overflow-hidden md:max-w-4xl md:flex-row"
        style={{ borderRadius: 16, backgroundColor: c.cardBg, boxShadow: c.shadow, border: `1px solid ${c.cardBorder}` }}
      >
        {/* ── Left panel — meeting info ── */}
        <div
          className="flex flex-col gap-4 md:w-72 shrink-0"
          style={{ padding: 28, borderRight: `1px solid ${c.sideBorder}`, backgroundColor: c.sideBg }}
        >
          {/* Host info */}
          {hostName && (
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-[14px] font-bold text-white"
                style={{ backgroundColor: accentColor }}
              >
                {hostName.split(" ").map((w) => w[0]?.toUpperCase() || "").join("").slice(0, 2)}
              </div>
              <div className="flex flex-col">
                <span className="text-[13px] font-medium" style={{ color: c.textPrimary }}>{hostName}</span>
                <span className="text-[11px]" style={{ color: c.textSubtle }}>Tu asesor personal</span>
              </div>
            </div>
          )}

          <h1 className="text-[22px] font-bold" style={{ fontFamily: "Satoshi, Inter, sans-serif", color: c.textPrimary }}>
            {bookingTitle || "Reunión rápida"}
          </h1>

          <p className="text-[13px] leading-relaxed" style={{ color: c.textMuted }}>
            {bookingDesc || "Elegí el día y horario que más te convenga para que podamos conversar sobre la oportunidad."}
          </p>

          {welcomeMsg && (
            <p className="text-[13px] italic" style={{ color: c.textSubtle }}>{welcomeMsg}</p>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5" style={{ color: c.textMuted }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[13px]" style={{ color: c.textMuted }}>{durationMin} min</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5" style={{ color: c.textMuted }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
              </svg>
              <span className="text-[13px]" style={{ color: c.textMuted }}>
                {leadTimezone.replace(/_/g, " ")}
              </span>
            </div>
            {selectedDate && selectedSlot && (
              <div className="flex items-center gap-2 pt-1">
                <svg className="w-3.5 h-3.5" style={{ color: accentColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-[13px] font-medium capitalize" style={{ color: accentColor }}>
                  {formatDate(selectedDate)} · {formatSlotTime(selectedSlot)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel — calendar + slots ── */}
        <div className="flex flex-1 flex-col" style={{ padding: 28, minHeight: 460 }}>
          <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
            {/* Calendar */}
            <div className="flex flex-col gap-4 lg:min-w-[320px] shrink-0">
              <h2 className="text-[16px] font-bold" style={{ color: c.textPrimary }}>Seleccioná una fecha</h2>

              {/* Month header */}
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-bold" style={{ fontFamily: "Satoshi, Inter, sans-serif", color: c.textPrimary }}>
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={prevMonth}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md"
                    style={{ border: `1px solid ${c.navBtnBorder}`, backgroundColor: c.navBtnBg }}
                  >
                    <svg className="w-4 h-4" style={{ color: c.navBtnIcon }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={nextMonth}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md"
                    style={{ border: `1px solid ${c.navBtnBorder}`, backgroundColor: c.navBtnBg }}
                  >
                    <svg className="w-4 h-4" style={{ color: c.navBtnIcon }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7">
                {DAY_HEADERS.map((d) => (
                  <div key={d} className="flex items-center justify-center py-1.5">
                    <span className="text-[11px] font-semibold" style={{ color: c.textSubtle }}>{d}</span>
                  </div>
                ))}
              </div>

              {/* Day grid — 42 cells */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                  const isCurrentMonth = day.getMonth() === viewMonth;
                  const isPast = day < today && !sameDay(day, today);
                  const isToday = sameDay(day, today);
                  const isSelected = selectedDate ? sameDay(day, selectedDate) : false;
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const hasAvailability = availableDaysOfWeek.size === 0 || availableDaysOfWeek.has(day.getDay());
                  const isDisabled = isPast || !hasAvailability || !isCurrentMonth;

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => !isDisabled && handleDateSelect(day)}
                      disabled={isDisabled}
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-none text-[13px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-30"
                      style={{
                        backgroundColor: isSelected ? accentColor : isToday ? `${accentColor}15` : "transparent",
                        color: isSelected ? "#FFFFFF" : !isCurrentMonth ? c.textDisabled : isWeekend ? c.textSubtle : c.textPrimary,
                      }}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time slots */}
            {selectedDate && (
              <div
                className="flex flex-col gap-3 border-t pt-4 lg:w-[200px] lg:min-w-[200px] lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6"
                style={{ borderColor: c.slotBorder }}
              >
                <h3 className="text-[14px] font-bold" style={{ color: c.textPrimary }}>Elegí un horario</h3>
                <p className="text-[12px] capitalize" style={{ color: c.textMuted }}>
                  {formatDate(selectedDate)}
                </p>

                {slotsLoading ? (
                  <div className="flex flex-1 items-center justify-center py-8">
                    <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: c.cardBorder, borderTopColor: accentColor }} />
                  </div>
                ) : slots.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-8">
                    <svg className="w-5 h-5" style={{ color: c.textSubtle }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-[12px] text-center" style={{ color: c.textSubtle }}>
                      No hay horarios disponibles para esta fecha
                    </span>
                  </div>
                ) : (
                  <div className="flex max-h-[300px] flex-col gap-1.5 overflow-y-auto pr-1 scrollbar-thin">
                    {slots.map((slot) => {
                      const isSlotSelected = selectedSlot === slot;
                      return (
                        <button
                          key={slot}
                          onClick={() => setSelectedSlot(isSlotSelected ? null : slot)}
                          className="cursor-pointer rounded-lg py-2.5 text-center text-[13px] font-semibold transition-all"
                          style={{
                            border: `1px solid ${isSlotSelected ? accentColor : c.slotBorder}`,
                            backgroundColor: isSlotSelected ? accentColor : c.slotBg,
                            color: isSlotSelected ? "#FFFFFF" : c.slotText,
                          }}
                        >
                          {formatSlotTime(slot)}
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedSlot && (
                  <button
                    onClick={handleConfirm}
                    disabled={confirming}
                    className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-none py-3 text-[14px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ backgroundColor: accentColor }}
                  >
                    {confirming && (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    )}
                    Confirmar horario
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center">
        <span className="text-[11px]" style={{ color: c.textSubtle }}>Powered by AsproFunnel</span>
      </div>
    </div>
  );
}

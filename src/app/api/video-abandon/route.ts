import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = "https://pcmuwwfivmstqnoiyqur.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjbXV3d2Zpdm1zdHFub2l5cXVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NzA1MTMsImV4cCI6MjA4NzA0NjUxM30.MQ3aBluqw3nBz8FcAL9lc564JGsgEkm-E_FGuqfEoZE";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { leadId, userId, videoName, step, percentWatched, totalWatchTime, currentTime, duration } = body;

    if (!leadId || !userId) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    await fetch(`${SUPABASE_URL}/rest/v1/lead_activity`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        lead_id: leadId,
        user_id: userId,
        action: "funnel_video_abandoned",
        metadata: {
          step: step ?? 2,
          video: videoName || "VSL",
          percent: percentWatched ?? 0,
          seconds_watched: totalWatchTime ?? 0,
          current_time: currentTime ?? 0,
          video_duration: duration ?? 0,
        },
      }),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

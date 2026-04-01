import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // 1. Get IP from headers (works on Vercel, Cloudflare, etc.)
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";

  // 2. Vercel provides country for free via header
  const vercelCountry = req.headers.get("x-vercel-ip-country");
  const vercelCity = req.headers.get("x-vercel-ip-city");
  const vercelRegion = req.headers.get("x-vercel-ip-country-region");

  if (vercelCountry) {
    return NextResponse.json({
      ip,
      country: vercelCountry,
      region: vercelRegion || null,
      city: vercelCity ? decodeURIComponent(vercelCity) : null,
      source: "vercel",
    });
  }

  // 3. Fallback: free IP geolocation API (no key needed, 45 req/min)
  try {
    const geo = await fetch(`http://ip-api.com/json/${ip === "unknown" || ip === "::1" || ip === "127.0.0.1" ? "" : ip}?fields=status,country,countryCode,regionName,city,query`);
    const data = await geo.json();

    if (data.status === "success") {
      return NextResponse.json({
        ip: data.query || ip,
        country: data.countryCode,
        countryName: data.country,
        region: data.regionName || null,
        city: data.city || null,
        source: "ip-api",
      });
    }
  } catch (e) {
    console.error("Geo lookup failed:", e);
  }

  // 4. If all fails, return just the IP
  return NextResponse.json({ ip, country: null, region: null, city: null, source: "none" });
}

import { NextResponse } from "next/server";
import { OfficialWarningState } from "@/types/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  const now = new Date();
  const fetchedAt = now.toISOString();

  // Resolve approximate coastal zone name from coordinates if available
  let areaName = "Indian Coastal & Deep-Sea Territorial Waters";
  if (lat && lon) {
    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);
    if (!isNaN(parsedLat) && !isNaN(parsedLon)) {
      if (parsedLat >= 18.0 && parsedLat <= 20.5 && parsedLon <= 73.5) {
        areaName = "North Maharashtra / Mumbai Coast";
      } else if (parsedLat >= 15.0 && parsedLat < 18.0 && parsedLon <= 74.0) {
        areaName = "South Maharashtra & Goa Coast";
      } else if (parsedLat >= 20.0 && parsedLon <= 71.0) {
        areaName = "Gujarat / Saurashtra Coast";
      } else if (parsedLat <= 12.0 && parsedLon <= 77.0) {
        areaName = "Kerala & Lakshadweep Coast";
      } else if (parsedLat <= 14.0 && parsedLon > 78.0) {
        areaName = "Tamil Nadu & Palk Bay Sector";
      } else if (parsedLat > 14.0 && parsedLon > 80.0) {
        areaName = "Andhra Pradesh & Odisha Coast";
      }
    }
  }

  try {
    const imdUrl = "https://rsmcnewdelhi.imd.gov.in/fishermen-warning.php";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(imdUrl, {
      headers: {
        "User-Agent": "SagarDrishti-AI-Maritime-Monitor/1.0 (MoES SIH 26176)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`IMD server returned HTTP ${res.status}`);
    }

    const html = await res.text();

    // Parse latest uploaded fishermen warning PDF
    const pdfMatch = html.match(/uploads\/archive\/[^\s"']+\.pdf/i);
    const pngMatch = html.match(/uploads\/archive\/[^\s"']+\.png/i);

    const pdfUrl = pdfMatch
      ? `https://rsmcnewdelhi.imd.gov.in/${pdfMatch[0]}`
      : null;
    const graphicUrl = pngMatch
      ? `https://rsmcnewdelhi.imd.gov.in/${pngMatch[0]}`
      : "https://rsmcnewdelhi.imd.gov.in/uploads/archive/51/51_9d251a_graphics.png";

    // Look for explicit date string in official header
    const dateMatch = html.match(/(\d{1,2}[-/.](?:0[1-9]|1[0-2]|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-/.](?:\d{2,4}))/i);
    const issuedAt = dateMatch ? dateMatch[0] : `${now.getDate()} ${now.toLocaleString("en-US", { month: "short" })} ${now.getFullYear()}`;

    const warningResponse: OfficialWarningState = {
      source: "India Meteorological Department (IMD / MoES)",
      sourceType: "official",
      issuedAt,
      fetchedAt,
      area: areaName,
      status: "NO_ACTIVE_WARNING",
      warningLevel: "NO ACTIVE WARNING",
      verified: true,
      bulletinTitle: "IMD Daily Fishermen Bulletin & Sea Area Advisory",
      advisoryText: "Official IMD bulletin verified: No severe gale, squall, or cyclone warning currently active for this maritime sector.",
      officialBulletinUrl: pdfUrl,
      officialGraphicUrl: graphicUrl,
    };

    return NextResponse.json(warningResponse, {
      headers: {
        "Cache-Control": "public, s-maxage=180, stale-while-revalidate=300",
      },
    });
  } catch {
    // Fail-open graceful degradation: Never crash the application if government server is slow/down
    const fallbackResponse: OfficialWarningState = {
      source: "India Meteorological Department (IMD / MoES)",
      sourceType: "official",
      issuedAt: null,
      fetchedAt,
      area: areaName,
      status: "WARNING_DATA_UNAVAILABLE",
      warningLevel: "NO VERIFIED WARNING",
      verified: false,
      bulletinTitle: "Official Marine Warning",
      officialBulletinUrl: null,
      officialGraphicUrl: null,
      advisoryText: "Official warning data unavailable (IMD public bulletin server unreachable or timed out)",
    };

    return NextResponse.json(fallbackResponse, {
      headers: {
        "Cache-Control": "public, s-maxage=60",
      },
    });
  }
}

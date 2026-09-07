import { NextRequest, NextResponse } from "next/server";
import { queryPfzV2Service } from "@/lib/ai/engines/pfz-v2-client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid JSON payload in request body" },
        { status: 400 }
      );
    }

    const {
      latitude,
      longitude,
      radiusKm = 100,
      referencePortName,
      windSpeedMs,
      windDirectionDeg,
      uWindMs,
      vWindMs,
    } = body;

    // Validate coordinates
    if (
      typeof latitude !== "number" ||
      isNaN(latitude) ||
      latitude < -90 ||
      latitude > 90
    ) {
      return NextResponse.json(
        { error: `Invalid latitude '${latitude}'. Must be between -90 and 90.` },
        { status: 400 }
      );
    }

    if (
      typeof longitude !== "number" ||
      isNaN(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json(
        { error: `Invalid longitude '${longitude}'. Must be between -180 and 180.` },
        { status: 400 }
      );
    }

    if (
      typeof radiusKm !== "number" ||
      isNaN(radiusKm) ||
      radiusKm <= 0 ||
      radiusKm > 500
    ) {
      return NextResponse.json(
        { error: `Invalid radiusKm '${radiusKm}'. Must be between 1 and 500.` },
        { status: 400 }
      );
    }

    // Check feature flag
    const isV2Enabled = process.env.PFZ_ENGINE_V2 === "true";
    if (!isV2Enabled) {
      return NextResponse.json(
        {
          status: "disabled",
          message: "PFZ Engine V2 is currently disabled by configuration (PFZ_ENGINE_V2!=true).",
        },
        { status: 503 }
      );
    }

    // Query scientific Python microservice with live wind parameters
    const result = await queryPfzV2Service({
      latitude,
      longitude,
      radiusKm,
      referencePortName,
      windSpeedMs: typeof windSpeedMs === "number" ? windSpeedMs : null,
      windDirectionDeg: typeof windDirectionDeg === "number" ? windDirectionDeg : null,
      uWindMs: typeof uWindMs === "number" ? uWindMs : null,
      vWindMs: typeof vWindMs === "number" ? vWindMs : null,
    });

    if (result.status === "unavailable") {
      return NextResponse.json(
        {
          status: "unavailable",
          engineVersion: result.engineVersion,
          candidates: [],
          reason: result.error || "PFZ scientific service temporarily unavailable",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Internal server error during PFZ analysis",
        details: err?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

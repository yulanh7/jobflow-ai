// Returns current usage counts for the requesting IP (read-only, no increment)

import { NextRequest, NextResponse } from "next/server";
import { getUsageStatus, IP_LIMIT, GLOBAL_LIMIT, getResetTimeISO } from "@/lib/rateLimit";

function getIP(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "127.0.0.1";
}

export async function GET(req: NextRequest) {
  try {
    const { ipCount, globalCount } = await getUsageStatus(getIP(req));
    return NextResponse.json({
      ipCount,
      globalCount,
      ipLimit: IP_LIMIT,
      globalLimit: GLOBAL_LIMIT,
      resetAt: getResetTimeISO(),
    });
  } catch {
    return NextResponse.json({ ipCount: 0, globalCount: 0, ipLimit: IP_LIMIT, globalLimit: GLOBAL_LIMIT, resetAt: null });
  }
}

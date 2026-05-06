// Validates the studio password against the STUDIO_PASSWORD environment variable

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (password === process.env.STUDIO_PASSWORD) {
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false }, { status: 401 });
}

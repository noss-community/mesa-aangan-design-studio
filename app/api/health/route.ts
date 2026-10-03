import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, service: "aangan-voice-agent", time: new Date().toISOString() });
}

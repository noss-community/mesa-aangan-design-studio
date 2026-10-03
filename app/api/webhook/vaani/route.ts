import { NextRequest, NextResponse } from "next/server";
import { handleCallPostprocessing, handleCallStarted, handleLifecycleEvent } from "@/lib/callFlow";
import type { VaaniWebhookEnvelope } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vaani's webhook registration (dashboard: Settings -> Webhooks) doesn't support a signing
// secret, so we authenticate via a secret query param baked into the URL we register there:
// https://<your-deployment>/api/webhook/vaani?key=<VAANI_WEBHOOK_SECRET>
function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.VAANI_WEBHOOK_SECRET;
  if (!expected) return true; // no secret configured yet — allow through during initial setup
  return req.nextUrl.searchParams.get("key") === expected;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Parse leniently: Vaani's dashboard "Test Connectivity" button (and possibly other platform
  // pings) may send a body that isn't valid JSON, or valid JSON with no `event` field at all.
  // Rejecting those with 4xx only makes the integration look broken in Vaani's UI — the only
  // thing that should ever fail here is a bad/missing auth secret, already handled above.
  let payload: Partial<VaaniWebhookEnvelope> = {};
  try {
    payload = (await req.json()) as VaaniWebhookEnvelope;
  } catch {
    console.log("Vaani webhook: non-JSON body received (likely a connectivity test) — acking 200.");
    return NextResponse.json({ ok: true });
  }

  if (!payload || typeof payload !== "object" || !payload.event) {
    console.log("Vaani webhook: payload with no `event` field received (likely a connectivity test) — acking 200.", payload);
    return NextResponse.json({ ok: true });
  }

  try {
    switch (payload.event) {
      case "call_started":
        await handleCallStarted({
          roomName: payload.room_name ?? "",
          phoneNumber: payload.phone_number,
        });
        break;

      case "call_postprocessing":
        if (!payload.data) {
          console.error("call_postprocessing payload missing `data`:", payload);
          break;
        }
        await handleCallPostprocessing(payload.data);
        break;

      default:
        // call_ringing, user_picked_up_at, call_rejected, call_no_answer, call_failed, call_ended,
        // human_transfer_* — all fire-and-forget notifications, logged and acked.
        await handleLifecycleEvent(payload as VaaniWebhookEnvelope);
    }
  } catch (err) {
    console.error(`Vaani webhook error (event=${payload.event}):`, err);
    // Still ack with 200: Vaani has no documented retry/backoff semantics, and surfacing a 500
    // risks it giving up on this call's remaining events. The error is logged for investigation.
  }

  return NextResponse.json({ ok: true });
}

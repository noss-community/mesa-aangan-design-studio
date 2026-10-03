// Simulates Vaani's real webhook events (call_started, then call_postprocessing with a transcript
// string in Vaani's observed "[HH:MM:SS] ROLE: text" format) against a running dev server, so the
// post-call pipeline (Gemini analysis -> Cal.com booking -> HubSpot deal -> handoff note -> Neon)
// can be exercised end-to-end without a real phone call.
//
// Usage:
//   npm run dev                       (in one terminal)
//   npm run simulate:call             (in another — scripted qualified call, books a real slot)
//   npm run simulate:call -- escalate
//   npm run simulate:call -- declined
//
// Requires GEMINI_API_KEY, CALCOM_*, HUBSPOT_*, DATABASE_URL already set in .env.local — this
// hits the real APIs (no sandbox), so a "qualified"/"accept" run WILL create a real Cal.com
// booking and HubSpot deal.
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

const BASE_URL = process.env.SIMULATE_BASE_URL ?? "http://localhost:3000";
const SECRET = process.env.VAANI_WEBHOOK_SECRET ?? "";
const roomName = `sim-${Date.now()}`;

function transcriptFrom(lines) {
  let t = new Date();
  return lines
    .map(([role, text]) => {
      t = new Date(t.getTime() + 15000);
      const stamp = t.toTimeString().slice(0, 8);
      return `[${stamp}] ${role}: ${text}`;
    })
    .join("\n");
}

const scripts = {
  qualified: transcriptFrom([
    ["AGENT", "Hi! You've reached Aangan Studio. How can I help you today?"],
    ["USER", "Hi, I want to redo my full living room and get it executed, we're moving into a new flat."],
    ["AGENT", "Wonderful, and where is the site located?"],
    ["USER", "It's in Baner, Pune."],
    ["AGENT", "Great, that's in our service area. Do you have a timeline in mind?"],
    ["USER", "We're not in a rush, site will be ready in about 12 weeks."],
    ["AGENT", "That works well for us. And will you be the one deciding on this project?"],
    ["USER", "Yes, I'm the one deciding."],
    ["AGENT", "Perfect, you sound like a great fit for a consultation. Best number to reach you on?"],
    ["USER", "This number is fine, mornings work best for me generally."],
  ]),
  escalate: transcriptFrom([
    ["AGENT", "Hi! You've reached Aangan Studio. How can I help you today?"],
    ["USER", "Can you connect me to a designer directly? I'd rather talk to a person."],
    ["AGENT", "Of course — let me get you connected with the team."],
  ]),
  declined: transcriptFrom([
    ["AGENT", "Hi! You've reached Aangan Studio. How can I help you today?"],
    ["USER", "I need my flat in Nashik redesigned, just need a design plan, I'll execute it myself."],
    ["AGENT", "I see — unfortunately Nashik is outside our service area, and we only take on full-execution projects."],
    ["USER", "Okay, understood."],
  ]),
};

const scriptName = process.argv[2] ?? "qualified";
const transcript = scripts[scriptName];
if (!transcript) {
  console.error(`Unknown script "${scriptName}". Available: ${Object.keys(scripts).join(", ")}`);
  process.exit(1);
}

async function post(body) {
  const url = new URL(`${BASE_URL}/api/webhook/vaani`);
  if (SECRET) url.searchParams.set("key", SECRET);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`  -> HTTP ${res.status}`, text);
    process.exit(1);
  }
  return text;
}

console.log(`Simulating call ${roomName} with script "${scriptName}"\n`);

await post({ event: "call_started", room_name: roomName, status: "answered", phone_number: "+919820000000" });
console.log("call_started sent.");

const durationMs = transcript.split("\n").length * 15000;
await post({
  event: "call_postprocessing",
  call_id: roomName,
  timestamp: new Date().toISOString(),
  data: {
    room_name: roomName,
    call_id: roomName,
    call_duration: durationMs,
    end_reason: "Call ended",
    entities: { caller_name: "Simulated Caller" },
    transcript,
  },
});
console.log("call_postprocessing sent — check server logs, the dashboard, and your Neon `calls` table.");

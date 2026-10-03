# Aangan Studio — Voice Agent

Inbound-call voice agent for Aangan Studio (14-designer interior design studio, Pune). Vaani's
native agent answers the call and holds the live conversation; once the call ends, our backend
scores it against Nikhil's five-criterion rubric with Gemini, books a Cal.com consultation,
creates a HubSpot deal, and assembles a handoff note — then gives Nikhil a dashboard so he never
has to pull these numbers by hand again.

**Scope**: phone calls only (WhatsApp / web form are out of scope for this build, per the case brief).

## Architecture — and why it isn't what was originally sketched

The original design called for "every caller turn triggers a Gemini API call" via a webhook Vaani
calls mid-conversation. Once real API access was available, that turned out not to match how Vaani
actually works:

- Vaani's webhook events (`call_started`, `call_postprocessing`, etc.) are **fire-and-forget
  notifications** — the receiver just returns `200 OK`; nothing in the response drives the call.
- The only documented way for an external LLM to control live turns is **BYOL** (Bring Your Own
  LLM): a persistent WebSocket server Vaani connects to per call. That can't run as a Vercel
  serverless function, and "book + confirm live on the call" would also need an undocumented
  mid-call function-calling capability that doesn't appear to exist yet.

Given that, this build uses **Vaani's native agent**: its own LLM holds the live conversation,
driven by a system prompt generated from the exact same rubric (`lib/rubric.ts`) that the post-call
Gemini analysis scores against — one source of truth, two consumers. Gemini's role shifted from
"drives every turn live" to **"scores and summarizes the finished call, once, right after it
ends"** — still exactly one Gemini call per completed call, just positioned differently. See
[[vaani-byol-architecture]] in this session's memory for the full investigation, or ask to see it
re-litigated if the BYOL route becomes worth revisiting later (e.g. if live function-calling turns
out to be supported after all).

**Known consequence**: "confirm the booking verbally before hanging up" isn't achievable this way —
there's no live hook for our backend to act mid-call. The live agent instead tells qualified
callers the team will confirm their exact slot shortly, and our backend actually books the next
available Cal.com slot within seconds of call end (from `call_postprocessing`), before the handoff
note or CRM deal are created.

```
Caller ⇄ Vaani's native agent (its own LLM, driven by our system prompt)
              │  fire-and-forget webhook events per call
              ▼
   POST /api/webhook/vaani  (this app, Next.js on Vercel)
              │
    call_started           → open a `calls` row, record start time
    call_postprocessing     → the real work:
              ├─ parse Vaani's transcript string
              ├─ Gemini: score the 5 criteria, detect escalation, write the 3-sentence summary
              ├─ if qualified: Cal.com next-slot lookup + booking
              ├─ if qualified or escalated: assemble + store the handoff note
              ├─ if booked: create the HubSpot deal (transcript note + 5 criteria properties)
              └─ persist everything to Neon
              ▼
   /dashboard  →  Performance panel + Economics panel (reads Neon + live rates)
```

## What's already provisioned (2026-10-03)

These were created via each service's API during setup — all real, live resources on the
project owner's own accounts (not sandboxes):

| Resource | ID / value | Notes |
|---|---|---|
| Neon project | `aangan-voice-agent` (`autumn-cake-58761595`) | Schema applied, isolated from other projects on the account |
| Cal.com event type | "Aangan Studio — Design Consultation", 60 min, id `7330798` | `cal.com/mihirrsose/aangan-design-consultation` |
| HubSpot deal stage | "Consultation Booked", id `4391698123`, in the default Sales Pipeline | Plus 5 custom deal properties `aangan_criterion_1_answer`…`_5_answer` |
| Vaani agent | "Aangan Studio — Front Desk", id `411ae6d1-60be-4967-a214-7db42667ddb7` | System prompt + analysis config set; **no phone number or webhook URL yet** — see below |

All corresponding keys/IDs are already in `.env.local` (gitignored — never commit it).

## Manual dashboard steps still needed

Two things Vaani's public API doesn't expose at all — confirmed by testing, not just reading docs:

1. **Register the webhook URL.** Vaani dashboard → Settings → Webhooks → add
   `https://<your-deployed-url>/api/webhook/vaani?key=<VAANI_WEBHOOK_SECRET from .env.local>`.
   There's no signing/HMAC on Vaani's side, so the secret query param is the only auth — keep the
   URL itself private.
2. **Provision + assign an inbound phone number.** Buying/porting a number isn't in the public API
   (dashboard-only, per Vaani's own telephony guide). Once you have one, either do it in the
   dashboard or run `assignInboundNumber()` from `lib/vaaniAgent.ts` — confirmed API shape:
   `PATCH /api/agent/{agent_id}/deployment` with
   `{"deployment":{"phone":{"call_type":{"Inbound":"+91..."}}}}`.
3. **Optional: a human call-transfer number**, if you want escalation conditions (1)/(4) in the
   rubric to actually transfer the call live rather than just promise a callback — Vaani's webhook
   events include `human_transfer_initiated/successful/failed`, implying this is a native
   capability, but the field to configure it isn't in the public API docs either. Check the
   dashboard directly.

## The qualification engine, now

`lib/gemini.ts`'s `analyzeCompletedCall()` runs once per finished call, from the
`call_postprocessing` handler in `lib/callFlow.ts`. It receives the parsed transcript and returns
structured JSON (Gemini's `responseSchema`, not free text): per-criterion qualification status,
overall status, escalation detection, and the three-sentence summary — all scored against the same
rubric content (`lib/rubric.ts`, sourced from `agent-context.txt` / `services.md`) that
`lib/vaaniPrompt.ts` turns into the live agent's system prompt. Run `npm run vaani:sync` after
editing the rubric to push an updated prompt to the live agent — don't edit it only in one place.

Booking is still **not** left to an LLM to guess at: `lib/callFlow.ts` calls Cal.com's real
slots/booking endpoints directly once a call is scored "qualified."

**Cal.com quirks found by testing against the live API, not documented anywhere obvious:**
- `GET /v2/slots` needs `cal-api-version: 2024-09-04` specifically — the `2024-08-13` version used
  for bookings/event-types 404s on it. (`lib/calcom.ts` uses the two versions separately now.)
- Booking requires an attendee email whose *domain* has real MX records, even with no real mailbox
  behind it — an RFC 2606 reserved domain like `.invalid` gets rejected with
  `email_domain_cannot_receive_mail`. We use `aangan-voice-agent-caller-<phone digits>@gmail.com` as
  a placeholder; any mail Cal.com tries to send there just bounces, harmlessly. The team works off
  the phone number (stored in booking metadata + the handoff note), not a calendar-invite email.

## Working hours

`lib/workingHours.ts` checks IST 10am–7pm — used to tag each call (`within_working_hours`) for the
dashboard's overnight-call metric. The *live* agent has no clock access (not exposed by Vaani for
inbound calls), so its system prompt is deliberately clock-agnostic: it acknowledges odd-hour calls
warmly without claiming to know the exact time, and never lets being outside hours block
qualification or booking.

## Handoff note

Assembled in `call_postprocessing` as soon as a call resolves qualified/booked or escalated — full
transcript, the three-sentence Gemini summary, one line per qualification criterion, the
qualifying/escalation reason (plus any scheduling preference Vaani's own data-extraction picked up
from the caller), and the confirmed slot if any. Stored in the `handoff_notes` table and logged to
the console. **Delivery channel (Telegram vs. email) is intentionally not wired yet** — next
session's decision; `channel` defaults to `'pending'`, so sending it later is a pure delivery step.

## Logging

`calls` and `call_turns` (see `db/schema.sql`) record caller details, the parsed transcript,
Gemini token usage, and Vaani call duration (`call_postprocessing`'s `data.call_duration` arrives in
**milliseconds** — converted to seconds on the way in). Cost is **not** pre-computed and stored —
it's calculated at dashboard-read time from raw usage × current rates, so a rate change is
reflected immediately (see below).

## Dashboard

`/dashboard` — two panels, recomputed on every page load:

**Performance** (last 30 days, configurable via `?periodDays=`): median time-to-first-response, %
answered under 60s, overnight call count (7pm–10am IST), qualified ÷ total rate.

Worth knowing: because Vaani's agent auto-answers every inbound call, `first_response_at` is set
equal to `call_started_at` — there's no documented way to measure a finer-grained "agent started
speaking" timestamp, and conceptually there's no human-style ring delay to measure here anyway.
This metric should read as ~0s / ~100% across the board — that collapse to zero *is* the
automation's headline result versus a 2-person front desk, not a bug in the measurement.

**Economics** (current calendar month): AI cost per call, total AI spend, consultations booked,
estimated pipeline (booked × avg. project value), ROI multiple. Also at `GET /api/dashboard/metrics`.

### Live-editable rates (no redeploy)

The brief requires that changing `VAANI_LABS_RATE_PER_MIN`, `GEMINI_API_RATE_PER_MILLION`, or
`AVERAGE_PROJECT_VALUE_INR` update the dashboard on next refresh **without a redeploy**. Plain
Vercel environment variables don't actually satisfy this — Vercel bakes env vars into a deployment
and only picks up changes on the next deploy. So this app reads rates from **Vercel Edge Config**
first, falling back to plain env vars (defaults 12 / 300 / 1,100,000) if Edge Config isn't set up:

1. In the Vercel dashboard: Storage → Create → Edge Config, link it to this project (sets the
   `EDGE_CONFIG` env var automatically).
2. Add three items: `VAANI_LABS_RATE_PER_MIN`, `GEMINI_API_RATE_PER_MILLION`,
   `AVERAGE_PROJECT_VALUE_INR`.
3. Edit them any time in the Vercel dashboard — the Economics panel picks it up on its very next
   refresh, no redeploy.

Without Edge Config, the plain env vars still work as defaults — just need a redeploy after a change.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in your keys, or reuse the already-provisioned ones above
npm run db:migrate           # applies db/schema.sql to your Neon database
npm run vaani:sync           # creates/updates the Vaani agent from lib/rubric.ts
npm run dev
```

To exercise the full post-call pipeline locally without a real phone call — this hits the real
Gemini/Cal.com/HubSpot/Neon APIs, no sandbox, so the "qualified" script **will create a real
Cal.com booking and HubSpot deal**:

```bash
npm run simulate:call             # scripted qualified caller → books a real slot
npm run simulate:call -- escalate # scripted "connect me to a person" call
npm run simulate:call -- declined # scripted out-of-area, advice-only caller
```

All three were run against the live APIs during this build (not just typechecked) — qualified
correctly booked `Monday, 5 Oct, 9:00 am` and created a HubSpot deal; escalate correctly detected
condition 1 with no booking/deal; declined correctly produced no handoff note at all, matching the
"handoff note only on qualified or escalated" spec.

### Environment variables

See `.env.example` for the full list. Already filled into `.env.local` for this build; if setting
up fresh you'll need, at minimum: `DATABASE_URL` (Neon), `GEMINI_API_KEY`, `VAANI_API_KEY` +
`VAANI_AGENT_ID` + `VAANI_WEBHOOK_SECRET`, `CALCOM_API_KEY` + `CALCOM_EVENT_TYPE_ID`,
`HUBSPOT_ACCESS_TOKEN` + `HUBSPOT_DEAL_STAGE_ID`.

### Deploying

Standard Next.js app — push to a Git repo and import into Vercel, or `vercel --prod` from this
directory. Set the environment variables above in the Vercel project settings (and link an Edge
Config store per the section above for no-redeploy rate changes), then run `npm run db:migrate`
once against the same `DATABASE_URL`. After deploying, come back to the two manual dashboard steps
above (webhook URL, phone number) — the app won't receive any real calls until those are done.

## Security notes

`npm audit` reports a handful of advisories against Next.js's and `eslint-config-next`'s own
bundled dependencies (an Image-Optimization-API AVIF RCE, an internal `postcss` issue, a `glob` CLI
command-injection issue) — all only fixed upstream by jumping to a breaking major version, which
this build deliberately avoids doing sight unseen. None are reachable in how this app is actually
used: `next/image` is never rendered, `postcss` only ever compiles this repo's own trusted Tailwind
source at build time, and `glob`/`eslint-config-next` are dev-only tooling that never ships to the
deployed serverless functions. Re-run `npm audit` before a production deploy and reassess if that
calculus changes.

Live credentials (`.env.local`) are gitignored and were never committed or printed in full in
chat history beyond what the user themselves provided.

## Project layout

```
app/
  api/webhook/vaani/route.ts      webhook entry point (auth + dispatch only)
  api/dashboard/metrics/route.ts  JSON metrics endpoint
  dashboard/page.tsx              the dashboard
lib/
  callFlow.ts                     call_started / call_postprocessing / lifecycle-event handlers
  gemini.ts                       post-call analysis (qualification + escalation + summary)
  rubric.ts                       rubric / scope / escalation content (from the source docs)
  vaaniPrompt.ts                  generates the live agent's system prompt from rubric.ts
  vaaniAgent.ts                   Vaani REST client (create/update agent config)
  transcript.ts                   parses Vaani's "[HH:MM:SS] ROLE: text" transcript string
  calcom.ts, hubspot.ts           integration clients
  handoff.ts                      handoff note assembly + persistence
  metrics.ts, rates.ts            dashboard math + live rate resolution
  workingHours.ts, format.ts, types.ts, db.ts
db/schema.sql, db/migrate.mjs     Postgres schema + one-shot migration runner
scripts/
  setup-vaani-agent.ts            create/sync the Vaani agent from lib/rubric.ts (npm run vaani:sync)
  simulate-call.mjs               local end-to-end test harness against the real APIs
components/dashboard/             panel + metric-card UI
```

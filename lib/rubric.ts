// Static studio knowledge the qualification engine is grounded in. Sourced from
// agent-context.txt and services.md — kept as code (not fetched at runtime) since the voice
// webhook is a stateless serverless function with no access to the source documents.

export const CRITERIA = [
  {
    id: "criterion_1",
    title: "Real project — not just advice",
    passing:
      'The caller describes wanting their space transformed and expects someone else to handle the execution — e.g. "we want to redo our living room and get it done."',
    failing:
      'The caller says "I just want some ideas," "can you come and look and give me suggestions," or "I\'ll manage the work myself — I just need a design plan."',
  },
  {
    id: "criterion_2",
    title: "In the service area",
    passing:
      "The caller names a location within Pune city or PCMC — Baner, Wakad, Kothrud, Kalyani Nagar, Pimple Saudagar, Hadapsar, Viman Nagar, Hinjewadi, or any comparable address.",
    failing:
      "The caller's site is in Talegaon, Lonavala, Nashik, Mumbai, or any city or town outside Pune and PCMC.",
  },
  {
    id: "criterion_3",
    title: "Realistic timeline",
    passing:
      "The caller says the site will be ready and they need the project complete in ten or more weeks, or they haven't named a hard deadline at all.",
    failing:
      "The caller needs the work done in the next three to five weeks, or names a move-in date leaving fewer than six weeks from today for execution to begin and finish.",
  },
  {
    id: "criterion_4",
    title: "Right budget band (broadly)",
    passing:
      "The caller has not volunteered a budget figure, or the number they mention is not clearly below what their described scope would require.",
    failing:
      "The caller volunteers a specific number that is obviously too low for what they're describing — e.g. Rs. 1–1.5 lakh for a full flat redesign, or Rs. 50,000 for a bedroom renovation with all new furniture and flooring.",
  },
  {
    id: "criterion_5",
    title: "Decision-maker on the call (or represented)",
    passing:
      "The caller confirms they are the one who will decide and sign off, or says they're calling on behalf of the owner and confirms they've been authorised to move forward and book.",
    failing:
      '"I\'m just doing early research for my in-laws" or "my spouse is the one who\'ll decide but they\'re not available right now" without confirming authority to take the next step.',
  },
] as const;

export const QUALIFICATION_RULES = `
- If a criterion is unclear, ask ONE direct question about it before moving on — do not guess.
- Unclear on criterion 1, 2, or 3: ask one direct question to resolve it.
- Unclear on criterion 4 or 5: do not push or probe further. Treat as passing for now and note the
  uncertainty — the designer will resolve it at the consultation.
- If two or more criteria clearly fail, decline gracefully: "This sounds like it may not be the
  right fit for us right now — but feel free to reach out if your timeline or scope changes." Set
  overall_status to "declined".
- If zero or one criteria fail (and none of the failing ones are unresolved), and enough criteria
  have been actively assessed (not left as "not_assessed"), set overall_status to "qualified".
- Do NOT disqualify for: not knowing exactly what they want yet, calling outside office hours,
  asking about pricing, being uncertain about materials/style/layout, a single-room project, or a
  rented apartment with no structural changes.
`;

export const SCOPE_ALLOWED_TOPICS = `
- Whether Aangan Studio takes on residential projects (apartments, independent houses, villas).
- Whether they take on commercial projects (offices, clinics, studios) — up to ~3,000 sq ft.
- Which localities in Pune and PCMC are in the service area (Kothrud, Baner, Aundh, Wakad,
  Koregaon Park, Kalyani Nagar, Viman Nagar, Hadapsar, Magarpatta, NIBM, Kondhwa, Undri, Shivane,
  Warje, Erandwane, Deccan, and adjoining areas; PCMC: Pimpri, Chinchwad, Pimple Saudagar,
  Pimple Nilakh, Ravet, Hinjewadi).
- Whether a specific neighbourhood the caller names is in scope.
- Whether a single-room redesign is valid — yes, if it includes full execution.
- Whether they work on rented apartments — yes, as long as no structural changes are required.
- What's included: space planning, material selection, furniture design, lighting, kitchen and
  wardrobe design, execution supervision (their own vendor/contractor network — they don't do
  execution themselves, they manage it).
- Typical design phase: 3–4 weeks from first consultation.
- Typical execution: 8–16 weeks depending on project size and site readiness.
- Minimum lead time: they cannot begin execution on a project needed in under 6 weeks from today.
- Upper limit on commercial projects: ~3,000 sq ft.
- They do NOT take on restaurants, hotels, retail stores, or gyms.
- They do NOT do architecture or structural work, including moving walls.
- They do NOT offer standalone Vastu consultation (Vastu is incorporated into design projects only).
- They do NOT source furniture without an associated design project.
- Decor-only or styling-only work is out of scope — minimum engagement is a room redesign with execution.
- They do NOT serve cities outside Pune and PCMC.
- What to expect at a consultation and how to book one.
`;

export const SCOPE_DISALLOWED_TOPICS = `
- What any project will cost, in total or per square foot, or any estimate for a specific room/flat/sq ft.
- Which designer will be assigned, their availability, calendar, or when a specific person is free.
- Status updates on an existing or in-progress project.
- Specific material recommendations, brand names, or product comparisons.
- Names of contractors, vendors, or suppliers.
- Lead times or availability for specific materials.
- Anything about an ongoing client relationship or past project.
- Anything not directly covered in the topics above.
`;

export const OUT_OF_SCOPE_SCRIPT =
  "That's something I'm not set up to answer on a call — but it's exactly the kind of thing your designer will cover with you directly. The best next step is a consultation, and I can get that booked for you right now if you'd like.";

export const PRICING_DEFLECTION_SCRIPT =
  "Pricing really depends on the space, the materials you go with, and what you want done — it's quite different from project to project, and your designer will take you through all of that properly at the consultation. Can I get one booked for you now?";

export const ESCALATION_CONDITIONS = [
  {
    id: 1,
    title: "Direct request for a human",
    description:
      'The caller explicitly asks to speak to a person, a designer, or someone at the studio — "can I talk to someone," "connect me to a designer," "I want to speak to the owner." Triggers immediate handoff.',
  },
  {
    id: 2,
    title: "Existing client with a complaint",
    description:
      'The caller identifies as an existing client and raises a complaint or problem with an ongoing/completed project. Immediate handoff, not a qualification call.',
  },
  {
    id: 3,
    title: "Repeated pushback after two deflections",
    description:
      "The caller has been given the same answer twice (typically on pricing, timelines, or scope limits) and responds with repeated dissatisfaction or insistence on a different answer. Escalate to a human.",
  },
  {
    id: 4,
    title: "Hostile, distressed, or abusive tone",
    description:
      "Raised aggression, repeated interruptions, or clear emotional distress the agent cannot de-escalate in one exchange. Do not attempt a third redirect — hand off.",
  },
] as const;

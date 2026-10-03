// Creates (first run) or syncs (subsequent runs) the Aangan Studio agent on Vaani from
// lib/rubric.ts / lib/vaaniPrompt.ts — run this again any time the rubric changes so the live
// agent's system prompt stays in sync with what the post-call Gemini analysis scores against.
//
//   npm run vaani:sync
//
// On first run (no VAANI_AGENT_ID in .env.local) it creates the agent and prints the new ID to
// add to .env.local. On later runs it PATCHes the existing agent's prompt + analysis config.
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { buildVaaniSystemPrompt } from "../lib/vaaniPrompt";
import { createAgent, updateAnalysisConfig, updateSystemPrompt } from "../lib/vaaniAgent";

async function main() {
  const systemPrompt = buildVaaniSystemPrompt();
  const existingAgentId = process.env.VAANI_AGENT_ID;

  if (!existingAgentId) {
    console.log("No VAANI_AGENT_ID set — creating a new agent...");
    const created = await createAgent("Aangan Studio — Front Desk", systemPrompt);
    await updateAnalysisConfig(created.agent_id);
    console.log(`Created agent ${created.agent_id}.`);
    console.log(`Add this to .env.local: VAANI_AGENT_ID=${created.agent_id}`);
    return;
  }

  console.log(`Syncing existing agent ${existingAgentId}...`);
  await updateSystemPrompt(existingAgentId, systemPrompt);
  await updateAnalysisConfig(existingAgentId);
  console.log("System prompt and analysis config synced.");
  console.log(
    "Reminder: phone number assignment and webhook URL registration are not covered by this " +
      "script — see README 'Manual dashboard steps'."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

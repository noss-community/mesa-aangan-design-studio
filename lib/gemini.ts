import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import {
  CRITERIA,
  QUALIFICATION_RULES,
  SCOPE_ALLOWED_TOPICS,
  SCOPE_DISALLOWED_TOPICS,
  ESCALATION_CONDITIONS,
} from "./rubric";
import type { CallAnalysisResult, TranscriptTurn } from "./types";
import { transcriptToPlainText } from "./transcript";

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }
  return new GoogleGenerativeAI(apiKey);
}

const criterionStatusEnum = { type: SchemaType.STRING, enum: ["pass", "fail", "unclear", "not_assessed"] };

const criterionSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    status: criterionStatusEnum as Schema,
    note: { type: SchemaType.STRING, description: "One-line evidence for this status, quoting or paraphrasing the transcript." },
  },
  required: ["status", "note"],
};

const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    qualification: {
      type: SchemaType.OBJECT,
      properties: {
        criterion_1: criterionSchema,
        criterion_2: criterionSchema,
        criterion_3: criterionSchema,
        criterion_4: criterionSchema,
        criterion_5: criterionSchema,
      },
      required: ["criterion_1", "criterion_2", "criterion_3", "criterion_4", "criterion_5"],
    },
    overall_status: { type: SchemaType.STRING, enum: ["qualified", "declined"] as string[] },
    escalation: {
      type: SchemaType.OBJECT,
      properties: {
        triggered: { type: SchemaType.BOOLEAN },
        condition: { type: SchemaType.NUMBER, description: "1-4, matching the escalation conditions, or omit/0 if none." },
        reason: { type: SchemaType.STRING },
      },
      required: ["triggered"],
    },
    summary: {
      type: SchemaType.STRING,
      description: "Exactly three sentences, concrete (location, project type, timeline, flags), for a designer about to pick up the lead.",
    },
  },
  required: ["qualification", "overall_status", "escalation", "summary"],
};

function buildSystemInstruction(): string {
  const criteriaBlock = CRITERIA.map(
    (c, i) => `${i + 1}. ${c.title}\n   Passing: ${c.passing}\n   Failing: ${c.failing}`
  ).join("\n\n");

  const escalationBlock = ESCALATION_CONDITIONS.map(
    (e) => `Condition ${e.id} — ${e.title}: ${e.description}`
  ).join("\n");

  return `You are analysing a COMPLETED phone call transcript between Aangan Studio's voice agent and a caller, to score it against the studio's qualification rubric. You are not part of the live call — you only ever see the finished transcript, after the fact.

=== QUALIFICATION CRITERIA (score all five from the transcript) ===
${criteriaBlock}

RULES FOR APPLYING THE CRITERIA:
${QUALIFICATION_RULES}
If a criterion was never actually discussed in the call, mark it "not_assessed" rather than guessing — but still make a best-effort overall_status call using whatever was covered.

=== TOPICS THE AGENT WAS ALLOWED TO ANSWER ===
${SCOPE_ALLOWED_TOPICS}

=== TOPICS THE AGENT WAS NOT ALLOWED TO ANSWER ===
${SCOPE_DISALLOWED_TOPICS}

=== ESCALATION CONDITIONS (did any of these occur during the call?) ===
${escalationBlock}
Set escalation.triggered = true and escalation.condition to the matching number if the transcript shows any of these happened (the caller asking for a human, an existing-client complaint, repeated pushback after two deflections, or a hostile/distressed caller). escalation.reason should be a one-line explanation grounded in what was actually said.

=== OUTPUT ===
Return the full JSON object matching the schema: per-criterion qualification status with a one-line note, overall_status ("qualified" only if escalation is not triggered and at most one criterion clearly fails with none left unresolved on 1-3; "declined" if two or more criteria clearly fail), escalation detail, and a three-sentence summary for the designer who will follow up — concrete (location, project type, timeline, any flags), no pleasantries.`;
}

export interface AnalyzeCallInput {
  transcript: TranscriptTurn[];
}

export interface AnalyzeCallOutput {
  result: CallAnalysisResult;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

/** One Gemini call per completed call, run from the call_postprocessing webhook handler. */
export async function analyzeCompletedCall(input: AnalyzeCallInput): Promise<AnalyzeCallOutput> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    systemInstruction: buildSystemInstruction(),
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const transcriptText = transcriptToPlainText(input.transcript) || "(empty transcript)";
  const response = await model.generateContent(`Transcript:\n${transcriptText}`);
  const result = JSON.parse(response.response.text()) as CallAnalysisResult;

  const usage = response.response.usageMetadata;
  return {
    result,
    usage: {
      promptTokens: usage?.promptTokenCount ?? 0,
      completionTokens: usage?.candidatesTokenCount ?? 0,
      totalTokens: usage?.totalTokenCount ?? 0,
    },
  };
}

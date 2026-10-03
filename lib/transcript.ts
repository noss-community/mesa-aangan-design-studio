import type { TranscriptTurn } from "./types";

// Vaani's call_postprocessing payload gives the transcript as ONE string, one line per turn:
//   "[13:33:14] AGENT: Hi! you have reached our customer service..."
//   "[13:33:20] USER: I want to redo my living room."
// Observed role labels: AGENT / USER (also allowing CALLER / CUSTOMER defensively).
const LINE_PATTERN = /^\[(\d{2}:\d{2}:\d{2})\]\s*(AGENT|USER|CALLER|CUSTOMER)\s*:\s*(.*)$/i;

function normalizeRole(label: string): "caller" | "agent" {
  return label.toUpperCase() === "AGENT" ? "agent" : "caller";
}

export function parseVaaniTranscript(raw: string | undefined | null): TranscriptTurn[] {
  if (!raw) return [];

  const turns: TranscriptTurn[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = LINE_PATTERN.exec(trimmed);
    if (match) {
      const [, time, roleLabel, text] = match;
      if (text.trim()) {
        turns.push({ role: normalizeRole(roleLabel), text: text.trim(), at: time });
      }
      continue;
    }

    // Line didn't match the expected "[HH:MM:SS] ROLE: text" shape (format isn't guaranteed stable
    // across Vaani accounts/versions) — fold it into the previous turn rather than silently drop it.
    if (turns.length > 0) {
      turns[turns.length - 1].text += ` ${trimmed}`;
    } else {
      turns.push({ role: "caller", text: trimmed, at: "" });
    }
  }

  return turns;
}

export function transcriptToPlainText(turns: TranscriptTurn[]): string {
  return turns.map((t) => `${t.role}: ${t.text}`).join("\n");
}

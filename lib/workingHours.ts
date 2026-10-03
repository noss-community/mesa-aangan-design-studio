const STUDIO_TIMEZONE = "Asia/Kolkata";
const OPEN_HOUR = 10; // 10am IST
const CLOSE_HOUR = 19; // 7pm IST

function istPartsOf(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STUDIO_TIMEZONE,
    hour: "numeric",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  return { hour, weekday };
}

/** True when `date` falls within the studio's 10am–7pm IST front-desk hours. */
export function isWithinWorkingHours(date: Date): boolean {
  const { hour } = istPartsOf(date);
  return hour >= OPEN_HOUR && hour < CLOSE_HOUR;
}

/** Human-readable "tomorrow morning" callback window, phrased for a caller. */
export function nextMorningCallbackWindow(date: Date): string {
  const istNow = new Date(date.toLocaleString("en-US", { timeZone: STUDIO_TIMEZONE }));
  const { hour } = istPartsOf(date);
  // If it's already past midnight but before opening, "this morning" applies instead of "tomorrow".
  const isSameDay = hour < OPEN_HOUR;
  const dayLabel = isSameDay ? "this morning" : "tomorrow morning";
  return `${dayLabel} between ${OPEN_HOUR}:00 and ${OPEN_HOUR + 1}:00 AM`;
}

export function formatIstLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: STUDIO_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export const STUDIO_HOURS = { timezone: STUDIO_TIMEZONE, openHour: OPEN_HOUR, closeHour: CLOSE_HOUR };

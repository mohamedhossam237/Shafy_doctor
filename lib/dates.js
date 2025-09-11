// /lib/dates.js

export function toDate(val) {
  if (!val) return null;
  if (typeof val?.toDate === "function") return val.toDate();
  if (typeof val === "object" && "seconds" in val) return new Date(val.seconds * 1000);
  if (typeof val === "string" || val instanceof Date) return new Date(val);
  return null;
}

export function toDayKey(date, timeZone = "Africa/Cairo") {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date); // YYYY-MM-DD
}

export function formatDateTime(val, locale = "en", timeZone = "Africa/Cairo") {
  const dt = toDate(val);
  if (!dt) return "—";
  const d = new Intl.DateTimeFormat(locale, {
    timeZone, weekday: "short", year: "numeric", month: "short", day: "2-digit",
  }).format(dt);
  const t = new Intl.DateTimeFormat(locale, {
    timeZone, hour: "2-digit", minute: "2-digit",
  }).format(dt);
  return `${d} ${t}`;
}

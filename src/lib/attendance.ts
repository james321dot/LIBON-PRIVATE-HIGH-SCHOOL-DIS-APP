export interface AttendanceEntry {
  id: string;
  name: string;
  role: string;
  time: string;
  status: "Late" | "On-Time";
  timestamp: number;
  /** Roster ID of the person, when matched against the registered roster. */
  studentId?: string;
  /** Name of the guard on duty who recorded the entry. */
  guard?: string;
  /** Grade level, for students (e.g. "Grade 10"). */
  gradeLevel?: string;
  /** Class section, for students (e.g. "Section B"). */
  section?: string;
  /** How the entry was captured — QR scan or manual registry form. */
  source?: "qr" | "manual";
}

/** True when the timestamp falls on today's calendar date. */
export function isToday(timestamp: number): boolean {
  const d = new Date(timestamp);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

export type ViewName = "client" | "lock" | "admin";

// NOTE: The admin passcode is intentionally NOT defined here. It lives only in
// the server environment (see `staff-auth.server.ts`) so it is never bundled
// into the publicly-downloadable JavaScript.
/** Attendance is on-time up to and including 7:14 AM. From 7:15 AM it is Late. */
export const DEADLINE_HOUR = 7;
export const DEADLINE_MINUTE = 14;
/** Last on-time minute, e.g. "7:14 AM". */
export const DEADLINE_LABEL = "7:14 AM";
/** First late minute, e.g. "7:15 AM". */
export const LATE_FROM_LABEL = "7:15 AM";

/** True when the given moment is past the on-time window (7:15 AM onwards). */
export function isLateAt(date: Date = new Date()): boolean {
  const mins = date.getHours() * 60 + date.getMinutes();
  return mins > DEADLINE_HOUR * 60 + DEADLINE_MINUTE;
}

/** Milliseconds remaining in today's on-time window (0 once the window closed). */
export function msUntilDeadline(date: Date = new Date()): number {
  const close = new Date(date);
  close.setHours(DEADLINE_HOUR, DEADLINE_MINUTE + 1, 0, 0);
  return Math.max(0, close.getTime() - date.getTime());
}
export interface ToastItem {
  id: number;
  title: string;
  message: string;
  icon: string;
}

/** YYYY-MM key used for archiving records by month. */
export function monthKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function groupByMonth(entries: AttendanceEntry[]): Map<string, AttendanceEntry[]> {
  const map = new Map<string, AttendanceEntry[]>();
  entries.forEach((e) => {
    const key = monthKey(e.timestamp);
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  });
  return new Map([...map.entries()].sort((a, b) => b[0].localeCompare(a[0])));
}

export function buildCSV(entries: AttendanceEntry[]): string {
  let csv = "Full Name,ID,Role,Grade Level,Section,Time,Status,Date,Logged By\n";
  entries.forEach((entry) => {
    const d = new Date(entry.timestamp).toLocaleDateString();
    csv += `"${entry.name}","${entry.studentId ?? ""}","${entry.role}","${entry.gradeLevel ?? ""}","${entry.section ?? ""}","${entry.time}","${entry.status}","${d}","${entry.guard ?? "—"}"\n`;
  });
  return csv;
}

export function exportEntriesToCSV(entries: AttendanceEntry[], filename?: string) {
  const dateStr = new Date().toLocaleDateString();
  const blob = new Blob([buildCSV(entries)], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `LPHS_Attendance_${dateStr}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

export function exportEntriesToPDF(entries: AttendanceEntry[], logoUrl?: string) {
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const onTime = entries.filter((e) => e.status === "On-Time").length;
  const late = entries.filter((e) => e.status === "Late").length;

  const rows = entries
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(
      (e, i) => `
      <tr class="${e.status === "Late" ? "late" : ""}">
        <td class="num">${i + 1}</td>
        <td>${escapeHtml(e.name)}</td>
        <td>${escapeHtml(e.role)}</td>
        <td>${escapeHtml([e.gradeLevel, e.section].filter(Boolean).join(" · ") || "—")}</td>
        <td class="num">${escapeHtml(e.time)}</td>
        <td><span class="pill ${e.status === "Late" ? "pill-late" : "pill-ok"}">${e.status}</span></td>
        <td>${escapeHtml(e.guard ?? "—")}</td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"/>
<title>LPHS Attendance Report — ${dateStr}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1b4332; margin: 0; padding: 24px; }
  .letterhead { display: flex; align-items: center; gap: 18px; border-bottom: 3px double #1b4332; padding-bottom: 14px; }
  .letterhead img { height: 70px; }
  .letterhead h1 { margin: 0; font-size: 22px; letter-spacing: 1px; }
  .letterhead p { margin: 2px 0 0; font-size: 11px; letter-spacing: 3px; color: #52b788; text-transform: uppercase; font-family: Arial, sans-serif; }
  .meta { display: flex; justify-content: space-between; margin: 20px 0 14px; font-size: 12px; font-family: Arial, sans-serif; }
  .stats { display: flex; gap: 12px; margin-bottom: 18px; }
  .stat { flex:1; border:1px solid #d8f3dc; border-top:4px solid #52b788; padding:12px; text-align:center; font-family: Arial, sans-serif; }
  .stat b { display:block; font-size: 22px; color:#1b4332; }
  .stat span { font-size: 10px; letter-spacing:2px; color:#666; text-transform:uppercase; }
  table { width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
  th { background: #1b4332; color: #fff; text-align: left; padding: 8px 10px; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; }
  td { padding: 8px 10px; border-bottom: 1px solid #e8f0eb; }
  tr.late td { background: #fef2f2; }
  .num { font-variant-numeric: tabular-nums; }
  .pill { padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: bold; letter-spacing: 1px; }
  .pill-ok { background:#d8f3dc; color:#1b4332; }
  .pill-late { background:#fecaca; color:#991b1b; }
  footer { margin-top: 24px; border-top: 1px solid #d8f3dc; padding-top: 10px; font-size: 10px; color: #666; font-family: Arial, sans-serif; display:flex; justify-content:space-between; }
  .sig { margin-top: 40px; display:flex; gap: 60px; font-family: Arial, sans-serif; font-size:11px; }
  .sig div { flex:1; text-align:center; }
  .sig .line { border-top:1px solid #1b4332; margin-bottom:6px; }
</style></head>
<body>
  <div class="letterhead">
    ${logoUrl ? `<img src="${logoUrl}" alt="LPHS Seal"/>` : ""}
    <div>
      <h1>LIBON PRIVATE HIGH SCHOOL</h1>
      <p>Official Digital Attendance Report</p>
    </div>
  </div>
  <div class="meta">
    <div><b>Report Date:</b> ${dateStr}</div>
    <div><b>Generated:</b> ${new Date().toLocaleTimeString()}</div>
  </div>
  <div class="stats">
    <div class="stat"><b>${entries.length}</b><span>Total Present</span></div>
    <div class="stat"><b>${onTime}</b><span>On-Time</span></div>
    <div class="stat"><b>${late}</b><span>Late</span></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Full Name</th><th>Designation</th><th>Grade &amp; Section</th><th>Time In</th><th>Status</th><th>Logged By</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="7" style="text-align:center;padding:24px;color:#888">No records</td></tr>`}</tbody>
  </table>
  <div class="sig">
    <div><div class="line"></div>Prepared by (Guard on Duty)</div>
    <div><div class="line"></div>Verified by (Administration)</div>
  </div>
  <footer>
    <span>LPHS — Dreamers, Achievers, Agents of Change</span>
    <span>Confidential · For School Use Only</span>
  </footer>
  <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
</body></html>`;

  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export function computeRepeatLate(entries: AttendanceEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  entries.forEach((e) => {
    if (e.status !== "Late") return;
    const key = e.name.trim().toUpperCase();
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return map;
}

export function computeWeekdayHeatmap(entries: AttendanceEntry[]): number[] {
  // Mon..Sun index 0..6 count of Late entries
  const counts = [0, 0, 0, 0, 0, 0, 0];
  entries.forEach((e) => {
    if (e.status !== "Late") return;
    const day = new Date(e.timestamp).getDay(); // 0=Sun
    const idx = day === 0 ? 6 : day - 1;
    counts[idx]++;
  });
  return counts;
}

export function computeHourlyDistribution(entries: AttendanceEntry[]): number[] {
  // 5AM..11AM buckets (0..6 for hours 5,6,7,8,9,10,11)
  const buckets = [0, 0, 0, 0, 0, 0, 0];
  entries.forEach((e) => {
    const h = new Date(e.timestamp).getHours();
    if (h >= 5 && h <= 11) buckets[h - 5]++;
  });
  return buckets;
}

let audioCtx: AudioContext | null = null;
export function playSuccessSound(isLate: boolean) {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    audioCtx ??= new AC();
    const ctx = audioCtx;
    const notes = isLate ? [440, 330] : [660, 880, 1320];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + i * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.12 + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.4);
    });
  } catch {
    /* ignore */
  }
}

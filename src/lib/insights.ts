import type { AttendanceEntry } from "@/lib/attendance";
import type { RosterMember } from "@/lib/roster";
import { JHS_SECTIONS, SHS_STRANDS, composeSection, setsForGrade, classLabel } from "@/lib/classes";

/** Every section label valid for a given grade level (JHS flowers, SHS strand+set). */
export function allSectionsForGrade(grade: string): string[] {
  const jhs = JHS_SECTIONS[grade];
  if (jhs) return jhs;
  const strands = SHS_STRANDS[grade] ?? [];
  const sets = setsForGrade(grade);
  if (!sets.length) return strands;
  return strands.flatMap((s) => sets.map((x) => composeSection(s, x)));
}

export function isSameDay(ts: number, ref = new Date()): boolean {
  const d = new Date(ts);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

export function todaysEntries(entries: AttendanceEntry[], ref = new Date()): AttendanceEntry[] {
  return entries.filter((e) => isSameDay(e.timestamp, ref));
}

export interface ClassRow {
  name: string;
  studentId?: string;
  status: "On-Time" | "Late" | "Absent";
  time?: string;
}

export interface ClassStatusResult {
  rows: ClassRow[];
  present: number;
  late: number;
  absent: number;
  total: number;
  rate: number;
}

/** Cross-checks a class roster against today's log to produce present / late / absent rows. */
export function computeClassStatus(
  roster: RosterMember[],
  entries: AttendanceEntry[],
  gradeLevel: string,
  section: string,
  ref = new Date(),
): ClassStatusResult {
  const today = todaysEntries(entries, ref);
  const members = roster.filter(
    (m) =>
      m.role === "Student" &&
      (!gradeLevel || m.gradeLevel === gradeLevel) &&
      (!section || m.section === section),
  );

  const byName = new Map<string, AttendanceEntry>();
  today.forEach((e) => {
    const key = e.name.trim().toUpperCase();
    const prev = byName.get(key);
    if (!prev || e.timestamp < prev.timestamp) byName.set(key, e);
  });

  const rows: ClassRow[] = members.map((m) => {
    const hit = byName.get(m.name.trim().toUpperCase());
    return {
      name: m.name,
      ...(m.id ? { studentId: m.id } : {}),
      status: hit ? hit.status : "Absent",
      ...(hit ? { time: hit.time } : {}),
    };
  });

  // Walk-ins: logged for this class but not on the roster.
  today
    .filter(
      (e) =>
        e.role === "Student" &&
        (!gradeLevel || e.gradeLevel === gradeLevel) &&
        (!section || e.section === section) &&
        !members.some((m) => m.name.trim().toUpperCase() === e.name.trim().toUpperCase()),
    )
    .forEach((e) => {
      rows.push({
        name: e.name,
        ...(e.studentId ? { studentId: e.studentId } : {}),
        status: e.status,
        time: e.time,
      });
    });

  rows.sort((a, b) => {
    const order = { Absent: 0, Late: 1, "On-Time": 2 } as const;
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return a.name.localeCompare(b.name);
  });

  const late = rows.filter((r) => r.status === "Late").length;
  const onTime = rows.filter((r) => r.status === "On-Time").length;
  const absent = rows.filter((r) => r.status === "Absent").length;
  const total = rows.length;
  return {
    rows,
    present: onTime + late,
    late,
    absent,
    total,
    rate: total ? Math.round(((onTime + late) / total) * 100) : 0,
  };
}

/** Roster members with no entry logged today. */
export function computeAbsentees(
  roster: RosterMember[],
  entries: AttendanceEntry[],
  ref = new Date(),
): RosterMember[] {
  const today = new Set(todaysEntries(entries, ref).map((e) => e.name.trim().toUpperCase()));
  return roster
    .filter((m) => !today.has(m.name.trim().toUpperCase()))
    .sort(
      (a, b) =>
        (a.gradeLevel ?? "").localeCompare(b.gradeLevel ?? "", undefined, { numeric: true }) ||
        (a.section ?? "").localeCompare(b.section ?? "") ||
        a.name.localeCompare(b.name),
    );
}

export interface ShiftSummary {
  guard: string;
  startedAt: number;
  endedAt: number;
  entries: AttendanceEntry[];
  total: number;
  onTime: number;
  late: number;
}

export function computeShiftSummary(
  entries: AttendanceEntry[],
  guard: string,
  startedAt: number,
  endedAt = Date.now(),
): ShiftSummary {
  const mine = entries
    .filter((e) => e.guard === guard && e.timestamp >= startedAt && e.timestamp <= endedAt)
    .sort((a, b) => a.timestamp - b.timestamp);
  return {
    guard,
    startedAt,
    endedAt,
    entries: mine,
    total: mine.length,
    onTime: mine.filter((e) => e.status === "On-Time").length,
    late: mine.filter((e) => e.status === "Late").length,
  };
}

function esc(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

const PRINT_CSS = `
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia,'Times New Roman',serif; color:#1b4332; margin:0; padding:20px; }
  .head { display:flex; align-items:center; gap:16px; border-bottom:3px double #1b4332; padding-bottom:12px; }
  .head img { height:64px; }
  .head h1 { margin:0; font-size:20px; letter-spacing:1px; }
  .head p { margin:2px 0 0; font-size:10px; letter-spacing:3px; text-transform:uppercase; color:#52b788; font-family:Arial,sans-serif; }
  .meta { display:flex; justify-content:space-between; font-family:Arial,sans-serif; font-size:12px; margin:16px 0 12px; }
  .stats { display:flex; gap:10px; margin-bottom:16px; }
  .stat { flex:1; border:1px solid #d8f3dc; border-top:4px solid #52b788; padding:10px; text-align:center; font-family:Arial,sans-serif; }
  .stat b { display:block; font-size:20px; }
  .stat span { font-size:9px; letter-spacing:2px; text-transform:uppercase; color:#666; }
  table { width:100%; border-collapse:collapse; font-family:Arial,sans-serif; font-size:12px; }
  th { background:#1b4332; color:#fff; text-align:left; padding:8px; font-size:10px; letter-spacing:1.4px; text-transform:uppercase; }
  td { padding:7px 8px; border-bottom:1px solid #e8f0eb; }
  tr.absent td { background:#fef2f2; }
  tr.late td { background:#fffbeb; }
  .sign { height:22px; border-bottom:1px dotted #9aa; }
  .pill { padding:2px 8px; border-radius:999px; font-size:10px; font-weight:bold; }
  .ok { background:#d8f3dc; color:#1b4332; }
  .lt { background:#fde68a; color:#92400e; }
  .ab { background:#fecaca; color:#991b1b; }
  footer { margin-top:22px; border-top:1px solid #d8f3dc; padding-top:8px; font-size:10px; color:#666; font-family:Arial,sans-serif; display:flex; justify-content:space-between; }
  .sig { margin-top:34px; display:flex; gap:50px; font-family:Arial,sans-serif; font-size:11px; }
  .sig div { flex:1; text-align:center; }
  .sig .line { border-top:1px solid #1b4332; margin-bottom:6px; }
`;

function printDoc(title: string, body: string) {
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(title)}</title><style>${PRINT_CSS}</style></head><body>${body}<script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`;
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

function letterhead(subtitle: string, logoUrl?: string) {
  return `<div class="head">${logoUrl ? `<img src="${logoUrl}" alt="LPHS Seal"/>` : ""}
    <div><h1>LIBON PRIVATE HIGH SCHOOL</h1><p>${esc(subtitle)}</p></div></div>`;
}

/** Printable blank sign-in sheet with roster names pre-filled. */
export function printSignInSheet(
  members: RosterMember[],
  gradeLevel: string,
  section: string,
  logoUrl?: string,
) {
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const rows = members
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (m, i) =>
        `<tr><td>${i + 1}</td><td>${esc(m.id)}</td><td>${esc(m.name)}</td><td class="sign"></td><td class="sign"></td></tr>`,
    )
    .join("");
  return printDoc(
    `Sign-in Sheet — ${classLabel(gradeLevel, section)}`,
    `${letterhead("Daily Attendance Sign-In Sheet", logoUrl)}
    <div class="meta"><div><b>Class:</b> ${esc(classLabel(gradeLevel, section) || "All classes")}</div><div><b>Date:</b> ${dateStr}</div></div>
    <table><thead><tr><th>#</th><th>ID</th><th>Student Name</th><th>Time In</th><th>Signature</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="5" style="text-align:center;padding:22px;color:#888">No roster members for this class</td></tr>`}</tbody></table>
    <div class="sig"><div><div class="line"></div>Class Adviser</div><div><div class="line"></div>Verified by Administration</div></div>
    <footer><span>LPHS — Dreamers, Achievers, Agents of Change</span><span>Manual backup record</span></footer>`,
  );
}

/** Printable class status report (present / late / absent). */
export function printClassStatus(
  result: ClassStatusResult,
  gradeLevel: string,
  section: string,
  logoUrl?: string,
) {
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const rows = result.rows
    .map(
      (
        r,
        i,
      ) => `<tr class="${r.status === "Absent" ? "absent" : r.status === "Late" ? "late" : ""}">
      <td>${i + 1}</td><td>${esc(r.studentId ?? "—")}</td><td>${esc(r.name)}</td>
      <td>${esc(r.time ?? "—")}</td>
      <td><span class="pill ${r.status === "Absent" ? "ab" : r.status === "Late" ? "lt" : "ok"}">${r.status}</span></td></tr>`,
    )
    .join("");
  return printDoc(
    `Class Status — ${classLabel(gradeLevel, section)}`,
    `${letterhead("Daily Class Attendance Status", logoUrl)}
    <div class="meta"><div><b>Class:</b> ${esc(classLabel(gradeLevel, section))}</div><div><b>Date:</b> ${dateStr}</div></div>
    <div class="stats">
      <div class="stat"><b>${result.total}</b><span>Enrolled</span></div>
      <div class="stat"><b>${result.present}</b><span>Present</span></div>
      <div class="stat"><b>${result.late}</b><span>Late</span></div>
      <div class="stat"><b>${result.absent}</b><span>Absent</span></div>
    </div>
    <table><thead><tr><th>#</th><th>ID</th><th>Student</th><th>Time In</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="sig"><div><div class="line"></div>Class Adviser</div><div><div class="line"></div>Administration</div></div>
    <footer><span>LPHS Digital Attendance System</span><span>Generated ${new Date().toLocaleString()}</span></footer>`,
  );
}

/** Printable end-of-shift guard report. */
export function printShiftReport(summary: ShiftSummary, logoUrl?: string) {
  const rows = summary.entries
    .map(
      (e, i) => `<tr class="${e.status === "Late" ? "late" : ""}">
      <td>${i + 1}</td><td>${esc(e.name)}</td><td>${esc(e.role)}</td>
      <td>${esc(classLabel(e.gradeLevel, e.section) || "—")}</td><td>${esc(e.time)}</td>
      <td><span class="pill ${e.status === "Late" ? "lt" : "ok"}">${e.status}</span></td></tr>`,
    )
    .join("");
  const dur = Math.max(0, summary.endedAt - summary.startedAt);
  const h = Math.floor(dur / 3600000);
  const m = Math.floor((dur % 3600000) / 60000);
  return printDoc(
    `Guard Shift Report — ${summary.guard}`,
    `${letterhead("End-of-Shift Guard Report", logoUrl)}
    <div class="meta"><div><b>Guard on Duty:</b> ${esc(summary.guard)}</div>
    <div><b>Shift:</b> ${new Date(summary.startedAt).toLocaleString()} → ${new Date(summary.endedAt).toLocaleTimeString()} (${h}h ${m}m)</div></div>
    <div class="stats">
      <div class="stat"><b>${summary.total}</b><span>Logged</span></div>
      <div class="stat"><b>${summary.onTime}</b><span>On-Time</span></div>
      <div class="stat"><b>${summary.late}</b><span>Late</span></div>
    </div>
    <table><thead><tr><th>#</th><th>Name</th><th>Role</th><th>Class</th><th>Time In</th><th>Status</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="6" style="text-align:center;padding:22px;color:#888">No entries recorded this shift</td></tr>`}</tbody></table>
    <div class="sig"><div><div class="line"></div>Guard on Duty</div><div><div class="line"></div>Received by Administration</div></div>
    <footer><span>LPHS Digital Attendance System</span><span>Confidential · For School Use Only</span></footer>`,
  );
}

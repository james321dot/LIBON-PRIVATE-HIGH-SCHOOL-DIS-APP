export interface RosterMember {
  id: string; // student / employee ID
  name: string;
  role: string;
  section?: string;
  gradeLevel?: string;
}

const ROSTER_KEY = "lphs_roster_v1";
const STRICT_KEY = "lphs_roster_strict";

export function loadRoster(): RosterMember[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ROSTER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RosterMember[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRoster(list: RosterMember[]) {
  localStorage.setItem(ROSTER_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("lphs-roster-change"));
}

/** Writes a roster received from the cloud without re-broadcasting an upload loop. */
export function saveRosterLocalOnly(list: RosterMember[]) {
  localStorage.setItem(ROSTER_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("lphs-roster-change"));
}

export function isStrictRoster(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STRICT_KEY) === "1";
}

export function setStrictRoster(on: boolean) {
  localStorage.setItem(STRICT_KEY, on ? "1" : "0");
  window.dispatchEvent(new CustomEvent("lphs-roster-change"));
}

export function searchRoster(list: RosterMember[], term: string, limit = 6): RosterMember[] {
  const t = term.trim().toLowerCase();
  if (!t) return [];
  return list
    .filter((m) => m.name.toLowerCase().includes(t) || m.id.toLowerCase().includes(t))
    .slice(0, limit);
}

export function findRosterMatch(list: RosterMember[], name: string): RosterMember | undefined {
  const t = name.trim().toLowerCase();
  return list.find((m) => m.name.trim().toLowerCase() === t);
}

/** Parses "ID,Name,Role,Grade Level,Section" CSV rows (header optional). */
export function parseRosterCSV(text: string): RosterMember[] {
  const out: RosterMember[] = [];
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      const cells = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
      if (i === 0 && /^(id|student id)$/i.test(cells[0] ?? "")) return;
      const [id, name, role, gradeLevel, section] = cells;
      if (!name) return;
      out.push({
        id: id || `AUTO-${i}`,
        name,
        role: role || "Student",
        gradeLevel: gradeLevel || undefined,
        section: section || undefined,
      });
    });
  return out;
}

export function rosterToCSV(list: RosterMember[]): string {
  let csv = "ID,Name,Role,Grade Level,Section\n";
  list.forEach((m) => {
    csv += `"${m.id}","${m.name}","${m.role}","${m.gradeLevel ?? ""}","${m.section ?? ""}"\n`;
  });
  return csv;
}

export const ROSTER_TEMPLATE_CSV = `ID,Name,Role,Grade Level,Section
LPHS-0001,DELA CRUZ JUAN,Student,Grade 7,Sampaguita
LPHS-0002,SANTOS MARIA,Student,Grade 12,STEM A
LPHS-1001,REYES ANA,Faculty,,
`;

export interface RosterIssue {
  row: number;
  level: "error" | "warning";
  message: string;
}

export interface RosterValidation {
  members: RosterMember[];
  issues: RosterIssue[];
  duplicates: number;
  valid: number;
}

/** Validates a parsed roster import against school grades/sections before saving. */
export function validateRoster(
  parsed: RosterMember[],
  existing: RosterMember[],
  validGrades: string[],
  sectionsFor: (grade: string) => string[],
): RosterValidation {
  const issues: RosterIssue[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set(existing.map((m) => m.name.trim().toLowerCase()));
  let duplicates = 0;

  parsed.forEach((m, i) => {
    const row = i + 1;
    if (!m.name.trim()) issues.push({ row, level: "error", message: "Missing name" });
    if (seenIds.has(m.id.toLowerCase())) {
      issues.push({ row, level: "error", message: `Duplicate ID "${m.id}" inside this file` });
    }
    seenIds.add(m.id.toLowerCase());
    if (seenNames.has(m.name.trim().toLowerCase())) {
      duplicates++;
      issues.push({
        row,
        level: "warning",
        message: `"${m.name}" already exists — it will be updated`,
      });
    }
    if (m.role === "Student") {
      if (!m.gradeLevel) {
        issues.push({ row, level: "warning", message: `${m.name}: no grade level` });
      } else if (!validGrades.includes(m.gradeLevel)) {
        issues.push({ row, level: "error", message: `Unknown grade "${m.gradeLevel}"` });
      } else if (m.section) {
        const allowed = sectionsFor(m.gradeLevel);
        if (allowed.length && !allowed.includes(m.section)) {
          issues.push({
            row,
            level: "warning",
            message: `"${m.section}" is not a listed ${m.gradeLevel} section`,
          });
        }
      }
    }
  });

  const valid = parsed.filter((m) => m.name.trim()).length;
  return { members: parsed, issues, duplicates, valid };
}

export function downloadText(filename: string, text: string, mime = "text/csv") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

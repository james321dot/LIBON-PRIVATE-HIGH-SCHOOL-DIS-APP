/**
 * QR badge payload helpers.
 *
 * A badge encodes the same details the manual registry asks for:
 * name, role, grade level and section (plus an optional ID).
 * The web supplies the date and time automatically on scan.
 */
export interface BadgePayload {
  id?: string;
  name: string;
  role: string;
  gradeLevel?: string;
  section?: string;
}

export const BADGE_ROLES = ["Student", "Faculty", "Staff", "Visitor"];

/** Encodes a badge as compact JSON with an LPHS marker. */
export function encodeBadge(payload: BadgePayload): string {
  return JSON.stringify({
    v: 1,
    sys: "LPHS",
    id: payload.id ?? "",
    n: payload.name,
    r: payload.role,
    g: payload.gradeLevel ?? "",
    s: payload.section ?? "",
  });
}

/**
 * Parses a scanned string. Accepts LPHS JSON badges, plain JSON with full
 * key names, and a pipe/comma separated fallback: NAME|ROLE|GRADE|SECTION|ID
 */
export function decodeBadge(raw: string): BadgePayload | null {
  const text = raw.trim();
  if (!text) return null;

  if (text.startsWith("{")) {
    try {
      const o = JSON.parse(text) as Record<string, unknown>;
      const str = (...keys: string[]) => {
        for (const k of keys) {
          const v = o[k];
          if (typeof v === "string" && v.trim()) return v.trim();
        }
        return "";
      };
      const name = str("n", "name", "fullName");
      if (!name) return null;
      return {
        name,
        role: str("r", "role") || "Student",
        gradeLevel: str("g", "grade", "gradeLevel") || undefined,
        section: str("s", "section", "strand") || undefined,
        id: str("id", "studentId") || undefined,
      };
    } catch {
      return null;
    }
  }

  const parts = text.split(/[|,;]/).map((p) => p.trim());
  if (!parts[0]) return null;
  return {
    name: parts[0],
    role: parts[1] || "Student",
    gradeLevel: parts[2] || undefined,
    section: parts[3] || undefined,
    id: parts[4] || undefined,
  };
}

export function badgeLabel(b: BadgePayload): string {
  return [b.gradeLevel, b.section].filter(Boolean).join(" · ") || b.role;
}

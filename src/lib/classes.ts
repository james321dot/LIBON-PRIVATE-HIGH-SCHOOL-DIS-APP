import type { RosterMember } from "@/lib/roster";

export const GRADE_LEVELS = ["Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];

/** Junior high sections, named per grade level. */
export const JHS_SECTIONS: Record<string, string[]> = {
  "Grade 7": ["Sampaguita", "Dalia", "Rose"],
  "Grade 8": ["Jasmin", "Magnolia"],
  "Grade 9": ["Camia", "Daisy"],
  "Grade 10": ["Gladiola", "Gardenia"],
};

/** Senior high strands, per grade level. */
export const SHS_STRANDS: Record<string, string[]> = {
  "Grade 11": ["ASSH", "STEM", "BE", "TECHPRO"],
  "Grade 12": ["HUMSS", "STEM", "ABM", "GAS", "TVL"],
};

/** Sets (A / B) available for a senior high grade level.*/
export const SHS_SETS: Record<string, string[]> = {
  "Grade 12": ["A", "B"],
};

export function isSeniorHigh(gradeLevel: string): boolean {
  return gradeLevel in SHS_STRANDS;
}

export function sectionsForGrade(gradeLevel: string): string[] {
  return JHS_SECTIONS[gradeLevel] ?? [];
}

export function strandsForGrade(gradeLevel: string): string[] {
  return SHS_STRANDS[gradeLevel] ?? [];
}

export function setsForGrade(gradeLevel: string): string[] {
  return SHS_SETS[gradeLevel] ?? [];
}

/** Final section value stored on an entry, e.g. "Rose" or "STEM A". */
export function composeSection(strand: string, set: string): string {
  return [strand, set].filter(Boolean).join(" ");
}

/** Every section label used by the school, plus anything already on the roster. */
export function availableSections(roster: RosterMember[] = []): string[] {
  const set = new Set<string>();
  Object.values(JHS_SECTIONS).forEach((list) => list.forEach((s) => set.add(s)));
  Object.entries(SHS_STRANDS).forEach(([grade, strands]) => {
    const sets = setsForGrade(grade);
    strands.forEach((st) => {
      if (sets.length) sets.forEach((x) => set.add(composeSection(st, x)));
      else set.add(st);
    });
  });
  roster.forEach((m) => {
    if (m.section) set.add(m.section);
  });
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** "Grade 8 · Jasmin" label used across the log, CSV and PDF. */
export function classLabel(gradeLevel?: string, section?: string): string {
  if (gradeLevel && section) return `${gradeLevel} · ${section}`;
  return gradeLevel ?? section ?? "";
}

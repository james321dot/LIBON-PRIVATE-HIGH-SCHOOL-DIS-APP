import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShieldAlert,
  Send,
  User,
  BadgeCheck,
  IdCard,
  GraduationCap,
  Users2,
  ChevronDown,
} from "lucide-react";
import {
  GRADE_LEVELS,
  composeSection,
  isSeniorHigh,
  sectionsForGrade,
  setsForGrade,
  strandsForGrade,
} from "@/lib/classes";
import { haptic } from "@/lib/guard-session";
import { DeadlineChip } from "@/components/DeadlineChip";
import { DEADLINE_LABEL, LATE_FROM_LABEL } from "@/lib/attendance";
import {
  findRosterMatch,
  isStrictRoster,
  loadRoster,
  searchRoster,
  type RosterMember,
} from "@/lib/roster";

interface ClientViewProps {
  onSubmit: (
    name: string,
    role: string,
    studentId?: string,
    gradeLevel?: string,
    section?: string,
  ) => Promise<boolean>;
  kiosk?: boolean;
}

const STEPS = [
  <>
    Enter your <b className="text-leaf">Full Name</b> exactly as it appears on your official school
    ID — matching names are suggested automatically.
  </>,
  <>
    Confirm your <b className="text-leaf">Role / Position</b> from the list provided.
  </>,
  <>
    Press <b className="text-leaf">Submit Attendance</b> and wait for the green confirmation screen.
  </>,
];

export function ClientView({ onSubmit, kiosk = false }: ClientViewProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [studentId, setStudentId] = useState<string | undefined>();
  const [gradeLevel, setGradeLevel] = useState("");
  const [section, setSection] = useState("");
  const [strand, setStrand] = useState("");
  const [setLetter, setSetLetter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [greeting, setGreeting] = useState("Good Day");
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [strict, setStrict] = useState(false);
  const [focused, setFocused] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening");
    const sync = () => {
      setRoster(loadRoster());
      setStrict(isStrictRoster());
    };
    sync();
    window.addEventListener("lphs-roster-change", sync);
    return () => window.removeEventListener("lphs-roster-change", sync);
  }, []);

  const suggestions = useMemo(() => searchRoster(roster, name), [roster, name]);
  const matched = useMemo(() => findRosterMatch(roster, name), [roster, name]);
  const blocked = strict && roster.length > 0 && !matched;

  const isStudent = role === "Student";
  const senior = isSeniorHigh(gradeLevel);
  const gradeSections = useMemo(() => sectionsForGrade(gradeLevel), [gradeLevel]);
  const gradeStrands = useMemo(() => strandsForGrade(gradeLevel), [gradeLevel]);
  const gradeSets = useMemo(() => setsForGrade(gradeLevel), [gradeLevel]);
  const incompleteClass = isStudent && (!gradeLevel || !section);

  const resetClass = () => {
    setGradeLevel("");
    setSection("");
    setStrand("");
    setSetLetter("");
  };

  const chooseGrade = (g: string) => {
    setGradeLevel(g);
    setSection("");
    setStrand("");
    setSetLetter("");
    haptic(10);
  };

  const chooseStrand = (s: string) => {
    setStrand(s);
    setSetLetter("");
    setSection(setsForGrade(gradeLevel).length ? "" : composeSection(s, ""));
    haptic(10);
  };

  const chooseSet = (letter: string) => {
    setSetLetter(letter);
    setSection(composeSection(strand, letter));
    haptic(10);
  };

  const pick = (m: RosterMember) => {
    setName(m.name);
    setRole(m.role);
    setStudentId(m.id);
    if (m.section) setSection(m.section);
    setFocused(false);
    haptic(12);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    haptic([15, 40, 15]);
    setSubmitting(true);
    const ok = await onSubmit(
      name.trim(),
      role,
      matched?.id ?? studentId,
      isStudent ? gradeLevel : undefined,
      isStudent ? section : undefined,
    );
    if (ok) {
      setName("");
      setRole("");
      setStudentId(undefined);
      resetClass();
      nameRef.current?.focus();
    }
    setSubmitting(false);
  };

  const fieldClass = `w-full rounded-xl border border-input bg-muted text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-leaf focus:bg-card focus:shadow-glow ${
    kiosk ? "py-5 text-lg" : "py-3.5 text-base"
  }`;

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-hero-gradient px-5 py-10">
      <div className="pointer-events-none absolute -left-32 top-10 h-80 w-80 animate-pulse rounded-full bg-leaf/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-10 h-80 w-80 rounded-full bg-emerald/20 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative mb-8 flex flex-col items-center gap-4 text-center text-primary-foreground"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/15 bg-primary-foreground/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-leaf backdrop-blur-sm">
          LPHS Digital Attendance System
        </span>
        <h2 className="font-display text-4xl font-bold italic leading-tight sm:text-5xl">
          {greeting}
        </h2>
        <p className="max-w-md text-balance text-[11px] font-semibold uppercase tracking-[0.35em] text-primary-foreground/70">
          Dreamers, Achievers, Agents of Change
        </p>
        <DeadlineChip inverted />
      </motion.div>

      <div
        className={`relative grid w-full items-start gap-6 ${
          kiosk
            ? "max-w-xl grid-cols-1"
            : "max-w-md lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
        }`}
      >
        {!kiosk && (
          <motion.section
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="glass-panel relative w-full rounded-2xl p-6 text-primary-foreground lg:sticky lg:top-6 lg:p-8"
          >
            <div className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-leaf">
              <BadgeCheck className="h-4 w-4" /> Registry Protocol
            </div>
            <ol className="space-y-3">
              {STEPS.map((step, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl px-2 py-1.5 text-sm leading-relaxed opacity-90 transition-colors hover:bg-primary-foreground/5 hover:opacity-100"
                >
                  <span className="mt-0.5 flex h-5.5 w-5.5 min-w-5.5 items-center justify-center rounded-full bg-leaf text-[11px] font-extrabold text-forest">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-5 border-t border-primary-foreground/15 pt-4 text-center text-xs font-bold uppercase leading-relaxed tracking-wide">
              <ShieldAlert className="mr-1 inline h-4 w-4 text-gold" />
              <span className="text-gold">Strict Protocol:</span> Cheating or logging attendance for
              others is <span className="text-gold">strictly prohibited</span> and subject to
              disciplinary action.
            </p>
          </motion.section>
        )}

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className={`relative w-full rounded-2xl border-b-8 border-leaf bg-card shadow-card-lux transition-shadow ${
            kiosk ? "p-8 sm:p-12" : "p-8 sm:p-10"
          }`}
        >
          <div className="mb-6 border-b border-border pb-5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
              Daily Attendance Registry
            </p>
            <p className="mt-2 text-xs font-semibold text-emerald">
              On-time until {DEADLINE_LABEL} · Late from {LATE_FROM_LABEL}
            </p>
          </div>

          <div className="relative mb-4">
            <User className="pointer-events-none absolute left-4 top-6 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setStudentId(undefined);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              placeholder="Full Name"
              aria-label="Full Name"
              autoComplete="off"
              className={`${fieldClass} pl-11 pr-4`}
            />
            <AnimatePresence>
              {focused && suggestions.length > 0 && (
                <motion.ul
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-border bg-card shadow-card-lux"
                >
                  {suggestions.map((m) => (
                    <li key={m.id + m.name}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pick(m)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary"
                      >
                        <span className="text-sm font-semibold text-forest">{m.name}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {m.id} · {m.role}
                        </span>
                      </button>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>

          {matched && (
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald">
              <IdCard className="h-3.5 w-3.5" /> Verified · {matched.id}
              {matched.section ? ` · ${matched.section}` : ""}
            </p>
          )}

          <div className="relative mb-5">
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                if (e.target.value !== "Student") resetClass();
                haptic(10);
              }}
              aria-label="Role / Position"
              className={`${fieldClass} appearance-none px-4 pr-10`}
            >
              <option value="" disabled>
                Select Your Role
              </option>
              <option value="Student">Student</option>
              <option value="Faculty">Faculty</option>
              <option value="Staff">Staff</option>
              <option value="Admin">Admin</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          <AnimatePresence initial={false}>
            {isStudent && (
              <motion.div
                key="class-picker"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.28 }}
                className="overflow-hidden"
              >
                <div className="mb-5 rounded-xl border border-border bg-secondary/40 p-4">
                  <p className="mb-3 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald">
                    <GraduationCap className="h-3.5 w-3.5" /> Grade Level
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {GRADE_LEVELS.map((g) => (
                      <motion.button
                        key={g}
                        type="button"
                        whileTap={{ scale: 0.95 }}
                        onClick={() => chooseGrade(g)}
                        className={`rounded-lg border text-xs font-bold uppercase tracking-wider transition-all ${
                          kiosk ? "py-4" : "py-3"
                        } ${
                          gradeLevel === g
                            ? "border-leaf bg-leaf-gradient text-primary-foreground shadow-glow"
                            : "border-input bg-card text-forest hover:border-leaf hover:bg-secondary"
                        }`}
                      >
                        {g.replace("Grade ", "G")}
                      </motion.button>
                    ))}
                  </div>

                  <AnimatePresence initial={false}>
                    {gradeLevel && !senior && (
                      <motion.div
                        key="jhs-sections"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <p className="mb-3 mt-5 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald">
                          <Users2 className="h-3.5 w-3.5" /> Section · {gradeLevel}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {gradeSections.map((sct) => (
                            <motion.button
                              key={sct}
                              type="button"
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                setSection(sct);
                                haptic(10);
                              }}
                              className={`rounded-full border px-4 text-xs font-bold uppercase tracking-wider transition-all ${
                                kiosk ? "py-3" : "py-2.5"
                              } ${
                                section === sct
                                  ? "border-leaf bg-leaf-gradient text-primary-foreground shadow-glow"
                                  : "border-input bg-card text-forest hover:border-leaf hover:bg-secondary"
                              }`}
                            >
                              {sct}
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {gradeLevel && senior && (
                      <motion.div
                        key="shs-strands"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <p className="mb-3 mt-5 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald">
                          <Users2 className="h-3.5 w-3.5" /> Strand · {gradeLevel}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {gradeStrands.map((st) => (
                            <motion.button
                              key={st}
                              type="button"
                              whileTap={{ scale: 0.95 }}
                              onClick={() => chooseStrand(st)}
                              className={`rounded-full border px-4 text-xs font-bold uppercase tracking-wider transition-all ${
                                kiosk ? "py-3" : "py-2.5"
                              } ${
                                strand === st
                                  ? "border-leaf bg-leaf-gradient text-primary-foreground shadow-glow"
                                  : "border-input bg-card text-forest hover:border-leaf hover:bg-secondary"
                              }`}
                            >
                              {st}
                            </motion.button>
                          ))}
                        </div>

                        <AnimatePresence initial={false}>
                          {strand && gradeSets.length > 0 && (
                            <motion.div
                              key="shs-sets"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25 }}
                              className="overflow-hidden"
                            >
                              <p className="mb-3 mt-5 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald">
                                <Users2 className="h-3.5 w-3.5" /> Set
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {gradeSets.map((letter) => (
                                  <motion.button
                                    key={letter}
                                    type="button"
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => chooseSet(letter)}
                                    className={`flex items-center justify-center rounded-xl border text-base font-extrabold uppercase transition-all ${
                                      kiosk ? "h-16 w-16" : "h-12 w-12"
                                    } ${
                                      setLetter === letter
                                        ? "border-leaf bg-leaf-gradient text-primary-foreground shadow-glow"
                                        : "border-input bg-card text-forest hover:border-leaf hover:bg-secondary"
                                    }`}
                                  >
                                    {letter}
                                  </motion.button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {gradeLevel && section && (
                    <p className="mt-4 rounded-lg bg-card px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-forest">
                      Class: {gradeLevel} · {section}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {blocked && name.trim() !== "" && (
            <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs font-semibold text-destructive">
              This name is not on the registered roster. Please see the office to be enrolled in the
              system.
            </p>
          )}

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSubmit}
            disabled={submitting || blocked || incompleteClass}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold uppercase tracking-[0.2em] text-primary-foreground transition-all hover:-translate-y-0.5 hover:bg-emerald hover:shadow-glow disabled:pointer-events-none disabled:opacity-60 ${
              kiosk ? "px-8 py-6 text-base" : "px-8 py-4 text-xs"
            }`}
          >
            <Send className={kiosk ? "h-5 w-5" : "h-4 w-4"} />
            {submitting
              ? "Recording..."
              : incompleteClass
                ? !gradeLevel
                  ? "Select Grade Level"
                  : senior
                    ? !strand
                      ? "Select Strand"
                      : "Select Set"
                    : "Select Section"
                : "Submit Attendance"}
          </motion.button>
        </motion.section>
      </div>
    </main>
  );
}

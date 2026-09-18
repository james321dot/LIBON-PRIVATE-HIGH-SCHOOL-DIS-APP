import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Upload,
  Download,
  Trash2,
  UserPlus,
  ShieldCheck,
  Search,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  CloudCog,
} from "lucide-react";
import {
  downloadText,
  isStrictRoster,
  loadRoster,
  parseRosterCSV,
  rosterToCSV,
  saveRoster,
  setStrictRoster,
  validateRoster,
  ROSTER_TEMPLATE_CSV,
  type RosterMember,
  type RosterValidation,
} from "@/lib/roster";
import { GRADE_LEVELS } from "@/lib/classes";
import { allSectionsForGrade } from "@/lib/insights";

export function RosterManager() {
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [strict, setStrict] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState({
    id: "",
    name: "",
    role: "Student",
    gradeLevel: "",
    section: "",
  });
  const [pending, setPending] = useState<RosterValidation | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sync = () => {
      setRoster(loadRoster());
      setStrict(isStrictRoster());
    };
    sync();
    window.addEventListener("lphs-roster-change", sync);
    return () => window.removeEventListener("lphs-roster-change", sync);
  }, []);

  const commit = (list: RosterMember[]) => {
    setRoster(list);
    saveRoster(list);
  };

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return roster;
    return roster.filter((m) => m.name.toLowerCase().includes(t) || m.id.toLowerCase().includes(t));
  }, [roster, search]);

  const addMember = () => {
    if (!draft.name.trim()) return;
    commit([
      ...roster,
      {
        id: draft.id.trim() || `LPHS-${String(roster.length + 1).padStart(4, "0")}`,
        name: draft.name.trim(),
        role: draft.role,
        gradeLevel: draft.gradeLevel || undefined,
        section: draft.section.trim() || undefined,
      },
    ]);
    setDraft({ id: "", name: "", role: draft.role, gradeLevel: draft.gradeLevel, section: "" });
  };

  const importCSV = async (file: File) => {
    const text = await file.text();
    const parsed = parseRosterCSV(text);
    setPending(validateRoster(parsed, roster, GRADE_LEVELS, allSectionsForGrade));
  };

  const confirmImport = () => {
    if (!pending) return;
    const byKey = new Map(roster.map((m) => [m.name.toLowerCase(), m]));
    pending.members.filter((m) => m.name.trim()).forEach((m) => byKey.set(m.name.toLowerCase(), m));
    commit([...byKey.values()]);
    setPending(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <div className="rounded-xl bg-card p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-bold text-forest">Registered Roster</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Pre-register students and staff so the gate form autocompletes and rejects typos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importCSV(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl border border-forest bg-card px-4 py-2.5 text-xs font-semibold text-forest transition-all hover:-translate-y-0.5 hover:bg-secondary"
            >
              <Upload className="h-3.5 w-3.5" /> Import CSV
            </button>
            <button
              onClick={() => downloadText("LPHS_Roster_Template.csv", ROSTER_TEMPLATE_CSV)}
              className="inline-flex items-center gap-2 rounded-xl border border-forest bg-card px-4 py-2.5 text-xs font-semibold text-forest transition-all hover:-translate-y-0.5 hover:bg-secondary"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Template
            </button>
            <button
              onClick={() => downloadText("LPHS_Roster.csv", rosterToCSV(roster))}
              className="inline-flex items-center gap-2 rounded-xl border border-forest bg-card px-4 py-2.5 text-xs font-semibold text-forest transition-all hover:-translate-y-0.5 hover:bg-secondary"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
        </div>

        <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-xl border border-leaf/40 bg-secondary/50 px-4 py-3">
          <input
            type="checkbox"
            checked={strict}
            onChange={(e) => {
              setStrict(e.target.checked);
              setStrictRoster(e.target.checked);
            }}
            className="h-4 w-4 accent-[var(--leaf)]"
          />
          <span className="flex items-center gap-2 text-xs font-semibold text-forest">
            <ShieldCheck className="h-4 w-4 text-leaf" />
            Strict mode — only names on this roster can log attendance
          </span>
        </label>

        {pending && (
          <div className="mt-5 rounded-xl border border-gold/50 bg-gold/5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-bold text-forest">
                <AlertTriangle className="h-4 w-4 text-gold" />
                Import preview — {pending.valid} rows, {pending.duplicates} updates,{" "}
                {pending.issues.filter((i) => i.level === "error").length} errors
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPending(null)}
                  className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-forest"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmImport}
                  className="inline-flex items-center gap-2 rounded-xl bg-leaf-gradient px-5 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:shadow-glow"
                >
                  <CheckCircle2 className="h-4 w-4" /> Confirm import
                </button>
              </div>
            </div>
            {pending.issues.length > 0 ? (
              <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs">
                {pending.issues.map((iss, i) => (
                  <li
                    key={i}
                    className={iss.level === "error" ? "text-destructive" : "text-muted-foreground"}
                  >
                    Row {iss.row}: {iss.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-emerald">No issues found — safe to import.</p>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald">
          <CloudCog className="h-4 w-4 text-leaf" /> Roster syncs live to every guard tablet &amp;
          admin device
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-[120px_1fr_120px_120px_130px_auto]">
          <input
            value={draft.id}
            onChange={(e) => setDraft({ ...draft, id: e.target.value })}
            placeholder="ID"
            className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-leaf"
          />
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && addMember()}
            placeholder="Full name"
            className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-leaf"
          />
          <select
            value={draft.role}
            onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-leaf"
          >
            {["Student", "Faculty", "Staff", "Admin"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <select
            value={draft.gradeLevel}
            onChange={(e) => setDraft({ ...draft, gradeLevel: e.target.value, section: "" })}
            className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-leaf"
          >
            <option value="">Grade —</option>
            {GRADE_LEVELS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
          <input
            list="lphs-section-options"
            value={draft.section}
            onChange={(e) => setDraft({ ...draft, section: e.target.value })}
            placeholder="Section"
            className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-leaf"
          />
          <datalist id="lphs-section-options">
            {(draft.gradeLevel ? allSectionsForGrade(draft.gradeLevel) : []).map((sc) => (
              <option key={sc} value={sc} />
            ))}
          </datalist>
          <button
            onClick={addMember}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-leaf-gradient px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-glow"
          >
            <UserPlus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-card shadow-soft">
        <div className="relative border-b border-border p-4">
          <Search className="pointer-events-none absolute left-8 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${roster.length} registered members…`}
            className="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-4 text-sm outline-none focus:border-leaf"
          />
        </div>
        <div className="max-h-[26rem] overflow-y-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0">
              <tr className="bg-primary text-left text-[10px] uppercase tracking-[0.15em] text-primary-foreground">
                <th className="px-5 py-3 font-semibold">ID</th>
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold">Grade</th>
                <th className="px-5 py-3 font-semibold">Section</th>
                <th className="px-5 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id + m.name} className="border-b border-border hover:bg-secondary/40">
                  <td className="px-5 py-3 text-xs font-semibold tabular-nums text-emerald">
                    {m.id}
                  </td>
                  <td className="px-5 py-3 text-sm font-semibold text-foreground">{m.name}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{m.role}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{m.gradeLevel ?? "—"}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{m.section ?? "—"}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => commit(roster.filter((x) => x !== m))}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    No roster members yet. Add one above or import a CSV (ID, Name, Role, Grade
                    Level, Section).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

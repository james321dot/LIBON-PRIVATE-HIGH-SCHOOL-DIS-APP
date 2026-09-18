import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  Camera,
  CheckCircle2,
  CopyX,
  Download,
  Keyboard,
  Radio,
  ScanLine,
  ScanSearch,
  Trash2,
  XCircle,
} from "lucide-react";
import type { ScanEvent, ScanResult } from "@/lib/firebase-client";
import { isToday } from "@/lib/attendance";
import { downloadText } from "@/lib/roster";

type ResultFilter = "all" | ScanResult;

const RESULT_META: Record<
  ScanResult,
  { label: string; icon: React.ComponentType<{ className?: string }>; pill: string; rail: string }
> = {
  logged: {
    label: "Logged",
    icon: CheckCircle2,
    pill: "border-emerald bg-secondary text-emerald",
    rail: "border-l-leaf",
  },
  duplicate: {
    label: "Duplicate",
    icon: CopyX,
    pill: "border-gold bg-gold/10 text-gold",
    rail: "border-l-gold",
  },
  unreadable: {
    label: "Unreadable",
    icon: ScanSearch,
    pill: "border-muted-foreground/40 bg-muted text-muted-foreground",
    rail: "border-l-muted-foreground/40",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    pill: "border-destructive bg-destructive/10 text-destructive",
    rail: "border-l-destructive",
  },
};

function relative(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString();
}

export function ScanLogPanel({
  events,
  canClear,
  onClear,
}: {
  events: ScanEvent[];
  canClear: boolean;
  onClear: () => void;
}) {
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [todayOnly, setTodayOnly] = useState(true);
  const [station, setStation] = useState("all");
  const [armed, setArmed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  const stations = useMemo(
    () => [...new Set(events.map((e) => e.station).filter(Boolean))].sort(),
    [events],
  );

  const scoped = useMemo(
    () =>
      events.filter(
        (e) => (!todayOnly || isToday(e.timestamp)) && (station === "all" || e.station === station),
      ),
    [events, todayOnly, station],
  );
  const visible = useMemo(
    () => scoped.filter((e) => filter === "all" || e.result === filter),
    [scoped, filter],
  );

  const counts = useMemo(() => {
    const c: Record<ScanResult, number> = { logged: 0, duplicate: 0, unreadable: 0, failed: 0 };
    scoped.forEach((e) => c[e.result]++);
    return c;
  }, [scoped]);

  const lateLogged = scoped.filter((e) => e.result === "logged" && e.late).length;
  const latest = events[0];
  const isLive = latest ? now - latest.timestamp < 120000 : false;

  // Scans per minute over the last 10 minutes — quick gate throughput signal.
  const throughput = useMemo(() => {
    const cutoff = now - 10 * 60000;
    const recent = events.filter((e) => e.timestamp >= cutoff && e.result === "logged").length;
    return (recent / 10).toFixed(1);
  }, [events, now]);

  const exportCSV = () => {
    let csv = "Date,Time,Name,ID,Detail,Result,Late,Station,Source\n";
    visible.forEach((e) => {
      csv += `"${new Date(e.timestamp).toLocaleDateString()}","${e.time}","${e.name}","${
        e.studentId ?? ""
      }","${e.detail}","${e.result}","${e.late ? "Yes" : "No"}","${e.station}","${e.source}"\n`;
    });
    downloadText(`LPHS_ScanLog_${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Live status strip */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            {isLive && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-leaf opacity-75" />
            )}
            <span
              className={`relative inline-flex h-3 w-3 rounded-full ${
                isLive ? "bg-leaf" : "bg-muted-foreground/40"
              }`}
            />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-leaf">
              {isLive ? "Station active" : "Station idle"}
            </p>
            <p className="text-sm font-semibold text-forest">
              {latest
                ? `Last scan ${relative(latest.timestamp, now)} · ${latest.name}`
                : "No scans received yet"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-leaf" />
            <b className="tabular-nums text-forest">{throughput}</b> scans/min
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5 text-leaf" />
            <b className="tabular-nums text-forest">{stations.length}</b> station
            {stations.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(
          [
            { label: "Scans", value: scoped.length, tone: "text-forest" },
            { label: "Logged", value: counts.logged, tone: "text-emerald" },
            { label: "Late", value: lateLogged, tone: "text-destructive" },
            { label: "Duplicates", value: counts.duplicate, tone: "text-gold" },
            {
              label: "Rejected",
              value: counts.unreadable + counts.failed,
              tone: "text-muted-foreground",
            },
          ] as const
        ).map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border-t-4 border-leaf bg-card p-4 text-center shadow-soft"
          >
            <p className={`text-2xl font-bold tabular-nums ${s.tone}`}>{s.value}</p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {s.label}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:pb-0">
          {(["all", "logged", "duplicate", "unreadable", "failed"] as ResultFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 ${
                filter === f
                  ? "bg-leaf-gradient text-primary-foreground shadow-glow"
                  : "border border-border bg-card text-muted-foreground hover:text-forest"
              }`}
            >
              {f === "all" ? "All results" : RESULT_META[f].label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <button
            onClick={() => setTodayOnly((v) => !v)}
            className={`rounded-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 ${
              todayOnly
                ? "bg-forest text-primary-foreground"
                : "border border-border bg-card text-muted-foreground hover:text-forest"
            }`}
          >
            {todayOnly ? "Today" : "All time"}
          </button>
          {stations.length > 1 && (
            <select
              value={station}
              onChange={(e) => setStation(e.target.value)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-forest outline-none focus:border-leaf"
            >
              <option value="all">All stations</option>
              {stations.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={exportCSV}
            disabled={visible.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-forest bg-card px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-forest transition-all hover:bg-secondary active:scale-95 disabled:opacity-40"
          >
            <Download className="h-3 w-3" /> CSV
          </button>
          {canClear && (
            <button
              onClick={() => {
                if (armed) {
                  setArmed(false);
                  onClear();
                } else setArmed(true);
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 ${
                armed
                  ? "bg-destructive text-primary-foreground"
                  : "border border-destructive/40 bg-card text-destructive hover:bg-destructive/10"
              }`}
            >
              <Trash2 className="h-3 w-3" /> {armed ? "Tap again to clear" : "Clear log"}
            </button>
          )}
        </div>
      </div>

      {/* Feed */}
      <div className="rounded-2xl bg-card p-2 shadow-soft sm:p-3">
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {visible.map((e) => {
              const meta = RESULT_META[e.result];
              const Icon = meta.icon;
              return (
                <motion.li
                  key={e.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border border-l-4 bg-canvas/40 px-3 py-2.5 ${meta.rail}`}
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full border ${meta.pill}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">
                      {e.name}
                      {e.studentId && (
                        <span className="ml-2 text-[10px] font-bold tracking-wider text-emerald">
                          {e.studentId}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
                      {e.detail} · {e.station}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                        e.result === "logged" && e.late
                          ? "border-destructive bg-destructive/10 text-destructive"
                          : meta.pill
                      }`}
                    >
                      {e.result === "logged" ? (e.late ? "Late" : "On time") : meta.label}
                    </span>
                    <p className="mt-1 flex items-center justify-end gap-1 text-[10px] tabular-nums text-muted-foreground">
                      {e.source === "manual" ? (
                        <Keyboard className="h-3 w-3" />
                      ) : (
                        <Camera className="h-3 w-3" />
                      )}
                      {e.time}
                      <span className="hidden sm:inline"> · {relative(e.timestamp, now)}</span>
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
          {visible.length === 0 && (
            <li className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
              <ScanLine className="h-6 w-6 text-leaf" />
              {events.length === 0
                ? "No scans yet. Open QR Code Mode on the gate tablet and every scan will appear here instantly."
                : "No scans match these filters."}
            </li>
          )}
        </ul>
      </div>
    </motion.div>
  );
}

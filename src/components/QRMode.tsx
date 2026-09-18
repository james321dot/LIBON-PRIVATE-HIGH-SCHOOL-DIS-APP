import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import jsQR from "jsqr";
import QRCode from "qrcode";
import {
  ArrowLeft,
  CameraOff,
  Check,
  Download,
  FileDown,
  FileSpreadsheet,
  Keyboard,
  Loader2,
  Printer,
  QrCode,
  RefreshCw,
  ScanLine,
  Upload,
  UserRound,
  Users,
} from "lucide-react";
import logoUrl from "@/assets/lphslogo.png";
import clubLogoUrl from "@/assets/electronics-club-logo.png";
import { haptic } from "@/lib/guard-session";
import { loadRoster, downloadText, type RosterMember } from "@/lib/roster";
import { isLateAt } from "@/lib/attendance";
import { pushScanEvent } from "@/lib/firebase-client";
import {
  GRADE_LEVELS,
  composeSection,
  isSeniorHigh,
  sectionsForGrade,
  setsForGrade,
  strandsForGrade,
} from "@/lib/classes";
import {
  BADGE_ROLES,
  badgeLabel,
  decodeBadge,
  encodeBadge,
  type BadgePayload,
} from "@/lib/qr-badge";
import {
  BULK_TEMPLATE_CSV,
  buildQRCardSheet,
  downloadCardsPDF,
  normaliseGrade,
  parseStudentWorkbook,
  type BulkStudent,
} from "@/lib/qr-cards";

interface QRModeProps {
  operator: string;
  onBack: () => void;
  onSubmit: (
    name: string,
    role: string,
    studentId?: string,
    gradeLevel?: string,
    section?: string,
    silent?: boolean,
  ) => Promise<boolean>;
}

interface ScanLogItem {
  key: number;
  name: string;
  detail: string;
  time: string;
  ok: boolean;
  late: boolean;
}

type Tab = "scan" | "bulk" | "single";

export function QRModeView({ operator, onBack, onSubmit }: QRModeProps) {
  const [tab, setTab] = useState<Tab>("scan");

  return (
    <div className="flex min-h-screen flex-col bg-forest-deep text-primary-foreground">
      <header className="sticky top-0 z-20 border-b border-primary-foreground/10 bg-forest-deep/90 px-4 py-3 backdrop-blur-md sm:px-8">
        <div className="mx-auto grid max-w-6xl grid-cols-[auto_minmax(0,1fr)] items-center gap-3 sm:flex sm:justify-between">
          <button
            onClick={onBack}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-primary-foreground/20 px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all hover:-translate-y-0.5 hover:bg-primary-foreground/10 active:scale-95"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Registry
          </button>
          <div className="flex min-w-0 items-center gap-3 sm:order-first">
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <img
                src={logoUrl}
                alt="Libon Private High School seal"
                className="h-11 w-11 object-contain drop-shadow-sm"
              />
              <img
                src={clubLogoUrl}
                alt="LPHS Electronics Club logo"
                className="h-9 w-auto max-w-32 object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-leaf">
                QR Code Mode
              </p>
              <h1 className="truncate font-display text-lg font-bold sm:text-xl">
                Contactless Gate Scanning
              </h1>
            </div>
          </div>
          <div className="col-span-2 grid grid-cols-3 gap-2 sm:col-auto sm:w-auto">
            <TabButton active={tab === "scan"} onClick={() => setTab("scan")} icon={ScanLine}>
              Scanner
            </TabButton>
            <TabButton active={tab === "bulk"} onClick={() => setTab("bulk")} icon={Users}>
              Bulk Cards
            </TabButton>
            <TabButton active={tab === "single"} onClick={() => setTab("single")} icon={QrCode}>
              Single
            </TabButton>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8">
        {tab === "scan" && <Scanner operator={operator} onSubmit={onSubmit} />}
        {tab === "bulk" && <BulkGenerator />}
        {tab === "single" && <Generator />}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof QrCode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95 ${
        active
          ? "bg-leaf-gradient text-primary-foreground shadow-glow"
          : "border border-primary-foreground/20 text-primary-foreground/70 hover:bg-primary-foreground/10"
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {children}
    </button>
  );
}

/* ------------------------------- Scanner ------------------------------- */

const SCAN_COOLDOWN_MS = 5000;

let beepCtx: AudioContext | null = null;
/** Single short confirmation beep — higher for on-time, lower for late. */
function beep(late: boolean) {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    beepCtx ??= new AC();
    const ctx = beepCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = late ? 380 : 980;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    /* audio unavailable */
  }
}

function isLateNow() {
  return isLateAt();
}

interface Ceremony {
  name: string;
  detail: string;
  late: boolean;
  time: string;
  phase: "flash" | "success";
}

function Scanner({ operator, onSubmit }: { operator: string; onSubmit: QRModeProps["onSubmit"] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const busyRef = useRef(false);
  const lastRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const sessionRef = useRef<Set<string>>(new Set());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");
  const [reject, setReject] = useState("");
  const [ceremony, setCeremony] = useState<Ceremony | null>(null);
  const [log, setLog] = useState<ScanLogItem[]>([]);

  const record = useCallback(
    async (raw: string, source: "camera" | "manual" = "camera") => {
      if (busyRef.current) return;
      const now = Date.now();
      if (lastRef.current.text === raw && now - lastRef.current.at < SCAN_COOLDOWN_MS) return;
      lastRef.current = { text: raw, at: now };

      const time = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const station = operator || "QR STATION";
      const badge = decodeBadge(raw);
      if (!badge) {
        haptic([20, 50, 20]);
        setReject("Unreadable code — not an LPHS QR card");
        timers.current.push(setTimeout(() => setReject(""), 1800));
        void pushScanEvent({
          timestamp: now,
          time,
          name: "UNKNOWN CODE",
          detail: raw.slice(0, 40),
          result: "unreadable",
          late: false,
          station,
          source,
        }).catch(() => undefined);
        return;
      }

      const key = `${badge.id ?? ""}|${badge.name.trim().toUpperCase()}`;
      const base = {
        timestamp: now,
        time,
        name: badge.name.toUpperCase(),
        detail: badgeLabel(badge),
        station,
        source,
        ...(badge.id ? { studentId: badge.id } : {}),
      };
      if (sessionRef.current.has(key)) {
        haptic([20, 50, 20]);
        setReject(`${badge.name.toUpperCase()} is already logged this session`);
        timers.current.push(setTimeout(() => setReject(""), 1800));
        void pushScanEvent({ ...base, result: "duplicate", late: false }).catch(() => undefined);
        return;
      }

      busyRef.current = true;
      const late = isLateNow();
      beep(late);
      haptic(late ? [30, 60, 30] : 40);
      setCeremony({ name: badge.name, detail: badgeLabel(badge), late, time, phase: "flash" });

      // Flash 0.5–1s, then the full-screen congratulations page.
      timers.current.push(
        setTimeout(() => setCeremony((c) => (c ? { ...c, phase: "success" } : c)), 800),
      );

      const ok = await onSubmit(
        badge.name,
        badge.role,
        badge.id,
        badge.gradeLevel,
        badge.section,
        true,
      );
      if (ok) sessionRef.current.add(key);
      void pushScanEvent({ ...base, result: ok ? "logged" : "failed", late }).catch(
        () => undefined,
      );
      setLog((l) =>
        [
          { key: now, name: badge.name.toUpperCase(), detail: badgeLabel(badge), time, ok, late },
          ...l,
        ].slice(0, 40),
      );

      // Success page stays visible ~3s in total, then back to scanning.
      timers.current.push(
        setTimeout(() => {
          setCeremony(null);
          busyRef.current = false;
        }, 3000),
      );
    },
    [onSubmit, operator],
  );

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!busyRef.current && video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w && h) {
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          const image = ctx.getImageData(0, 0, w, h);
          const found = jsQR(image.data, w, h, { inversionAttempts: "dontInvert" });
          if (found?.data) void record(found.data);
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [record]);

  const start = useCallback(async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setError(
        "Camera unavailable. Allow camera access for this site, or use manual code entry below.",
      );
    }
  }, [tick]);

  useEffect(() => {
    void start();
    const list = timers.current;
    const video = videoRef.current;
    return () => {
      cancelAnimationFrame(rafRef.current);
      list.forEach(clearTimeout);
      const stream = video?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <section className="glass-panel rounded-3xl p-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-leaf">
                Live Scanner
              </p>
              <h2 className="truncate font-display text-xl font-bold">
                Present the QR card to the camera
              </h2>
            </div>
            <button
              onClick={() => void start()}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-primary-foreground/20 px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all hover:bg-primary-foreground/10 active:scale-95"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Restart
            </button>
          </div>

          <div className="relative mt-4 aspect-square w-full overflow-hidden rounded-3xl border border-primary-foreground/15 bg-black/60 sm:aspect-[4/3]">
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-[70%] w-[70%] max-w-md">
                {[
                  "left-0 top-0 border-l-4 border-t-4",
                  "right-0 top-0 border-r-4 border-t-4",
                  "left-0 bottom-0 border-l-4 border-b-4",
                  "right-0 bottom-0 border-r-4 border-b-4",
                ].map((c) => (
                  <span key={c} className={`absolute h-10 w-10 rounded-md border-leaf ${c}`} />
                ))}
                {active && !ceremony && (
                  <motion.span
                    className="absolute inset-x-2 h-0.5 rounded-full bg-leaf shadow-glow"
                    animate={{ top: ["4%", "94%", "4%"] }}
                    transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
              </div>
            </div>

            {!active && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-forest-deep/85 px-6 text-center">
                <CameraOff className="h-7 w-7 text-leaf" />
                <p className="max-w-xs text-xs leading-relaxed text-primary-foreground/70">
                  {error || "Starting camera…"}
                </p>
              </div>
            )}

            <AnimatePresence>
              {reject && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-x-0 bottom-0 bg-destructive/90 px-4 py-3 text-center text-xs font-bold uppercase tracking-wider"
                >
                  {reject}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 px-3">
            <Keyboard className="h-4 w-4 shrink-0 text-leaf" />
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && manual.trim()) {
                  void record(manual.trim(), "manual");
                  setManual("");
                }
              }}
              placeholder="USB scanner / manual code — press Enter"
              className="w-full bg-transparent py-3 text-xs text-primary-foreground placeholder:text-primary-foreground/35 focus:outline-none"
            />
          </div>
          <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-primary-foreground/45">
            Station: {operator || "—"} · Date, time and status are stamped automatically ·{" "}
            {SCAN_COOLDOWN_MS / 1000}s duplicate cooldown
          </p>
        </section>

        <section className="glass-panel rounded-3xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-leaf">This session</p>
          <h2 className="font-display text-xl font-bold">Scanned entries</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: "Logged", value: log.filter((l) => l.ok).length },
              { label: "On time", value: log.filter((l) => l.ok && !l.late).length },
              { label: "Late", value: log.filter((l) => l.ok && l.late).length },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 px-3 py-2.5 text-center"
              >
                <p className="font-display text-xl font-bold">{s.value}</p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-primary-foreground/50">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
          <ul className="mt-4 max-h-[26rem] space-y-2 overflow-y-auto pr-1">
            {log.length === 0 && (
              <li className="rounded-2xl border border-dashed border-primary-foreground/15 px-4 py-8 text-center text-xs text-primary-foreground/45">
                No scans yet. Present a QR card to begin.
              </li>
            )}
            {log.map((item) => (
              <motion.li
                key={item.key}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{item.name}</p>
                  <p className="truncate text-[10px] uppercase tracking-widest text-primary-foreground/50">
                    {item.detail} · {item.time}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider ${
                    !item.ok
                      ? "bg-destructive/20 text-destructive"
                      : item.late
                        ? "bg-gold/20 text-gold"
                        : "bg-leaf/20 text-leaf"
                  }`}
                >
                  {!item.ok ? "FAILED" : item.late ? "LATE" : "ON TIME"}
                </span>
              </motion.li>
            ))}
          </ul>
        </section>
      </div>

      <AnimatePresence>{ceremony && <Ceremony key="ceremony" {...ceremony} />}</AnimatePresence>
    </>
  );
}

/* --------------------- Flash + full screen success --------------------- */

function Ceremony({ name, detail, late, time, phase }: Ceremony) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className={`fixed inset-0 z-3000 flex items-center justify-center px-6 text-center ${
        late ? "bg-destructive" : "bg-emerald"
      }`}
    >
      {phase === "flash" ? (
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: [0.7, 1.12, 1], opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="font-display text-5xl font-black uppercase tracking-[0.2em] text-white sm:text-7xl"
        >
          {late ? "LATE" : "ON TIME"}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="w-full max-w-lg rounded-[2rem] bg-white/10 px-7 py-9 backdrop-blur-md ring-1 ring-white/25"
        >
          <img
            src={logoUrl}
            alt="LPHS seal"
            className="mx-auto h-20 w-20 rounded-full bg-white p-1.5 shadow-lg"
          />
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 14 }}
            className="mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-full bg-white"
          >
            <Check
              className={`h-9 w-9 ${late ? "text-destructive" : "text-emerald"}`}
              strokeWidth={4}
            />
          </motion.div>

          <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.4em] text-white/80">
            Congratulations!
          </p>
          <h2 className="mt-2 font-display text-3xl font-black uppercase leading-tight text-white sm:text-4xl">
            {name}
          </h2>
          <p className="mt-1 text-xs uppercase tracking-[0.25em] text-white/75">{detail}</p>
          <p className="mt-4 text-sm leading-relaxed text-white/85">
            You have successfully logged in to the
            <br />
            <span className="font-bold">LPHS DIGITAL ATTENDANCE SYSTEM</span>
          </p>

          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5">
            <span
              className={`h-2.5 w-2.5 rounded-full ${late ? "bg-destructive" : "bg-emerald"}`}
            />
            <span
              className={`text-xs font-black uppercase tracking-[0.25em] ${
                late ? "text-destructive" : "text-emerald"
              }`}
            >
              {late ? "Late" : "On Time"} · {time}
            </span>
          </div>

          <p className="mt-6 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/70">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving attendance…
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

/* --------------------------- Bulk generator --------------------------- */

function BulkGenerator() {
  const [students, setStudents] = useState<BulkStudent[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      const rows = await parseStudentWorkbook(file);
      if (rows.length === 0) {
        setError("No student rows found. Expected columns: Name, Grade, Section, Student ID.");
      }
      setStudents(rows);
      setFileName(file.name);
    } catch {
      setError("That file could not be read. Upload an .xlsx, .xls or .csv student list.");
    }
    setBusy(false);
  };

  const printCards = async () => {
    if (students.length === 0) return;
    setBusy(true);
    const html = await buildQRCardSheet(students, logoUrl);
    setBusy(false);
    const win = window.open("", "_blank", "width=900,height=1100");
    if (!win) {
      setError("Pop-ups are blocked. Allow pop-ups to open the printable card sheet.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const savePDF = async () => {
    if (students.length === 0) return;
    setBusy(true);
    setError("");
    try {
      await downloadCardsPDF(students, logoUrl, `LPHS-QR-Cards-${students.length}.pdf`);
    } catch {
      setError("The PDF could not be generated. Try the print option instead.");
    }
    setBusy(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="glass-panel rounded-3xl p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-leaf">
          Bulk QR Generator
        </p>
        <h2 className="font-display text-xl font-bold">Upload a student list</h2>
        <p className="mt-1 text-xs leading-relaxed text-primary-foreground/60">
          Excel (.xlsx), Excel 97 (.xls) or CSV — including Google Sheets exported as CSV. Columns:
          <span className="font-bold text-primary-foreground/80">
            {" "}
            Name, Grade, Section, Student ID
          </span>
          . The role is set to Student automatically; date, time and status are never stored on the
          card.
        </p>

        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) void handleFile(f);
          }}
          className="mt-5 flex cursor-pointer flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-primary-foreground/25 bg-primary-foreground/5 px-6 py-10 text-center transition-all hover:border-leaf hover:bg-primary-foreground/10"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
          {busy ? (
            <Loader2 className="h-7 w-7 animate-spin text-leaf" />
          ) : (
            <Upload className="h-7 w-7 text-leaf" />
          )}
          <p className="text-sm font-bold">
            {fileName || "Drop your spreadsheet here or tap to browse"}
          </p>
          <p className="text-[10px] uppercase tracking-[0.25em] text-primary-foreground/50">
            .xlsx · .xls · .csv
          </p>
        </label>

        {error && (
          <p className="mt-3 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-[11px] font-semibold text-gold">
            {error}
          </p>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            onClick={() => downloadText("LPHS-Student-List-Template.csv", BULK_TEMPLATE_CSV)}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-primary-foreground/20 py-3 text-[11px] font-bold uppercase tracking-[0.2em] transition-all hover:bg-primary-foreground/10 active:scale-[0.98]"
          >
            <FileSpreadsheet className="h-4 w-4" /> Template CSV
          </button>
          <button
            onClick={() => void printCards()}
            disabled={students.length === 0 || busy}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-leaf-gradient py-3 text-[11px] font-bold uppercase tracking-[0.2em] transition-all hover:-translate-y-0.5 hover:shadow-glow active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Printer className="h-4 w-4" />
            {students.length ? `Print ${students.length} cards` : "Print cards"}
          </button>
          <button
            onClick={() => void savePDF()}
            disabled={students.length === 0 || busy}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-leaf/50 bg-leaf/15 py-3 text-[11px] font-bold uppercase tracking-[0.2em] transition-all hover:-translate-y-0.5 hover:bg-leaf/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:col-span-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Download PDF
          </button>
        </div>
        <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-primary-foreground/45">
          A4 · 6 cards per page · cutting guides included
        </p>
      </section>

      <section className="glass-panel rounded-3xl p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-leaf">Preview</p>
        <h2 className="font-display text-xl font-bold">
          {students.length} student{students.length === 1 ? "" : "s"} ready
        </h2>
        <ul className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
          {students.length === 0 && (
            <li className="rounded-2xl border border-dashed border-primary-foreground/15 px-4 py-10 text-center text-xs text-primary-foreground/45">
              Upload a list to see the cards that will be generated.
            </li>
          )}
          {students.map((s, i) => (
            <li
              key={`${s.id}-${i}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold uppercase">{s.name}</p>
                <p className="truncate text-[10px] uppercase tracking-widest text-primary-foreground/50">
                  {[normaliseGrade(s.gradeLevel), s.section].filter(Boolean).join(" · ") ||
                    "No class given"}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-primary-foreground/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-primary-foreground/70">
                {s.id || "—"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ------------------------------ Generator ------------------------------ */

function Generator() {
  const [name, setName] = useState("");
  const [role, setRole] = useState("Student");
  const [studentId, setStudentId] = useState("");
  const [grade, setGrade] = useState("");
  const [strand, setStrand] = useState("");
  const [set, setSet] = useState("");
  const [section, setSection] = useState("");
  const [dataUrl, setDataUrl] = useState("");
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [sheetBusy, setSheetBusy] = useState(false);

  useEffect(() => {
    setRoster(loadRoster());
  }, []);

  const isStudent = role === "Student";
  const finalSection = isSeniorHigh(grade) ? composeSection(strand, set) : section;

  useEffect(() => {
    if (!name.trim()) {
      setDataUrl("");
      return;
    }
    const payload: BadgePayload = {
      name: name.trim().toUpperCase(),
      role,
      ...(studentId.trim() ? { id: studentId.trim() } : {}),
      ...(isStudent && grade ? { gradeLevel: grade } : {}),
      ...(isStudent && finalSection ? { section: finalSection } : {}),
    };
    void QRCode.toDataURL(encodeBadge(payload), {
      width: 512,
      margin: 1,
      color: { dark: "#0d3b26", light: "#ffffff" },
    }).then(setDataUrl);
  }, [name, role, studentId, grade, finalSection, isStudent]);

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `LPHS-QR-${name.trim().toUpperCase().replace(/\s+/g, "-")}.png`;
    a.click();
  };

  const openSheet = async (rows: BulkStudent[]) => {
    const html = await buildQRCardSheet(rows, logoUrl);
    const win = window.open("", "_blank", "width=900,height=1100");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const currentCard = (): BulkStudent => ({
    id: studentId.trim(),
    name: name.trim().toUpperCase(),
    gradeLevel: isStudent ? grade : "",
    section: isStudent ? finalSection : "",
    role,
  });

  const printSingleCard = async () => {
    if (!name.trim()) return;
    setSheetBusy(true);
    await openSheet([currentCard()]);
    setSheetBusy(false);
  };

  const downloadSinglePDF = async () => {
    if (!name.trim()) return;
    setSheetBusy(true);
    try {
      await downloadCardsPDF(
        [currentCard()],
        logoUrl,
        `LPHS-QR-Card-${name.trim().toUpperCase().replace(/\s+/g, "-")}.pdf`,
      );
    } catch {
      /* fall back to print */
    }
    setSheetBusy(false);
  };

  const printRosterSheet = async () => {
    if (roster.length === 0) return;
    setSheetBusy(true);
    await openSheet(
      roster.map((m) => ({
        id: m.id,
        name: m.name,
        gradeLevel: m.gradeLevel ?? "",
        section: m.section ?? "",
        role: m.role || "Student",
      })),
    );
    setSheetBusy(false);
  };

  const field =
    "w-full rounded-xl border border-primary-foreground/15 bg-primary-foreground/5 px-3 py-3 text-sm text-primary-foreground placeholder:text-primary-foreground/35 focus:outline-none focus:ring-2 focus:ring-leaf/50";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <section className="glass-panel rounded-3xl p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-leaf">Badge Builder</p>
        <h2 className="font-display text-xl font-bold">Generate a single QR badge</h2>
        <p className="mt-1 text-xs leading-relaxed text-primary-foreground/55">
          The code stores name, role, grade level and section only. Date, time and status are added
          by the system at the moment of scanning.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground/60">
              Full name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="DELA CRUZ JUAN"
              className={field}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground/60">
              Role
            </label>
            <div className="flex flex-wrap gap-2">
              {BADGE_ROLES.map((r) => (
                <Chip key={r} active={role === r} onClick={() => setRole(r)}>
                  {r}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground/60">
              ID number (optional)
            </label>
            <input
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="LPHS-0001"
              className={field}
            />
          </div>

          {isStudent && (
            <>
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground/60">
                  Grade level
                </label>
                <div className="flex flex-wrap gap-2">
                  {GRADE_LEVELS.map((g) => (
                    <Chip
                      key={g}
                      active={grade === g}
                      onClick={() => {
                        setGrade(g);
                        setSection("");
                        setStrand("");
                        setSet("");
                      }}
                    >
                      {g}
                    </Chip>
                  ))}
                </div>
              </div>

              {grade && !isSeniorHigh(grade) && (
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground/60">
                    Section
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {sectionsForGrade(grade).map((s) => (
                      <Chip key={s} active={section === s} onClick={() => setSection(s)}>
                        {s}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {grade && isSeniorHigh(grade) && (
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground/60">
                    Strand
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {strandsForGrade(grade).map((s) => (
                      <Chip
                        key={s}
                        active={strand === s}
                        onClick={() => {
                          setStrand(s);
                          setSet("");
                        }}
                      >
                        {s}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {grade && strand && setsForGrade(grade).length > 0 && (
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground/60">
                    Set
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {setsForGrade(grade).map((s) => (
                      <Chip key={s} active={set === s} onClick={() => setSet(s)}>
                        {s}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section className="glass-panel flex flex-col items-center rounded-3xl p-5 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-leaf">Preview</p>
        <div className="mt-4 flex aspect-square w-full max-w-[16rem] items-center justify-center rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-3">
          {dataUrl ? (
            <img src={dataUrl} alt="Generated QR badge" className="h-full w-full rounded-xl" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-primary-foreground/40">
              <UserRound className="h-8 w-8" />
              <p className="text-xs">Enter a name to preview</p>
            </div>
          )}
        </div>
        <p className="mt-3 font-display text-lg font-bold uppercase">{name || "—"}</p>
        <p className="text-[10px] uppercase tracking-[0.2em] text-primary-foreground/50">
          {[isStudent ? grade : role, isStudent ? finalSection : ""].filter(Boolean).join(" · ") ||
            role}
        </p>

        <button
          onClick={download}
          disabled={!dataUrl}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-leaf-gradient py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-glow active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="h-4 w-4" /> Download PNG
        </button>
        <button
          onClick={() => void printSingleCard()}
          disabled={!dataUrl || sheetBusy}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-leaf/50 bg-leaf/15 py-3 text-[11px] font-bold uppercase tracking-[0.2em] transition-all hover:-translate-y-0.5 hover:bg-leaf/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sheetBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Printer className="h-4 w-4" />
          )}
          Print this card
        </button>
        <button
          onClick={() => void downloadSinglePDF()}
          disabled={!dataUrl || sheetBusy}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-leaf/50 bg-leaf/15 py-3 text-[11px] font-bold uppercase tracking-[0.2em] transition-all hover:-translate-y-0.5 hover:bg-leaf/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sheetBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4" />
          )}
          Download PDF
        </button>
        <button
          onClick={() => void printRosterSheet()}
          disabled={roster.length === 0 || sheetBusy}

          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-primary-foreground/20 py-3 text-[11px] font-bold uppercase tracking-[0.2em] transition-all hover:bg-primary-foreground/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Users className="h-4 w-4" />
          {roster.length ? `Print cards for ${roster.length} roster members` : "Roster is empty"}
        </button>
      </section>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95 ${
        active
          ? "bg-leaf-gradient text-primary-foreground shadow-glow"
          : "border border-primary-foreground/20 text-primary-foreground/70 hover:bg-primary-foreground/10"
      }`}
    >
      {children}
    </button>
  );
}

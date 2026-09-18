import * as XLSX from "xlsx";
import QRCode from "qrcode";
import { encodeBadge, type BadgePayload } from "./qr-badge";

export interface BulkStudent {
  id: string;
  name: string;
  gradeLevel: string;
  section: string;
  role: string;
}

const pick = (row: Record<string, unknown>, keys: string[]): string => {
  for (const key of Object.keys(row)) {
    const norm = key.toLowerCase().replace(/[^a-z]/g, "");
    if (keys.includes(norm)) {
      const v = row[key];
      if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
    }
  }
  return "";
};

/** Reads an .xlsx / .xls / .csv student list into badge rows. Role is always Student. */
export async function parseStudentWorkbook(file: File): Promise<BulkStudent[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return rows
    .map((row) => ({
      id: pick(row, ["id", "studentid", "lrn", "idnumber", "studentnumber"]),
      name: pick(row, ["name", "fullname", "studentname", "learnername"]),
      gradeLevel: pick(row, ["grade", "gradelevel", "level", "yearlevel"]),
      section: pick(row, ["section", "strand", "sectionstrand", "class"]),
      role: "Student",
    }))
    .filter((s) => s.name);
}

/** Normalises "10" / "Grade 10" into the system's "Grade 10" label. */
export function normaliseGrade(value: string): string {
  const v = value.trim();
  if (!v) return "";
  const digits = v.match(/\d{1,2}/)?.[0];
  return digits ? `Grade ${digits}` : v;
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

const REMINDERS = [
  "Keep It Clean & Clear: Avoid folding, bending, or scratching the QR code. Keep the surface clean so the camera can scan it instantly.",
  "Hold Still & Distance: When scanning, hold the card steady 4 to 6 inches in front of the scanner camera.",
  "Wait for the Flash: Ensure you see or hear the green confirmation flash before walking away.",
  "Scan Once Only: Do not tap or scan twice in a row\u2014the system will block accidental duplicate entries.",
  "Do Not Share: Your QR card is linked directly to your official school profile. Sharing or scanning for another student is strictly prohibited.",
  "Lost or Damaged Card? Report immediately to your Class Adviser or the Electronics Club / Security Personnel for a replacement.",
];

/** Card geometry — A4 portrait, 2 columns x 3 rows = 6 cards per page. */
export const CARD_WIDTH_MM = 97;
export const CARD_HEIGHT_MM = 92;

/** Shared stylesheet for the official LPHS card (locked design). */
const CARD_CSS = `
  * { box-sizing: border-box; }
  .card {
    position: relative; overflow: hidden; background: #f7f9f8;
    width: ${CARD_WIDTH_MM}mm; height: ${CARD_HEIGHT_MM}mm;
    page-break-inside: avoid; break-inside: avoid;
    display: flex; flex-direction: column; justify-content: space-between;
    font-family: 'Arial Black', 'Segoe UI', Arial, sans-serif; color: #14532d;
  }
  .bg { position: absolute; z-index: 0; }
  .bg.tl { top: -10mm; left: -13mm; width: 30mm; height: 19mm; background: #166534; transform: rotate(-28deg); }
  .bg.tl2 { top: -7mm; left: -15mm; width: 30mm; height: 10mm; background: #4ade80; transform: rotate(-28deg); }
  .bg.tr { top: -12mm; right: -12mm; width: 27mm; height: 22mm; background: #14532d; transform: rotate(30deg); }
  .bg.tr2 { top: -4mm; right: -15mm; width: 27mm; height: 7mm; background: #22c55e; transform: rotate(30deg); }
  .bg.bl { bottom: 5mm; left: -15mm; width: 25mm; height: 16mm; background: #166534; transform: rotate(28deg); }
  .bg.br { bottom: 4mm; right: -13mm; width: 24mm; height: 18mm; background: #14532d; transform: rotate(-30deg); }
  .inner {
    position: relative; z-index: 1; flex: 1; margin: 2.6mm 2.6mm 0; background: #fff;
    border-radius: 1.6mm; text-align: center; display: flex; flex-direction: column;
    align-items: center; padding: 2mm 3mm 1.4mm; min-height: 0;
  }
  .seal { height: 10mm; }
  .card h1 { font-size: 10.5pt; font-weight: 900; margin: 0.8mm 0 0; line-height: .98; letter-spacing: -.3px; color: #14532d; }
  .card h2 { font-size: 6pt; font-weight: 800; margin: 0.7mm 0 0; letter-spacing: .2px; color: #166534; }
  .card h3 { font-size: 5.4pt; font-weight: 900; margin: 1.4mm 0 0.8mm; letter-spacing: .2px; color: #14532d; }
  .qr-frame { border: .5mm solid #14532d; border-radius: 2mm; padding: 1.2mm; background: #fff; }
  .qr { width: 27mm; height: 27mm; display: block; image-rendering: pixelated; }
  .pname { font-family: Georgia, 'Times New Roman', serif; font-size: 14pt; font-weight: 700; margin: 0.9mm 0 0; line-height: 1.02; color: #14532d; }
  .pclass { font-family: Georgia, 'Times New Roman', serif; font-size: 6.4pt; margin: 0.8mm 0 0; letter-spacing: .4px; color: #14532d; }
  .sign { margin-top: auto; padding-top: 1.6mm; }
  .sign span { display: block; width: 26mm; height: .3mm; background: #14532d; margin: 0 auto .6mm; }
  .sign small { font-family: Georgia, 'Times New Roman', serif; font-size: 5.4pt; letter-spacing: .4px; color: #14532d; }
  .pid { font-size: 4pt; letter-spacing: 1px; color: #6b8578; margin: 0.6mm 0 0; font-family: Arial, sans-serif; }
  .reminders {
    position: relative; z-index: 1; margin: 1.4mm 0 0; padding: 1.2mm 3mm 1.6mm 4.4mm;
    background: #fff; list-style: none;
    column-count: 2; column-gap: 3mm;
  }
  .reminders li {
    font-family: Arial, Helvetica, sans-serif; font-size: 3.5pt; line-height: 1.4;
    color: #123; break-inside: avoid; margin-bottom: .5mm;
  }
  .reminders li::before { content: "- "; }
`;

async function renderCardHtml(s: BulkStudent, logoUrl: string): Promise<string> {
  const payload: BadgePayload = {
    id: s.id || undefined,
    name: s.name.toUpperCase(),
    role: s.role || "Student",
    gradeLevel: normaliseGrade(s.gradeLevel) || undefined,
    section: s.section || undefined,
  };
  // High resolution keeps the code crisp at 300+ dpi print.
  const qr = await QRCode.toDataURL(encodeBadge(payload), {
    width: 1600,
    margin: 0,
    errorCorrectionLevel: "Q",
    color: { dark: "#0d3b1f", light: "#ffffff" },
  });
  const grade = normaliseGrade(s.gradeLevel);
  const gradeSection = [grade, s.section].filter(Boolean).join(" - ") || "GRADE & SECTION";
  return `<article class="card">
    <span class="bg tl"></span><span class="bg tl2"></span>
    <span class="bg tr"></span><span class="bg tr2"></span>
    <span class="bg bl"></span><span class="bg br"></span>
    <div class="inner">
      <img class="seal" src="${logoUrl}" alt="LPHS seal" />
      <h1>LIBON PRIVATE<br/>HIGH SCHOOL INC.</h1>
      <h2>LPHS ELECTRONICS CLUB</h2>
      <h3>LPHS DIGITAL ATTENDANCE SYSTEM</h3>
      <div class="qr-frame"><img class="qr" src="${qr}" alt="QR code for ${escapeHtml(s.name)}" /></div>
      <p class="pname">${escapeHtml(s.name.toUpperCase())}</p>
      <p class="pclass">${escapeHtml(gradeSection.toUpperCase())}</p>
      <div class="sign"><span></span><small>STUDENTS SIGNATURE</small></div>
      ${s.id ? `<p class="pid">${escapeHtml(s.id)}</p>` : ""}
    </div>
    <ul class="reminders">${REMINDERS.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
  </article>`;
}

/**
 * Builds an A4 printable sheet of the OFFICIAL LPHS QR cards
 * (2 columns x 3 rows = 6 per page) with cutting guides and print-safe margins.
 */
export async function buildQRCardSheet(students: BulkStudent[], logoUrl: string): Promise<string> {
  const cards = await Promise.all(students.map((s) => renderCardHtml(s, logoUrl)));

  const pages: string[] = [];
  for (let i = 0; i < cards.length; i += 6) {
    pages.push(`<section class="page">${cards.slice(i, i + 6).join("")}</section>`);
  }

  return `<!doctype html><html><head><meta charset="utf-8"/>
<title>LPHS QR Cards \u2014 ${students.length} student${students.length === 1 ? "" : "s"}</title>
<style>
  @page { size: A4 portrait; margin: 6mm; }
  ${CARD_CSS}
  body { margin: 0; background: #e9eeeb; font-family: 'Arial Black', 'Segoe UI', Arial, sans-serif; color: #14532d; }
  .toolbar {
    position: sticky; top: 0; z-index: 50; display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
    padding: 12px 18px; background: #14532d; color: #fff; font-family: Arial, Helvetica, sans-serif;
  }
  .toolbar strong { font-size: 13px; letter-spacing: .5px; }
  .toolbar span { font-size: 11px; opacity: .75; margin-right: auto; }
  .toolbar button {
    border: 0; border-radius: 999px; padding: 9px 18px; font-size: 11px; font-weight: 700;
    letter-spacing: 1.2px; text-transform: uppercase; cursor: pointer; background: #4ade80; color: #06281a;
    transition: transform .15s ease, filter .15s ease;
  }
  .toolbar button.ghost { background: rgba(255,255,255,.14); color: #fff; }
  .toolbar button:hover { transform: translateY(-1px); filter: brightness(1.05); }
  .page {
    width: 198mm; min-height: 283mm; margin: 0 auto 6mm; padding: 0;
    display: grid; grid-template-columns: ${CARD_WIDTH_MM}mm ${CARD_WIDTH_MM}mm;
    grid-template-rows: repeat(3, ${CARD_HEIGHT_MM}mm);
    justify-content: center; align-content: start; gap: 2mm 3mm;
    background: #fff; page-break-after: always; break-after: page;
  }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .card { outline: 1px dashed #9aa8a1; outline-offset: 0; }
  @media print {
    .toolbar, .no-print { display: none !important; }
    body { background: #fff; margin: 0; }
    .page { margin: 0; width: auto; min-height: auto; background: #fff; }
    .card { outline: 1px dashed #b9c4be; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style></head>
<body>
<div class="toolbar no-print">
  <strong>LPHS QR Cards</strong>
  <span>${students.length} card${students.length === 1 ? "" : "s"} \u00b7 A4 \u00b7 6 per page \u00b7 cutting guides</span>
  <button onclick="window.print()">Print</button>
  <button class="ghost" onclick="window.close()">Close</button>
</div>
${pages.join("")}
<script>window.onload = () => setTimeout(() => window.print(), 700);</script>
</body></html>`;
}

/**
 * Exports cards as a print-ready A4 PDF (6 per page) without using the
 * browser print dialog. Renders the real card markup off-screen.
 */
export async function downloadCardsPDF(
  students: BulkStudent[],
  logoUrl: string,
  filename: string,
): Promise<void> {
  if (students.length === 0) return;
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);

  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;background:#fff;";
  const style = document.createElement("style");
  style.textContent = CARD_CSS;
  host.appendChild(style);
  document.body.appendChild(host);

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const marginX = (210 - CARD_WIDTH_MM * 2 - 3) / 2;
  const marginY = 8;

  try {
    for (let i = 0; i < students.length; i++) {
      const wrap = document.createElement("div");
      wrap.innerHTML = await renderCardHtml(students[i]!, logoUrl);
      host.appendChild(wrap);
      const canvas = await html2canvas(wrap.firstElementChild as HTMLElement, {
        scale: 3,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
      });
      host.removeChild(wrap);

      const slot = i % 6;
      if (i > 0 && slot === 0) pdf.addPage();
      const x = marginX + (slot % 2) * (CARD_WIDTH_MM + 3);
      const y = marginY + Math.floor(slot / 2) * (CARD_HEIGHT_MM + 2);
      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.95),
        "JPEG",
        x,
        y,
        CARD_WIDTH_MM,
        CARD_HEIGHT_MM,
      );
      pdf.setDrawColor(180, 195, 187);
      pdf.setLineDashPattern([1, 1], 0);
      pdf.rect(x, y, CARD_WIDTH_MM, CARD_HEIGHT_MM);
    }
    pdf.save(filename);
  } finally {
    document.body.removeChild(host);
  }
}

export const BULK_TEMPLATE_CSV = `Student ID,Name,Grade,Section
LPHS-0001,"QUITE, CHESTER B.",10,GLADIOLA
LPHS-0002,"GUIRIBA JAMES CHRISTOPHER P.",10,GLADIOLA
LPHS-0003,"SAYSON, ALFRED JOHN",8,MAGNOLIA
`;

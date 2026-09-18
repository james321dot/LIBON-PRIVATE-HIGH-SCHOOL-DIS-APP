import { BrandMark } from "@/components/BrandMark";
import { DEADLINE_LABEL, LATE_FROM_LABEL } from "@/lib/attendance";

interface SiteFooterProps {
  onDevClick?: () => void;
}

export function SiteFooter({ onDevClick }: SiteFooterProps = {}) {
  return (
    <footer className="w-full border-t border-border bg-card px-5 py-10 lg:px-10">
      <div className="mx-auto grid w-full max-w-7xl gap-8 text-center sm:grid-cols-2 sm:text-left lg:grid-cols-4">
        <BrandMark
          compact
          className="justify-center sm:justify-start sm:col-span-2 lg:col-span-1"
        />

        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald">
            Attendance Policy
          </p>
          <p className="text-sm text-foreground/80">
            ● On-time until <span className="font-semibold text-emerald">{DEADLINE_LABEL}</span>
          </p>
          <p className="text-sm text-foreground/80">
            ● Marked late from <span className="font-semibold text-emerald">{LATE_FROM_LABEL}</span>
          </p>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald">
            System Build.
          </p>
          <p className="text-sm text-foreground/80">
            ● Database: <span className="font-semibold text-emerald">Google Firebase RTDB</span>
          </p>
          <p
            role="button"
            tabIndex={0}
            onClick={onDevClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onDevClick?.();
              }
            }}
            className="cursor-pointer text-sm text-foreground/80 outline-none transition-colors hover:text-foreground focus-visible:text-foreground"
          >
            ● Version: <span className="font-semibold text-emerald">1.2.5 2026</span>
          </p>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald">
            Platform
          </p>
          <p className="text-sm font-bold text-forest">LPHS Digital Attendance System (DAS)</p>
          <p className="text-sm text-muted-foreground">
            Guard-verified · Real-time · Secure · Fast · Efficient{" "}
          </p>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-7xl border-t border-border pt-6 text-center text-xs leading-relaxed text-muted-foreground">
        © 2026-{" "}
        <span className="font-semibold text-emerald">
          <a
            href="https://www.facebook.com/LPHSinc"
            target="_blank"
            rel="noreferrer"
            className="transition-opacity hover:opacity-80"
          >
            LIBON PRIVATE HIGH SCHOOL Inc.
          </a>
        </span>
        -All Rights Reserved. <br /> IN PARTNERSHIP WITH THE
        <b>
          {" "}
          <i>LPHS ELECTRONICS CLUB. </i>
        </b>
        <br />
        <br />
        MAIN DEVELOPER / DESIGNER:{" "}
        <a
          href="https://www.facebook.com/Guiriba.j"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-emerald transition-opacity hover:opacity-80"
        >
          JAMES CHRISTOPHER GUIRIBA
        </a>{" "}
        | CO-DEVELOPER / CONTENT SPECIALIST:{" "}
        <a
          href="https://www.facebook.com/chester.quite"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-emerald transition-opacity hover:opacity-80"
        >
          CHESTER QUITE
        </a>
      </div>
    </footer>
  );
}

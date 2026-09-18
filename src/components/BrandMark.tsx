import logoUrl from "@/assets/lphslogo.png";
import clubLogoUrl from "@/assets/electronics-club-logo.png";

interface BrandMarkProps {
  /** Rendered on dark backgrounds when true. */
  inverted?: boolean;
  compact?: boolean;
  showClub?: boolean;
  className?: string;
}

/**
 * Official lockup for the LPHS Digital Attendance System —
 * school seal, institution name and system wordmark.
 */
export function BrandMark({
  inverted = false,
  compact = false,
  showClub = false,
  className = "",
}: BrandMarkProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex shrink-0 items-center gap-2">
        <img
          src={logoUrl}
          alt="Libon Private High School seal"
          className={`${compact ? "h-10" : "h-12 sm:h-14"} w-auto shrink-0 object-contain drop-shadow-sm`}
          width={112}
          height={112}
        />
        {showClub && (
          <img
            src={clubLogoUrl}
            alt="LPHS Electronics Club logo"
            className={`${compact ? "h-7 max-w-20" : "h-8 max-w-24 sm:h-9 sm:max-w-28"} w-auto shrink-0 object-contain`}
          />
        )}
      </div>
      <div className="min-w-0 leading-tight">
        <p
          className={`text-[9px] font-bold uppercase tracking-[0.2em] ${
            inverted ? "text-leaf" : "text-emerald"
          }`}
        >
          LIBON PRIVATE HIGH SCHOOL Inc.
        </p>
        <p
          className={`font-display font-bold leading-tight ${
            compact ? "text-base" : "text-lg sm:text-xl"
          } ${inverted ? "text-primary-foreground" : "text-forest"}`}
        >
          Digital Attendance System (DAS)
        </p>
        <p
          className={`mt-0.5 text-[9px] font-semibold uppercase tracking-[0.22em] ${
            inverted ? "text-primary-foreground/60" : "text-muted-foreground"
          }`}
        >
          Est. 1950 · DIGITAL GATE ACCESS SYSTEM
        </p>
      </div>
    </div>
  );
}

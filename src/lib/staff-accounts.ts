/**
 * Public staff identity shapes.
 *
 * IMPORTANT: This file is imported by client components, so it must never hold
 * a password or any secret — anything here is compiled into the public bundle.
 * Password verification lives in `staff-auth.server.ts`, which runs on the
 * server and returns only the non-sensitive fields below.
 */
export type StaffRole = "Guard" | "Admin" | "EClub" | "Dev";

export interface StaffAccount {
  /** Role label shown on the guard bar. */
  role: string;
  /** Short badge label. */
  badge: string;
  /** Stable identifier used to label the session; never the password. */
  staffRole: StaffRole;
}

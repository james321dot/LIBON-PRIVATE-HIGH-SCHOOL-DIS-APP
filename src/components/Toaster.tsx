import { AnimatePresence, motion } from "motion/react";
import type { ToastItem } from "@/lib/attendance";

export function Toaster({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="pointer-events-none fixed right-4 top-6 z-9999 flex w-full max-w-md flex-col gap-3 px-4 sm:right-6">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ x: 120, opacity: 0, scale: 0.95 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 120, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="pointer-events-auto flex items-center gap-4 rounded-xl border-l-4 border-emerald bg-card p-4 shadow-card-lux"
          >
            <div className="text-2xl">{toast.icon}</div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-emerald">
                {toast.title}
              </p>
              <p className="truncate text-sm text-foreground">{toast.message}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

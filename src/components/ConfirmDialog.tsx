import { motion } from "motion/react";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-2000 flex items-center justify-center bg-forest-deep/80 px-5 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="w-full max-w-sm rounded-2xl border-b-8 border-leaf bg-card p-7 shadow-card-lux"
      >
        <div
          className={`mb-4 flex h-11 w-11 items-center justify-center rounded-full ${
            destructive ? "bg-destructive/10 text-destructive" : "bg-secondary text-emerald"
          }`}
        >
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="font-display text-xl font-bold text-forest">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-input bg-card py-3 text-[11px] font-bold uppercase tracking-[0.15em] text-forest transition-colors hover:bg-secondary"
          >
            {cancelLabel}
          </button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onConfirm}
            className={`flex-1 rounded-xl py-3 text-[11px] font-bold uppercase tracking-[0.15em] text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-glow ${
              destructive ? "bg-destructive" : "bg-primary"
            }`}
          >
            {confirmLabel}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

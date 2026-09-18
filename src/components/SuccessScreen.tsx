import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, Hourglass } from "lucide-react";

interface SuccessScreenProps {
  visible: boolean;
  isLate: boolean;
  time: string;
}

const CONFETTI = Array.from({ length: 24 }, (_, i) => i);
const COLORS = ["#52b788", "#2d6a4f", "#fbbf24", "#d8f3dc", "#1b4332"];

export function SuccessScreen({ visible, isLate, time }: SuccessScreenProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-3000 flex flex-col items-center justify-center overflow-hidden bg-card text-center"
        >
          {/* Confetti burst — skip when late */}
          {!isLate &&
            CONFETTI.map((i) => {
              const angle = (i / CONFETTI.length) * Math.PI * 2;
              const dist = 220 + Math.random() * 120;
              const x = Math.cos(angle) * dist;
              const y = Math.sin(angle) * dist;
              return (
                <motion.span
                  key={i}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 0.6, rotate: 0 }}
                  animate={{ x, y, opacity: 0, scale: 1, rotate: 360 }}
                  transition={{ duration: 1.4, ease: "easeOut" }}
                  className="pointer-events-none absolute left-1/2 top-1/2 h-2.5 w-2.5 rounded-sm"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
              );
            })}

          <motion.div
            initial={{ scale: 0, rotate: -40 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 14, delay: 0.1 }}
            className="mb-6"
          >
            {isLate ? (
              <Hourglass className="h-24 w-24 text-gold" />
            ) : (
              <CheckCircle2 className="h-24 w-24 text-leaf" />
            )}
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="font-display text-5xl font-bold text-forest"
          >
            {isLate ? "Late Entry" : "Good Morning!"}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="mt-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald"
          >
            Recorded at {time}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

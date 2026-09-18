import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import logoUrl from "@/assets/lphslogo.png";

const KEY = "lphs_intro_shown";

export function CrestIntro() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, "1");
    // Mount on the next frame so this overlay is added AFTER hydration finishes.
    // Mounting during the hydration commit makes AnimatePresence skip the exit
    // animation, leaving an opaque full-screen div that blocks the whole UI.
    const raf = requestAnimationFrame(() => setVisible(true));
    const t = setTimeout(() => setVisible(false), 2200);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="pointer-events-none fixed inset-0 z 4000 flex flex-col items-center justify-center bg-hero-gradient"
        >
          <motion.div
            initial={{ scale: 0.4, rotate: -30, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 140, damping: 14 }}
            className="relative"
          >
            <div className="absolute inset-0 -m-8 animate-pulse rounded-full bg-leaf/20 blur-3xl" />
            <img
              src={logoUrl}
              alt="LPHS Seal"
              className="relative h-40 w-40 object-contain drop-shadow-[0_0_30px_rgba(82,183,136,0.6)]"
            />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 font-display text-3xl font-bold text-primary-foreground sm:text-4xl"
          >
            Libon Private High School
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="mt-3 text-[11px] font-semibold uppercase tracking-[0.4em] text-leaf"
          >
            Dreamers · Achievers · Agents of Change
          </motion.p>
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="mt-8 h-0.5 w-40 origin-left bg-leaf"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

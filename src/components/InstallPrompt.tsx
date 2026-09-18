import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt({ compact = false }: { compact?: boolean }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !deferred) return null;

  const install = async () => {
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  if (compact) {
    return (
      <button
        onClick={install}
        title="Install the guard tablet app"
        className="inline-flex items-center gap-1.5 rounded-lg border border-leaf/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-leaf transition-colors hover:bg-leaf/10"
      >
        <Download className="h-3.5 w-3.5" /> Install
      </button>
    );
  }

  return (
    <button
      onClick={install}
      className="inline-flex items-center gap-2 rounded-xl bg-leaf-gradient px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-glow"
    >
      <Smartphone className="h-4 w-4" /> Install Tablet App
    </button>
  );
}

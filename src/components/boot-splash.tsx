import { useEffect, useState } from "react";

export function BootSplash() {
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");

  useEffect(() => {
    const backup = window.setTimeout(() => setPhase("gone"), 4200);
    return () => window.clearTimeout(backup);
  }, []);

  function finish() {
    setPhase((current) => (current === "gone" ? current : "out"));
    window.setTimeout(() => setPhase("gone"), 200);
  }

  if (phase === "gone") return null;

  return (
    <div className={`boot-splash${phase === "out" ? " boot-splash-out" : ""}`} role="status" aria-label="Caricamento">
      <div className="boot-copy">
        <p className="boot-title">MT TRAVEL SERVICE APP</p>
        <p className="boot-sub">la tua corsa in un tocco.</p>
      </div>
      <video className="boot-film" src="/brand/boot.mp4" autoPlay muted playsInline preload="auto" onEnded={finish} />
    </div>
  );
}

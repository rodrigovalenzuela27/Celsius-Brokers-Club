"use client";

import { useEffect, useState } from "react";

/** Cuenta regresiva del apartado 24h. El cron del servidor es la autoridad. */
export function HoldCountdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = new Date(expiresAt).getTime() - now;

  if (remaining <= 0) {
    return (
      <span className="font-mono text-sm text-unit-held">
        Expirado · la unidad se libera automáticamente
      </span>
    );
  }

  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <span className="font-mono text-sm text-accent" suppressHydrationWarning>
      Vigente · expira en {pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
}

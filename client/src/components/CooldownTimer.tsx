import { useEffect, useState } from "react";

interface CooldownTimerProps {
  cooldownUntil: number | null;
  message: string | null;
}

export function CooldownTimer({ cooldownUntil, message }: CooldownTimerProps) {
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    if (!cooldownUntil) {
      setRemainingMs(0);
      return;
    }

    const tick = () => {
      const left = Math.max(0, cooldownUntil - Date.now());
      setRemainingMs(left);
    };
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const active = remainingMs > 0;
  const seconds = (remainingMs / 1000).toFixed(1);

  return (
    <div className={`cooldown${active ? " is-active" : ""}`} aria-live="polite">
      {active ? (
        <span>Next pixel in <strong>{seconds}s</strong></span>
      ) : message ? (
        <span>{message}</span>
      ) : (
        <span>Ready to paint</span>
      )}
    </div>
  );
}

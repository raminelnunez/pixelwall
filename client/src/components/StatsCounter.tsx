import { useCallback, useEffect, useState } from "react";
import { apiBase } from "../config";
import type { StatsPayload } from "../types";

export function StatsCounter() {
  const [count, setCount] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/stats`);
      if (!res.ok) return;
      const data = (await res.json()) as StatsPayload;
      setCount(data.paintedToday);
    } catch {
      // ignore — free-tier cold start
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return (
    <div className="stats">
      <span className="stats-value">{count === null ? "—" : count.toLocaleString()}</span>
      <span className="stats-label">pixels painted today</span>
    </div>
  );
}

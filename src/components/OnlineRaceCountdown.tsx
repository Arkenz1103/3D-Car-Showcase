import { useEffect, useState } from "react";

type OnlineRaceCountdownProps = { startAt: number | null };

export function OnlineRaceCountdown({ startAt }: OnlineRaceCountdownProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startAt === null) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 50);
    return () => window.clearInterval(timer);
  }, [startAt]);
  if (startAt === null) return null;

  const elapsed = Math.max(0, now - startAt);
  if (elapsed >= 3900) return null;
  const label = elapsed < 1000 ? "3" : elapsed < 2000 ? "2" : elapsed < 3000 ? "1" : "GO!";
  const color = label === "GO!" ? "text-emerald-300" : "text-white";

  return (
    <div className="pointer-events-none fixed inset-0 z-[120] grid place-items-center bg-[#02050ae8] backdrop-blur-md" role="status" aria-live="assertive" aria-label={`Online race starts ${label}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.12),transparent_52%)]" />
      <div key={label} className="online-race-count-in relative text-center">
        <div className="font-mono-tech text-[10px] uppercase tracking-[.38em] text-sky-200/75">Room start sequence</div>
        <div className={`mt-2 font-display text-[clamp(7rem,24vw,15rem)] font-black leading-none tracking-tight ${color} drop-shadow-[0_0_40px_rgba(56,189,248,.38)]`}>{label}</div>
        <div className="mt-3 font-mono-tech text-[9px] uppercase tracking-[.3em] text-zinc-400">{label === "GO!" ? "All racers · launch" : "Get ready"}</div>
      </div>
    </div>
  );
}

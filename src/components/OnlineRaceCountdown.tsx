import { useEffect, useState } from "react";

type OnlineRaceCountdownProps = { startAt: number | null };
const COUNTDOWN_LABEL = "THE RACE IS STARTING IN 3... 2... 1...";

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
  if (elapsed >= 3000) return null;
  const activeNumber = elapsed < 1000 ? 3 : elapsed < 2000 ? 2 : 1;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[120] grid place-items-center bg-[#02050ae8] backdrop-blur-md"
      role="status"
      aria-live="assertive"
      aria-label={COUNTDOWN_LABEL}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.12),transparent_52%)]" />
      <div className="relative w-full px-4 text-center sm:px-8">
        <div className="font-mono-tech text-[clamp(1.1rem,4vw,2.8rem)] font-bold uppercase tracking-[.15em] text-sky-100 sm:tracking-[.24em]">
          THE RACE IS STARTING IN
        </div>
        <div className="mt-5 flex items-center justify-center gap-1 font-display text-[clamp(3rem,15vw,9rem)] font-black leading-none tracking-tight sm:gap-3">
          {[3, 2, 1].map((number) => {
            const active = number === activeNumber;
            const elapsedNumber = number > activeNumber;
            return (
              <span
                key={number}
                className={`inline-flex items-baseline whitespace-nowrap ${active ? "online-race-count-in text-white drop-shadow-[0_0_40px_rgba(56,189,248,.5)]" : elapsedNumber ? "text-sky-100/45" : "text-white/25"}`}
                aria-hidden="true"
              >
                {number}<span className="text-[0.52em] text-sky-200/75">...</span>
              </span>
            );
          })}
        </div>
        <span className="sr-only">{COUNTDOWN_LABEL}</span>
      </div>
    </div>
  );
}

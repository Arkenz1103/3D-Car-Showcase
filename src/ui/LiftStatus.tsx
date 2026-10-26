import { ChevronsUp, RotateCw, SkipForward } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { liftTimeline, type LiftPhase } from "@/three/liftTimeline";

const LABELS: Record<LiftPhase, { title: string; hint: string }> = {
  idle: { title: "Hydraulic Lift", hint: "Standby" },
  arming: { title: "Hydraulic Lift", hint: "Warming PBR shaders" },
  hold: { title: "Hydraulic Lift", hint: "Hydraulics engaged" },
  ascending: { title: "Lift Ascending", hint: "Raising to showroom level" },
  settle: { title: "Platform Locked", hint: "Showroom level reached" },
  showcase: { title: "360° Showcase", hint: "Slow presentation turn" },
  unwind: { title: "Turntable", hint: "Aligning to hero view" },
  done: { title: "Turntable", hint: "Presentation complete" },
};

/**
 * Small HUD pill shown while the car is being lifted / rotated.
 * Subscribes to the throttled lift snapshot (~8 Hz), independent from the 3D loop.
 */
export function LiftStatus() {
  const snap = useSyncExternalStore(
    liftTimeline.subscribe,
    liftTimeline.getSnapshot,
    liftTimeline.getSnapshot,
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (snap.phase === "idle") {
      setVisible(false);
      return;
    }
    if (snap.phase === "done") {
      const id = window.setTimeout(() => setVisible(false), 1600);
      return () => window.clearTimeout(id);
    }
    setVisible(true);
  }, [snap.phase]);

  if (!visible) return null;

  const label = LABELS[snap.phase];
  const isShowcase = snap.phase === "showcase" || snap.phase === "unwind";
  const skippable = snap.phase === "ascending" || snap.phase === "settle" || snap.phase === "showcase";
  const pct = Math.round(snap.progress * 100);
  const accent = isShowcase ? "#F5C518" : "#DC1A22";

  return (
    <div
      className="atelier-pill pointer-events-auto flex items-center gap-3 rounded-2xl px-3.5 py-2 text-zinc-100 shadow-lg"
      style={{ contain: "content" }}
      role="status"
      aria-live="polite"
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${accent}22`, color: accent }}
      >
        {isShowcase ? (
          <RotateCw className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: "37.5s" }} />
        ) : (
          <ChevronsUp className="h-3.5 w-3.5" />
        )}
      </span>
      <div className="flex min-w-[150px] flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-display text-[12px] font-semibold leading-none tracking-tight">
            {label.title}
          </span>
          <span className="font-mono-tech text-[10px] leading-none" style={{ color: accent }}>
            {snap.phase === "showcase"
              ? `${Math.round(snap.yawDeg).toString().padStart(3, "0")}°`
              : snap.phase === "ascending"
                ? `${pct}%`
                : ""}
          </span>
        </div>
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full"
            style={{
              width: `${snap.phase === "done" || snap.phase === "unwind" ? 100 : pct}%`,
              backgroundColor: accent,
              transition: "width 140ms linear",
            }}
          />
        </div>
        <span className="font-mono-tech text-[9px] uppercase tracking-[0.18em] text-zinc-400">
          {label.hint}
        </span>
      </div>
      {skippable && (
        <button
          type="button"
          onClick={() => liftTimeline.skipShowcase()}
          className="ml-1 flex cursor-pointer items-center gap-1 rounded-lg border border-white/10 px-2 py-1 font-mono-tech text-[9px] uppercase tracking-wider text-zinc-300 transition-colors hover:border-white/30 hover:text-white"
          title="Skip the presentation turn"
        >
          <SkipForward className="h-3 w-3" />
          Skip
        </button>
      )}
    </div>
  );
}

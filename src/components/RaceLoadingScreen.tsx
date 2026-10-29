import React from "react";
import { Flag } from "lucide-react";

type RaceLoadingScreenProps = {
  sceneReady: boolean;
  onComplete: () => void;
};

const MIN_LOADING_MS = 2200;
const FINISH_ANIMATION_MS = 320;
const RACE_LOADING_IMAGE = `${import.meta.env.BASE_URL}images/race-loading-background.jpg`;

export function RaceLoadingScreen({ sceneReady, onComplete }: RaceLoadingScreenProps) {
  const [progress, setProgress] = React.useState(1);
  const startedAt = React.useRef(0);
  const sceneReadyRef = React.useRef(sceneReady);
  sceneReadyRef.current = sceneReady;

  React.useEffect(() => {
    startedAt.current = performance.now();
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - startedAt.current;
      let next: number;
      if (elapsed < MIN_LOADING_MS) {
        // Fill smoothly to 92%, then hold there until the 3D scene confirms it
        // has rendered. The progress never claims completion prematurely.
        next = 1 + Math.floor((elapsed / MIN_LOADING_MS) * 91);
        next = Math.min(92, next);
      } else if (sceneReadyRef.current) {
        const finish = Math.min(1, (elapsed - MIN_LOADING_MS) / FINISH_ANIMATION_MS);
        next = 92 + Math.floor(finish * 8);
      } else {
        next = 92;
      }
      setProgress((current) => Math.max(current, next));
    }, 24);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (!sceneReady || progress < 100) return;
    const timer = window.setTimeout(onComplete, 260);
    return () => window.clearTimeout(timer);
  }, [sceneReady, progress, onComplete]);

  return (
    <div
      className="fixed inset-0 z-[2147483000] overflow-hidden bg-[#05070d] text-white"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(3, 6, 13, 0.22) 0%, rgba(3, 6, 13, 0.18) 36%, rgba(3, 6, 13, 0.78) 68%, rgba(3, 6, 13, 0.97) 100%), url("${RACE_LOADING_IMAGE}")`,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
      role="status"
      aria-live="polite"
      aria-label={`Loading race circuit: ${progress}%`}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-[#05070d]/25 via-transparent to-[#05070d]/20" />
      <div className="relative flex min-h-full flex-col items-center justify-end px-5 pb-[max(8vh,3rem)] text-center sm:px-8">
        <div className="w-full max-w-2xl">
          <div className="mx-auto mb-4 flex w-fit items-center gap-2 rounded-full border border-white/15 bg-black/35 px-4 py-2 backdrop-blur-md">
            <Flag className="h-4 w-4 text-[#F5C518]" />
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.28em] text-white/85">Race Control · Circuit Preparation</span>
          </div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-[0.08em] text-white drop-shadow-[0_3px_16px_rgba(0,0,0,0.8)] sm:text-5xl">
            Loading Circuit
          </h1>
          <p className="mt-3 font-mono-tech text-xs uppercase tracking-[0.14em] text-white/70 sm:text-sm">
            Preparing the track, opponents and race lights
          </p>

          <div className="mt-8 flex items-end justify-between gap-4 text-left">
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.24em] text-white/65">Loading</span>
            <span className="font-mono-tech text-3xl font-semibold tabular-nums text-[#F5C518] sm:text-4xl">{progress}%</span>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full border border-white/20 bg-black/50 shadow-[0_0_24px_rgba(0,0,0,0.55)]"
            role="progressbar"
            aria-label="Race loading progress"
            aria-valuemin={1}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#F5C518] via-[#F5A623] to-[#38BDF8] shadow-[0_0_18px_rgba(56,189,248,0.65)] transition-[width] duration-100 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

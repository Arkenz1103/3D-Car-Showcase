import React from "react";

type LoadingScreenProps = {
  assetReady: boolean;
  onComplete: () => void;
};

const LOADING_DURATION_MS = 1800;

export function LoadingScreen({ assetReady, onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = React.useState(1);

  React.useEffect(() => {
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      const next = Math.min(100, 1 + Math.floor((elapsed / LOADING_DURATION_MS) * 99));
      setProgress(next);
      if (next === 100) window.clearInterval(timer);
    }, 20);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (!assetReady || progress < 100) return;
    const timer = window.setTimeout(onComplete, 250);
    return () => window.clearTimeout(timer);
  }, [assetReady, onComplete, progress]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#060709]/97 px-6 text-center"
      style={{ zIndex: 2147483000, isolation: "isolate" }}
      role="status"
      aria-live="polite"
      aria-label={`Loading showroom: ${progress}%`}
    >
      <div
        className="h-[2px] w-48 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-label="Showroom loading progress"
        aria-valuemin={1}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <div
          className="h-full bg-[#DC1A22] shadow-[0_0_16px_rgba(220,26,34,0.7)] transition-[width] duration-75"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="space-y-1">
        <div className="font-mono-tech text-[11px] uppercase tracking-[0.25em] text-[#F5C518]">
          Maranello Digital Atelier
        </div>
        <div className="font-display text-lg font-medium text-white">
          Initializing 3D GLTF 2.0 Showroom &amp; PBR Shaders
        </div>
        <div className="pt-1 font-mono-tech text-xs font-semibold uppercase tracking-[0.2em] text-zinc-300">
          Loading {progress}%
        </div>
      </div>
    </div>
  );
}

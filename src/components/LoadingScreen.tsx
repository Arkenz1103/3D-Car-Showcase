import React from "react";

type LoadingScreenProps = {
  assetReady: boolean;
  onComplete: () => void;
};

const LOADING_DURATION_MS = 4000;
const LOADING_BACKGROUND_IMAGE = "/images/city-of-speedrunners-loading-v2.png";

export function LoadingScreen({ assetReady, onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = React.useState(1);
  const [backgroundReady, setBackgroundReady] = React.useState(false);
  const [isExiting, setIsExiting] = React.useState(false);

  React.useEffect(() => {
    let disposed = false;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (!disposed) setBackgroundReady(true);
    };
    image.onerror = () => {
      // Keep the gradient fallback visible if the artwork cannot be decoded.
      if (!disposed) setBackgroundReady(false);
    };
    image.src = LOADING_BACKGROUND_IMAGE;
    if (image.complete && image.naturalWidth > 0) setBackgroundReady(true);
    return () => {
      disposed = true;
      image.onload = null;
      image.onerror = null;
    };
  }, []);

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
    const fadeTimer = window.setTimeout(() => setIsExiting(true), 180);
    const completeTimer = window.setTimeout(onComplete, 950);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(completeTimer);
    };
  }, [assetReady, onComplete, progress]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 overflow-hidden bg-[#050812] px-6 text-center transition-opacity duration-700 ease-out ${isExiting ? "pointer-events-none opacity-0" : "opacity-100"}`}
      style={{ zIndex: 2147483000, isolation: "isolate" }}
      role="status"
      aria-live="polite"
      aria-label={`Loading CITY OF SPEEDRUNNERS: ${progress}%`}
    >
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        <div
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-700 ${backgroundReady ? "opacity-100" : "opacity-0"}`}
          style={{
            backgroundImage: `url("${LOADING_BACKGROUND_IMAGE}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(90deg, rgba(3, 6, 14, 0.52) 0%, rgba(3, 6, 14, 0.22) 48%, rgba(3, 6, 14, 0.42) 100%), radial-gradient(ellipse at center, rgba(5, 8, 18, 0.02) 5%, rgba(2, 4, 10, 0.48) 100%)",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-5xl space-y-5">
        <div className="font-display text-4xl sm:text-6xl md:text-7xl font-black uppercase italic leading-[0.95] tracking-[0.055em] text-rose-50" style={{ WebkitTextStroke: "1px rgba(255, 142, 170, 0.7)", textShadow: "0 2px 0 rgba(102, 17, 39, 0.95), 0 5px 0 rgba(28, 12, 25, 0.9), 0 0 10px rgba(255, 92, 133, 0.95), 0 0 26px rgba(246, 37, 98, 0.72), 0 0 52px rgba(45, 214, 255, 0.32)" }}>
          CITY OF SPEEDRUNNERS
        </div>
        <div className="font-display text-base font-medium text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] sm:text-xl">
          Initializing 3D GLTF 2.0 Showroom &amp; PBR Shaders
        </div>

        <div className="mx-auto w-full max-w-md rounded-xl border border-white/20 bg-[#050812]/65 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-sm sm:px-5">
          <div className="mb-2 flex items-center justify-between font-mono-tech text-[11px] font-bold uppercase tracking-[0.2em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
            <span className="text-cyan-100">LOADING</span>
            <span className="tabular-nums text-rose-100">{progress}%</span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full border border-white/20 bg-black/70 shadow-[inset_0_1px_4px_rgba(0,0,0,0.85)]"
            role="progressbar"
            aria-label="Showroom loading progress"
            aria-valuemin={1}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#ff446f] via-[#f6f0ff] to-[#55e7ff] shadow-[0_0_16px_rgba(255,72,124,0.9)] transition-[width] duration-100 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

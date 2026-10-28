import React from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Lightbulb } from "lucide-react";
import { raceTelemetry } from "@/three/raceEngine";
import { cityInput } from "@/three/cityDrive";

type CityInputKey = "forward" | "reverse" | "left" | "right" | "handbrake";
type TouchKeyProps = { input: CityInputKey; children: React.ReactNode; label: string; wide?: boolean };
type CityHudProps = { headlightsOn: boolean; onToggleHeadlights: () => void };

function TouchKey({ input, children, label, wide = false }: TouchKeyProps) {
  const press = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    cityInput[input] = true;
  };
  const release = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    cityInput[input] = false;
  };
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(event) => event.preventDefault()}
      className={`grid h-12 ${wide ? "w-16" : "w-12"} touch-none place-items-center rounded-xl border border-white/15 bg-black/55 text-white shadow-lg backdrop-blur-md active:scale-95 active:border-[#F5C518]/60 active:bg-[#F5C518]/15`}
    >{children}</button>
  );
}

export function CityHud({ headlightsOn, onToggleHeadlights }: CityHudProps) {
  const [speed, setSpeed] = React.useState(0);
  const [gear, setGear] = React.useState("N");
  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setSpeed(Math.round(raceTelemetry.speedKph));
      setGear(raceTelemetry.gearLabel);
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 text-white" aria-label="City driving controls">
      <button type="button" onClick={onToggleHeadlights} aria-pressed={headlightsOn} className="pointer-events-auto absolute right-3 top-20 flex items-center gap-2 rounded-xl border border-white/15 bg-black/55 px-3 py-2.5 font-mono-tech text-[9px] uppercase tracking-wider text-white backdrop-blur-md hover:border-white/35 sm:right-5">
        <Lightbulb className={`h-4 w-4 ${headlightsOn ? "text-amber-300" : "text-zinc-400"}`} /> <span className="hidden sm:inline">Lights</span>
      </button>

      <div className="absolute bottom-4 right-3 flex items-end gap-3 sm:bottom-6 sm:right-6">
        <div className="rounded-2xl border border-white/10 bg-[#0b1118]/80 px-4 py-3 shadow-xl backdrop-blur-xl sm:px-5 sm:py-4">
          <div className="flex items-end gap-3">
            <div>
              <div className="font-mono-tech text-[8px] uppercase tracking-[0.2em] text-zinc-400">Speed · km/h</div>
              <div className="mt-0.5 font-mono-tech text-4xl font-bold tabular-nums leading-none tracking-tight sm:text-5xl">{String(speed).padStart(3, "0")}</div>
            </div>
            <div className="mb-0.5 border-l border-white/15 pl-3">
              <div className="font-mono-tech text-[8px] uppercase tracking-wider text-zinc-500">Gear</div>
              <div className="font-mono-tech text-xl font-bold text-[#F5C518]">{gear}</div>
            </div>
          </div>
          <div className="mt-2 font-mono-tech text-[8px] uppercase tracking-wider text-zinc-500">WASD / arrows · Space handbrake · C camera · Esc drive off</div>
        </div>
      </div>

      <div className="pointer-events-auto absolute bottom-4 left-3 flex items-end gap-2 sm:bottom-6 sm:left-6">
        <div className="grid grid-cols-3 items-center gap-1.5 rounded-2xl border border-white/10 bg-black/40 p-2 backdrop-blur-md sm:p-2.5">
          <span />
          <TouchKey input="forward" label="Accelerate"><ArrowUp className="h-5 w-5" /></TouchKey>
          <span />
          <TouchKey input="left" label="Steer left"><ArrowLeft className="h-5 w-5" /></TouchKey>
          <TouchKey input="reverse" label="Brake or reverse"><ArrowDown className="h-5 w-5" /></TouchKey>
          <TouchKey input="right" label="Steer right"><ArrowRight className="h-5 w-5" /></TouchKey>
        </div>
        <TouchKey input="handbrake" label="Handbrake" wide>HANDBRAKE</TouchKey>
      </div>
    </div>
  );
}

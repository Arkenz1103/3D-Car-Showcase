import React from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Lightbulb, Power } from "lucide-react";
import { raceTelemetry } from "@/three/raceEngine";
import { cityDrive, cityInput, selectCityGear, shiftCityGear, toggleCityEngine } from "@/three/cityDrive";
import { playEngineStartSound, stopEngineStartSound } from "@/three/raceAudio";

type CityInputKey = "forward" | "brake" | "left" | "right" | "handbrake";
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
  const [rpm, setRpm] = React.useState(0);
  const [engineRunning, setEngineRunning] = React.useState(cityDrive.engineRunning);
  const [topSpeed, setTopSpeed] = React.useState(cityDrive.topSpeedKph);
  const [gearCount, setGearCount] = React.useState(cityDrive.gearCount);
  const [redlineRpm, setRedlineRpm] = React.useState(cityDrive.redlineRpm);
  const [transmission, setTransmission] = React.useState(cityDrive.transmission);
  const [modelName, setModelName] = React.useState(cityDrive.modelName);
  const [concept, setConcept] = React.useState(false);
  const [shiftFeedback, setShiftFeedback] = React.useState("");
  const [shiftPrompt, setShiftPrompt] = React.useState("");
  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setSpeed(Math.round(raceTelemetry.speedKph));
      setGear(raceTelemetry.gearLabel);
      setRpm(Math.round(cityDrive.rpm / 100) * 100);
      setTopSpeed(cityDrive.topSpeedKph);
      setGearCount(cityDrive.gearCount);
      setRedlineRpm(cityDrive.redlineRpm);
      setTransmission(cityDrive.transmission);
      setModelName(cityDrive.modelName);
      setConcept(cityDrive.concept);
      setShiftFeedback(cityDrive.shiftFeedback);
      setShiftPrompt(cityDrive.shiftPrompt);
      setEngineRunning(cityDrive.engineRunning);
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  const handleEngineToggle = () => {
    const wasRunning = cityDrive.engineRunning;
    if (!toggleCityEngine()) return;
    if (!wasRunning && cityDrive.engineRunning) playEngineStartSound();
    else stopEngineStartSound();
  };
  return (
    <div className="pointer-events-none fixed inset-0 z-40 text-white" aria-label="City driving controls">
      <button type="button" onClick={onToggleHeadlights} aria-pressed={headlightsOn} className="pointer-events-auto absolute right-3 top-20 flex items-center gap-2 rounded-xl border border-white/15 bg-black/55 px-3 py-2.5 font-mono-tech text-[9px] uppercase tracking-wider text-white backdrop-blur-md hover:border-white/35 sm:right-5">
        <Lightbulb className={`h-4 w-4 ${headlightsOn ? "text-amber-300" : "text-zinc-400"}`} /> <span className="hidden sm:inline">Lights</span>
      </button>

      <div className="absolute bottom-4 right-3 flex items-end gap-3 sm:bottom-6 sm:right-6">
        <div className="min-w-[280px] rounded-2xl border border-white/10 bg-[#080d13]/90 px-4 py-3 shadow-2xl shadow-black/30 backdrop-blur-xl sm:min-w-[350px] sm:px-5 sm:py-4">
          <div className="mb-2 flex items-center justify-between gap-3 border-b border-white/10 pb-2">
            <div>
              <div className="font-mono-tech text-[8px] uppercase tracking-[0.18em] text-zinc-400">{modelName}</div>
              <div className="mt-0.5 font-mono-tech text-[7px] uppercase tracking-wider text-zinc-600">{transmission} · {concept ? "concept simulation" : "manual sequential"}</div>
            </div>
            <div className="flex items-center gap-1.5">
              {concept && <span className="hidden rounded border border-amber-300/25 bg-amber-300/10 px-1.5 py-1 font-mono-tech text-[7px] uppercase tracking-wider text-amber-300 sm:inline">VGT SIM</span>}
              <button type="button" onClick={handleEngineToggle} aria-label={engineRunning ? "Turn engine off" : "Start engine"} className={`pointer-events-auto flex h-7 items-center gap-1 rounded-md border px-2 font-mono-tech text-[7px] uppercase tracking-wider transition ${engineRunning ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : "border-amber-300/35 bg-amber-300/10 text-amber-200 hover:bg-amber-300/20"}`}>
                <Power className="h-3 w-3" />{engineRunning ? "Engine on" : "Start engine"}<kbd className="ml-1 text-[6px] opacity-60">I</kbd>
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-mono-tech text-[7px] uppercase tracking-[0.2em] text-zinc-500">Speed · km/h</div>
              <div className="mt-0.5 flex items-baseline gap-1.5 font-mono-tech font-bold tabular-nums leading-none tracking-tight">
                <span className="text-4xl text-white sm:text-5xl">{String(speed).padStart(3, "0")}</span>
                <span className="text-[10px] font-medium text-zinc-500">/ {topSpeed}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 border-l border-white/10 pl-3">
              <button
                type="button"
                onClick={() => shiftCityGear(-1)}
                aria-label="Downshift (Q)"
                title="Downshift · Q"
                className="pointer-events-auto flex h-10 w-9 flex-col items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] font-mono-tech text-sm leading-none text-zinc-300 transition hover:border-amber-300/60 hover:bg-amber-300/10 hover:text-white active:scale-95"
              ><span>−</span><kbd className="mt-1 text-[7px] text-zinc-500">Q</kbd></button>
              <div className="min-w-12 text-center">
                <div className="font-mono-tech text-[7px] uppercase tracking-[0.18em] text-zinc-500">Gear</div>
                <div className={`font-mono-tech text-4xl font-bold tabular-nums leading-none ${shiftPrompt === "SHIFT UP" ? "text-amber-300" : "text-[#F5C518]"}`}>{gear}</div>
                <div className="font-mono-tech text-[7px] text-zinc-600">{gear === "R" ? "Reverse" : gear === "N" ? "Neutral" : `of ${gearCount}`}</div>
                <div className="mt-1 flex justify-center gap-1">
                  <button type="button" onClick={() => selectCityGear(-1)} aria-label="Select reverse gear (R)" title="Reverse gear · R" className="pointer-events-auto rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono-tech text-[7px] text-zinc-400 hover:border-amber-300/50 hover:text-white">R</button>
                  <button type="button" onClick={() => selectCityGear(0)} aria-label="Select neutral gear (N)" title="Neutral gear · N" className="pointer-events-auto rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono-tech text-[7px] text-zinc-400 hover:border-amber-300/50 hover:text-white">N</button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => shiftCityGear(1)}
                aria-label="Upshift (E)"
                title="Upshift · E"
                className="pointer-events-auto flex h-10 w-9 flex-col items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] font-mono-tech text-sm leading-none text-zinc-300 transition hover:border-amber-300/60 hover:bg-amber-300/10 hover:text-white active:scale-95"
              ><span>+</span><kbd className="mt-1 text-[7px] text-zinc-500">E</kbd></button>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 font-mono-tech text-[8px] uppercase tracking-wider text-zinc-500">
            <span className="tracking-[0.18em]">RPM</span>
            <div className="flex flex-1 items-center gap-[3px]" aria-label={`Engine speed ${rpm} RPM of ${redlineRpm}`}>
              {Array.from({ length: 14 }, (_, index) => {
                const lit = rpm / redlineRpm >= (index + 1) / 14;
                const redZone = index >= 11;
                return <span key={index} className={`h-2 flex-1 rounded-[2px] transition-colors ${lit ? (redZone ? "bg-red-500" : "bg-amber-300") : "bg-white/10"}`} />;
              })}
            </div>
            <span className="min-w-[66px] text-right tabular-nums text-zinc-400">{rpm.toLocaleString()}</span>
          </div>
          <div className="mt-2 flex min-h-4 items-center justify-between font-mono-tech text-[7px] uppercase tracking-wider">
            <span className="text-zinc-600">Redline {redlineRpm.toLocaleString()} rpm</span>
            <span className={shiftFeedback.includes("BLOCKED") ? "text-red-300" : shiftFeedback || shiftPrompt || !engineRunning ? "text-amber-300" : "text-zinc-600"}>{shiftFeedback || (engineRunning ? gear === "N" ? "N · W REV · E DRIVE" : gear === "R" ? "R · W REVERSE" : shiftPrompt || "MANUAL SHIFT READY" : gear === "N" ? "N · PRESS I TO START" : "SELECT N TO START")}</span>
          </div>
        </div>
      </div>

      <div className="absolute left-3 top-24 w-[198px] rounded-xl border border-white/10 bg-[#080d13]/80 p-3 shadow-xl backdrop-blur-lg sm:left-5 sm:top-24 sm:w-[220px]">
        <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-2">
          <span className="font-mono-tech text-[8px] font-semibold uppercase tracking-[0.2em] text-zinc-300">Drive controls</span>
          <span className="font-mono-tech text-[7px] uppercase tracking-wider text-amber-300">Key guide</span>
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
          {[
            ["W / ↑", "Throttle"],
            ["S / ↓", "Brake"],
            ["A / ←", "Steer left"],
            ["D / →", "Steer right"],
            ["Q", "Downshift / N / R"],
            ["E", "Upshift / engage 1st"],
            ["N", "Select neutral"],
            ["R", "Select reverse"],
            ["I", "Engine start / stop"],
            ["SPACE", "Handbrake"],
            ["C", "Camera"],
            ["L", "Headlights"],
            ["ESC", "Exit drive"],
          ].map(([key, action]) => (
            <div key={key} className="flex min-w-0 items-center gap-1.5">
              <kbd className="shrink-0 rounded border border-white/10 bg-black/40 px-1 py-0.5 font-mono-tech text-[7px] text-amber-200">{key}</kbd>
              <span className="truncate font-mono-tech text-[7px] uppercase tracking-wide text-zinc-500">{action}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="pointer-events-auto absolute bottom-4 left-3 flex items-end gap-2 sm:bottom-6 sm:left-6">
        <div className="grid grid-cols-3 items-center gap-1.5 rounded-2xl border border-white/10 bg-black/40 p-2 backdrop-blur-md sm:p-2.5">
          <span />
          <TouchKey input="forward" label="Accelerate"><ArrowUp className="h-5 w-5" /></TouchKey>
          <span />
          <TouchKey input="left" label="Steer left"><ArrowLeft className="h-5 w-5" /></TouchKey>
          <TouchKey input="brake" label="Brake"><ArrowDown className="h-5 w-5" /></TouchKey>
          <TouchKey input="right" label="Steer right"><ArrowRight className="h-5 w-5" /></TouchKey>
        </div>
        <TouchKey input="handbrake" label="Handbrake" wide>HANDBRAKE</TouchKey>
      </div>
    </div>
  );
}

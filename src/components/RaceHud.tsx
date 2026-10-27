// @ts-nocheck
/**
 * Need for Speed style race HUD.
 *
 * Sync strategy: the simulation never touches React. A single `requestAnimation`
 * loop reads `raceTelemetry` and writes straight into the DOM nodes held by
 * refs (textContent / strokeDashoffset / transform), so the speedometer needle
 * runs at display refresh rate while React only re-renders on the rare, coarse
 * events: countdown, lap, finish and pause.
 */
import { Camera, Flag, Gauge, Lightbulb, RotateCcw, Sparkles, Timer, Trophy, Zap } from "lucide-react";
import React from "react";
import { AI_COUNT, formatRaceTime, raceAi, raceDrive, raceTelemetry, restartRace, pauseRace, subscribeRace } from "@/three/raceEngine";
import { SAMPLE_COUNT, sampleX, sampleZ } from "@/three/raceTrack";
import { triggerCrashImpact } from "@/three/raceAudio";
import {
  CAMERA_MODES,
  RACE_MAPS,
  cycleCamera,
  raceSession,
  subscribeRaceSession,
} from "@/three/raceSession";

const R_MAIN = 78;
const R_RPM = 63;
const C_MAIN = 2 * Math.PI * R_MAIN;
const C_RPM = 2 * Math.PI * R_RPM;
const L_MAIN = C_MAIN * 0.75;
const L_RPM = C_RPM * 0.75;
const MAX_KPH = 320;
const SWEEP = 270;
const START_ANGLE = 135;

const TICKS = Array.from({ length: 13 }, (_, index) => {
  const angle = START_ANGLE + (SWEEP * index) / 12;
  const rad = (angle * Math.PI) / 180;
  const major = index % 3 === 0;
  return {
    key: index,
    major,
    x1: 100 + Math.cos(rad) * (major ? 60 : 65),
    y1: 100 + Math.sin(rad) * (major ? 60 : 65),
    x2: 100 + Math.cos(rad) * 70,
    y2: 100 + Math.sin(rad) * 70,
  };
});

const LABELS = [
  { value: 0, angle: START_ANGLE },
  { value: 80, angle: START_ANGLE + SWEEP / 4 },
  { value: 160, angle: START_ANGLE + SWEEP / 2 },
  { value: 240, angle: START_ANGLE + (SWEEP * 3) / 4 },
  { value: 320, angle: START_ANGLE + SWEEP },
];

function ordinal(position: number) {
  if (position === 1) return "1st";
  if (position === 2) return "2nd";
  if (position === 3) return "3rd";
  return `${position}th`;
}

function kphAngle(speedKph: number) {
  const ratio = Math.max(0, Math.min(1, speedKph / MAX_KPH));
  return START_ANGLE + SWEEP * ratio;
}

const MINIMAP_SIZE = 144;
const MINIMAP_PADDING = 15;
const MINIMAP_SAMPLE_STEP = 3;

function buildRaceMinimap() {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const x = sampleX(i);
    const z = sampleZ(i);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  const worldWidth = Math.max(1, maxX - minX);
  const worldDepth = Math.max(1, maxZ - minZ);
  const scale = Math.min(
    (MINIMAP_SIZE - MINIMAP_PADDING * 2) / worldWidth,
    (MINIMAP_SIZE - MINIMAP_PADDING * 2) / worldDepth,
  );
  const offsetX = (MINIMAP_SIZE - worldWidth * scale) * 0.5 - minX * scale;
  const offsetY = (MINIMAP_SIZE - worldDepth * scale) * 0.5 - minZ * scale;
  let path = "";
  for (let i = 0; i < SAMPLE_COUNT; i += MINIMAP_SAMPLE_STEP) {
    const x = (offsetX + sampleX(i) * scale).toFixed(1);
    const y = (offsetY + sampleZ(i) * scale).toFixed(1);
    path += `${i === 0 ? "M" : "L"}${x} ${y} `;
  }
  path += "Z";
  return {
    path,
    scale,
    offsetX,
    offsetY,
    startX: offsetX + sampleX(0) * scale,
    startY: offsetY + sampleZ(0) * scale,
  };
}

export function RaceHud({
  onExit,
  lightsOn,
  bodyGlowOn,
  interiorLightsOn,
  onToggleLights,
  onToggleBodyGlow,
  onToggleInteriorLights,
}: {
  onExit: () => void;
  lightsOn: boolean;
  bodyGlowOn: boolean;
  interiorLightsOn: boolean;
  onToggleLights: () => void;
  onToggleBodyGlow: () => void;
  onToggleInteriorLights: () => void;
}) {
  const speedRef = React.useRef<HTMLSpanElement>(null);
  const gearRef = React.useRef<HTMLSpanElement>(null);
  const rpmRef = React.useRef<HTMLSpanElement>(null);
  const needleRef = React.useRef<SVGGElement>(null);
  const speedArcRef = React.useRef<SVGCircleElement>(null);
  const rpmArcRef = React.useRef<SVGCircleElement>(null);
  const lapRef = React.useRef<HTMLSpanElement>(null);
  const lapTimeRef = React.useRef<HTMLDivElement>(null);
  const bestRef = React.useRef<HTMLSpanElement>(null);
  const totalRef = React.useRef<HTMLSpanElement>(null);
  const nitroRef = React.useRef<HTMLDivElement>(null);
  const nitroWrapRef = React.useRef<HTMLDivElement>(null);
  const nitroLabelRef = React.useRef<HTMLSpanElement>(null);
  const nitroPercentRef = React.useRef<HTMLSpanElement>(null);
  const minimapPlayerRef = React.useRef<SVGGElement>(null);
  const minimapOpponentRefs = React.useRef<SVGGElement[]>([]);
  const positionRef = React.useRef<HTMLSpanElement>(null);
  const progressRef = React.useRef<HTMLDivElement>(null);
  const topSpeedRef = React.useRef<HTMLSpanElement>(null);
  const driftRef = React.useRef<HTMLDivElement>(null);
  const wrongWayRef = React.useRef<HTMLDivElement>(null);
  const sectorRef = React.useRef<HTMLDivElement>(null);

  // Seeded at "3": the HUD mounts in the same tick as the circuit, and the
  // countdown is always a standing start, so the first digit is never missed.
  const [countdown, setCountdown] = React.useState<number | null>(3);
  const [GO, setGO] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const [crashFlash, setCrashFlash] = React.useState(0);
  const [summary, setSummary] = React.useState<any>(null);
  const [paused, setPaused] = React.useState(false);
  const [phase, setPhase] = React.useState("countdown");
  // The camera mount lives in the race-session singleton; this state only
  // keeps the camera button label in sync.
  const [session, setSession] = React.useState({
    mapId: raceSession.mapId,
    camMode: raceSession.camMode,
  });
  const minimap = React.useMemo(() => buildRaceMinimap(), [session.mapId]);
  const selectedMapName = RACE_MAPS.find((map) => map.id === session.mapId)?.name || "Race Circuit";

  React.useEffect(
    () =>
      subscribeRaceSession((next: any) =>
        setSession((previous: any) =>
          previous.mapId === next.mapId && previous.camMode === next.camMode
            ? previous
            : { mapId: next.mapId, camMode: next.camMode },
        ),
      ),
    [],
  );

  React.useEffect(() => {
    let hideGO = 0;
    let hideToast = 0;
    let hideCrash = 0;
    const unsubscribe = subscribeRace((event: any) => {
      if (event.type === "countdown") {
        setCountdown(event.value > 0 ? event.value : null);
        if (event.value === 0) {
          setGO(true);
          window.clearTimeout(hideGO);
          hideGO = window.setTimeout(() => setGO(false), 1100);
        }
      } else if (event.type === "lap") {
        setToast(
          `LAP ${event.lap} · ${formatRaceTime(event.lapTime)}${event.best ? " · BEST LAP" : ""}`,
        );
        window.clearTimeout(hideToast);
        hideToast = window.setTimeout(() => setToast(null), 2400);
      } else if (event.type === "finish") {
        setSummary(event.summary);
      } else if (event.type === "crash") {
        setCrashFlash(event.strength);
        triggerCrashImpact(event.strength);
        window.clearTimeout(hideCrash);
        hideCrash = window.setTimeout(() => setCrashFlash(0), 260);
      } else if (event.type === "phase") {
        setPhase(event.phase);
        setPaused(event.phase === "paused");
        if (event.phase === "countdown") {
          setSummary(null);
          setToast(null);
        }
      }
    });
    return () => {
      unsubscribe();
      window.clearTimeout(hideGO);
      window.clearTimeout(hideToast);
      window.clearTimeout(hideCrash);
    };
  }, []);

  // Single rAF loop, DOM writes only — the canvas is never re-rendered.
  React.useEffect(() => {
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const t = raceTelemetry;
      const speed = t.speedKph;
      if (speedRef.current) speedRef.current.textContent = String(Math.round(speed));
      if (gearRef.current) gearRef.current.textContent = t.gearLabel;
      if (rpmRef.current) rpmRef.current.textContent = `${Math.round(t.rpm / 100) * 100} rpm`;
      if (needleRef.current)
        needleRef.current.setAttribute("transform", `rotate(${kphAngle(speed).toFixed(2)} 100 100)`);
      if (speedArcRef.current)
        speedArcRef.current.setAttribute(
          "stroke-dashoffset",
          (L_MAIN * (1 - Math.min(1, speed / MAX_KPH))).toFixed(2),
        );
      if (rpmArcRef.current) {
        const ratio = Math.max(0, Math.min(1, (t.rpm - 800) / 8000));
        rpmArcRef.current.setAttribute("stroke-dashoffset", (L_RPM * (1 - ratio)).toFixed(2));
        rpmArcRef.current.setAttribute("stroke", t.redline ? "#DC1A22" : "#38BDF8");
      }
      if (lapRef.current) lapRef.current.textContent = `LAP ${t.lap} / ${t.laps}`;
      if (lapTimeRef.current) lapTimeRef.current.textContent = formatRaceTime(t.lapTime);
      if (bestRef.current) bestRef.current.textContent = t.bestLap ? formatRaceTime(t.bestLap) : "--:--.---";
      if (totalRef.current) totalRef.current.textContent = formatRaceTime(t.totalTime);
      if (nitroRef.current) nitroRef.current.style.transform = `scaleY(${t.nitro.toFixed(3)})`;
      if (nitroWrapRef.current) {
        nitroWrapRef.current.setAttribute("aria-valuenow", String(Math.round(t.nitro * 100)));
        nitroWrapRef.current.dataset.active = t.nitroActive ? "1" : "0";
        nitroWrapRef.current.dataset.empty = t.nitro < 0.01 ? "1" : "0";
        nitroWrapRef.current.dataset.charging = !t.turboReady && !t.nitroActive ? "1" : "0";
      }
      if (nitroLabelRef.current)
        nitroLabelRef.current.textContent = t.nitroActive
          ? "BOOST ACTIVE"
          : t.turboReady
            ? "READY · USE Q"
            : t.nitro < 0.01
              ? "DRIVE PRECISELY"
              : "RECHARGING";
      if (nitroPercentRef.current)
        nitroPercentRef.current.textContent = `${Math.round(Math.max(0, Math.min(1, t.nitro)) * 100)}%`;
      if (minimapPlayerRef.current) {
        const x = minimap.offsetX + raceDrive.x * minimap.scale;
        const y = minimap.offsetY + raceDrive.z * minimap.scale;
        const heading = (-raceDrive.heading * 180) / Math.PI;
        minimapPlayerRef.current.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${heading.toFixed(1)})`);
      }
      for (let car = 0; car < AI_COUNT; car++) {
        const marker = minimapOpponentRefs.current[car];
        if (!marker) continue;
        const x = minimap.offsetX + raceAi.x[car] * minimap.scale;
        const y = minimap.offsetY + raceAi.z[car] * minimap.scale;
        const heading = (-raceAi.heading[car] * 180) / Math.PI;
        marker.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${heading.toFixed(1)})`);
      }
      if (positionRef.current) positionRef.current.textContent = ordinal(t.position);
      if (progressRef.current) progressRef.current.style.transform = `scaleY(${Math.min(1, t.progress)})`;
      if (topSpeedRef.current) topSpeedRef.current.textContent = `${Math.round(t.topSpeedKph)} km/h`;
      if (driftRef.current) driftRef.current.style.opacity = String(Math.min(1, t.drift * 0.35));
      if (wrongWayRef.current) wrongWayRef.current.style.opacity = t.wrongWay ? "1" : "0";
      if (sectorRef.current) {
        const dots = sectorRef.current.children;
        for (let i = 0; i < dots.length; i++) {
          const reached = i <= t.checkpoint;
          (dots[i] as HTMLElement).style.background = reached ? "#F5C518" : "rgba(255,255,255,0.16)";
        }
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const resume = () => pauseRace(false);
  const retry = () => {
    setSummary(null);
    restartRace();
  };
  return (
    <div className="fixed inset-0 z-40 pointer-events-none select-none font-display">
      <div
        aria-hidden="true"
        className="absolute inset-0 z-[1] pointer-events-none transition-opacity duration-100"
        style={{
          opacity: Math.min(0.62, crashFlash * 0.58),
          background: "radial-gradient(ellipse at center, transparent 38%, rgba(255,25,18,0.22) 74%, rgba(255,25,18,0.85) 100%)",
        }}
      />
      {/* ---------------------------------------------------------- top left */}
      <div className="absolute top-3 left-3 sm:top-5 sm:left-5 atelier-panel rounded-2xl px-4 py-3 min-w-[190px]">
        <div className="flex items-center gap-2 text-[#F5C518]">
          <Flag className="w-3.5 h-3.5" />
          <span ref={lapRef} className="font-mono-tech text-[11px] uppercase tracking-[0.22em]">
            LAP 1 / 3
          </span>
        </div>
        <div ref={lapTimeRef} className="font-mono-tech text-2xl sm:text-3xl font-semibold text-white tabular-nums leading-tight">
          0:00.000
        </div>
        <div className="mt-0.5 truncate font-mono-tech text-[9px] uppercase tracking-[0.12em] text-zinc-400">
          {selectedMapName}
        </div>
        <div className="mt-1 flex items-center gap-3 text-[10px] font-mono-tech text-zinc-400">
          <span className="flex items-center gap-1">
            <Timer className="w-3 h-3 text-[#38BDF8]" />
            <span ref={totalRef}>0:00.000</span>
          </span>
          <span className="flex items-center gap-1">
            <Trophy className="w-3 h-3 text-[#F5C518]" />
            <span ref={bestRef}>--:--.---</span>
          </span>
        </div>
        <div ref={sectorRef} className="mt-2 flex items-center gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <span key={index} className="w-4 h-[3px] rounded-full bg-white/15 transition-colors" />
          ))}
        </div>
      </div>

      {/* --------------------------------------------------------- top right */}
      <div className="absolute top-3 right-3 sm:top-5 sm:right-5 atelier-panel rounded-2xl px-4 py-3 flex items-center gap-4">
        <div className="text-right">
          <div className="font-mono-tech text-[10px] uppercase tracking-[0.22em] text-zinc-400">Position</div>
          <div className="flex items-baseline justify-end gap-1">
            <span ref={positionRef} className="font-display text-2xl font-bold text-white leading-none">
              1st
            </span>
            <span className="font-mono-tech text-xs text-zinc-400">
              / {raceTelemetry.totalRacers}
            </span>
          </div>
          <div className="mt-1 font-mono-tech text-[10px] text-zinc-400">
            TOP <span ref={topSpeedRef} className="text-zinc-200">0 km/h</span>
          </div>
        </div>
        <div className="relative w-2 h-24 rounded-full bg-white/10 overflow-hidden">
          <div
            ref={progressRef}
            className="absolute inset-x-0 bottom-0 h-full origin-bottom rounded-full bg-gradient-to-t from-[#DC1A22] to-[#F5C518]"
            style={{ transform: "scaleY(0)" }}
          />
        </div>
      </div>

      {/* ------------------------------------------------------ circuit map */}
      <div className="absolute top-[126px] right-3 sm:top-[140px] sm:right-5 w-[136px] sm:w-[160px] atelier-panel rounded-2xl p-2">
        <div className="flex items-center justify-between gap-2 px-1 pb-1">
          <span className="font-mono-tech text-[9px] uppercase tracking-[0.18em] text-zinc-300">Circuit</span>
          <span className="font-mono-tech text-[8px] uppercase tracking-[0.12em] text-zinc-500">MAP</span>
        </div>
        <svg
          viewBox={`0 0 ${MINIMAP_SIZE} ${MINIMAP_SIZE}`}
          role="img"
          aria-label={`${selectedMapName} race map with your car and opponents`}
          className="block w-full aspect-square rounded-xl bg-[#080c14]/90"
        >
          <path d={minimap.path} fill="none" stroke="rgba(0,0,0,0.82)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          <path d={minimap.path} fill="none" stroke="#94A3B8" strokeOpacity="0.78" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d={minimap.path} fill="none" stroke="#E2E8F0" strokeOpacity="0.7" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 3" />
          <circle cx={minimap.startX} cy={minimap.startY} r="3.2" fill="#F5C518" stroke="#111827" strokeWidth="1.3" />
          {Array.from({ length: AI_COUNT }, (_, car) => (
            <g
              key={`opponent-${car}`}
              ref={(node) => {
                if (node) minimapOpponentRefs.current[car] = node;
              }}
              transform={`translate(${minimap.startX} ${minimap.startY})`}
            >
              <circle r="2.5" fill={car === 0 ? "#FB923C" : "#A3E635"} stroke="#111827" strokeWidth="1" />
            </g>
          ))}
          <g
            ref={minimapPlayerRef}
            transform={`translate(${minimap.startX} ${minimap.startY})`}
          >
            <path d="M 0 -6 L 4.3 4 L 0 2.2 L -4.3 4 Z" fill="#F5C518" stroke="#FFF7CC" strokeWidth="1.2" strokeLinejoin="round" />
          </g>
        </svg>
        <div className="mt-1 flex items-center justify-between px-1 font-mono-tech text-[7px] uppercase tracking-[0.1em] text-zinc-500">
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#F5C518]" />YOU</span>
          <span className="max-w-[92px] truncate text-right">{selectedMapName}</span>
        </div>
      </div>

      {/* ----------------------------------------------- camera mount */}
      <div className="absolute top-3 left-1/2 z-50 -translate-x-1/2 sm:top-5 flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={cycleCamera}
          title="Cycle camera view (C)"
          aria-label="Cycle camera view"
          className="atelier-panel rounded-full px-3 py-2 flex items-center gap-2 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-zinc-300 hover:text-white cursor-pointer"
        >
          <Camera className="w-3.5 h-3.5 text-[#38BDF8]" />
          <span>{CAMERA_MODES[session.camMode].label}</span>
          <span className="text-zinc-500">C</span>
        </button>
      </div>

      {/* ----------------------------------------------------------- turbo */}
      <div className="absolute bottom-20 left-3 sm:bottom-24 sm:left-5 w-[82px] sm:w-[92px] atelier-panel rounded-2xl px-2.5 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.48)] flex flex-col items-center">
        <div className="w-full flex items-center justify-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-[#38BDF8]" />
          <span className="font-mono-tech text-[9px] uppercase tracking-[0.16em] text-zinc-300">TURBO</span>
          <kbd className="rounded border border-white/15 bg-white/8 px-1 py-0.5 font-mono-tech text-[9px] text-zinc-200">Q</kbd>
        </div>
        <span ref={nitroPercentRef} className="mt-1 font-mono-tech text-[12px] font-semibold tabular-nums text-white">100%</span>
        <div
          ref={nitroWrapRef}
          role="meter"
          aria-label="Turbo charge"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={100}
          data-active="0"
          data-empty="0"
          className="race-turbo relative mt-1 h-[92px] w-7 rounded-full overflow-hidden bg-white/8 border border-white/12"
        >
          <div
            ref={nitroRef}
            className="absolute inset-x-0 bottom-0 h-full origin-bottom rounded-full bg-gradient-to-t from-[#1D4ED8] via-[#38BDF8] to-[#A5F3FC]"
            style={{ transform: "scaleY(1)" }}
          />
        </div>
        <span ref={nitroLabelRef} className="mt-1.5 w-full text-center font-mono-tech text-[8px] leading-tight uppercase tracking-[0.08em] text-[#7DD3FC]">READY · USE Q</span>
      </div>

      {/* -------------------------------------------------------- speedometer */}
      <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4">
        <div className="relative w-[180px] h-[180px] sm:w-[214px] sm:h-[214px]">
          <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-[0_8px_28px_rgba(0,0,0,0.65)]">
            <circle cx="100" cy="100" r="94" fill="rgba(8,10,14,0.62)" stroke="rgba(255,255,255,0.1)" />
            <circle
              cx="100"
              cy="100"
              r={R_MAIN}
              fill="none"
              stroke="rgba(255,255,255,0.09)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${L_MAIN} ${C_MAIN}`}
              transform={`rotate(${START_ANGLE} 100 100)`}
            />
            <circle
              ref={speedArcRef}
              cx="100"
              cy="100"
              r={R_MAIN}
              fill="none"
              stroke="#F5C518"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${L_MAIN} ${C_MAIN}`}
              strokeDashoffset={L_MAIN}
              transform={`rotate(${START_ANGLE} 100 100)`}
            />
            <circle
              cx="100"
              cy="100"
              r={R_RPM}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${L_RPM} ${C_RPM}`}
              transform={`rotate(${START_ANGLE} 100 100)`}
            />
            <circle
              ref={rpmArcRef}
              cx="100"
              cy="100"
              r={R_RPM}
              fill="none"
              stroke="#38BDF8"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${L_RPM} ${C_RPM}`}
              strokeDashoffset={L_RPM}
              transform={`rotate(${START_ANGLE} 100 100)`}
            />
            {TICKS.map((tick) => (
              <line
                key={tick.key}
                x1={tick.x1}
                y1={tick.y1}
                x2={tick.x2}
                y2={tick.y2}
                stroke={tick.major ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.24)"}
                strokeWidth={tick.major ? 2 : 1}
              />
            ))}
            {LABELS.map((label) => {
              const rad = (label.angle * Math.PI) / 180;
              return (
                <text
                  key={label.value}
                  x={100 + Math.cos(rad) * 46}
                  y={100 + Math.sin(rad) * 46 + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fill="rgba(255,255,255,0.5)"
                  fontFamily="JetBrains Mono, Consolas, monospace"
                >
                  {label.value}
                </text>
              );
            })}
            <g ref={needleRef} transform={`rotate(${START_ANGLE} 100 100)`}>
              <line x1="100" y1="100" x2="100" y2="30" stroke="#DC1A22" strokeWidth="3.2" strokeLinecap="round" />
              <line x1="100" y1="100" x2="100" y2="118" stroke="#DC1A22" strokeWidth="2" strokeLinecap="round" />
            </g>
            <circle cx="100" cy="100" r="7" fill="#0b0d12" stroke="rgba(255,255,255,0.35)" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-7 pointer-events-none">
            <div className="flex items-baseline gap-1">
              <span ref={speedRef} className="font-mono-tech text-3xl sm:text-4xl font-semibold text-white tabular-nums">
                0
              </span>
              <span className="font-mono-tech text-[10px] text-zinc-400">km/h</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="font-mono-tech text-[10px] text-zinc-500 uppercase tracking-[0.18em]">GEAR</span>
              <span ref={gearRef} className="font-mono-tech text-xl font-bold text-[#F5C518] leading-none">
                N
              </span>
            </div>
            <span ref={rpmRef} className="mt-0.5 font-mono-tech text-[10px] text-zinc-500">
              800 rpm
            </span>
          </div>
          <div ref={driftRef} className="absolute left-1/2 -translate-x-1/2 bottom-0 font-mono-tech text-[10px] uppercase tracking-[0.3em] text-[#38BDF8] opacity-0 transition-opacity">
            Drift
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------- centre fx */}
      <div className="absolute inset-x-0 top-[26%] flex flex-col items-center gap-3 pointer-events-none">
        {countdown !== null && (
          <div key={countdown} className="race-count font-display text-[92px] sm:text-[128px] font-black leading-none text-white drop-shadow-[0_0_40px_rgba(220,26,34,0.65)]">
            {countdown}
          </div>
        )}
        {GO && (
          <div className="race-count font-display text-[76px] sm:text-[104px] font-black leading-none text-[#4ADE80] drop-shadow-[0_0_46px_rgba(74,222,128,0.7)]">
            GO!
          </div>
        )}
        {toast && (
          <div className="race-toast atelier-pill px-5 py-2 rounded-full font-mono-tech text-xs uppercase tracking-[0.22em] text-white">
            {toast}
          </div>
        )}
      </div>

      <div
        ref={wrongWayRef}
        className="absolute left-1/2 -translate-x-1/2 top-[15%] opacity-0 transition-opacity duration-300"
      >
        <div className="race-wrongway atelier-pill px-5 py-2 rounded-xl font-display text-lg font-bold uppercase tracking-[0.3em]">
          Wrong Way
        </div>
      </div>

      {phase === "racing" && (
        <div className="absolute bottom-2 left-1/2 z-50 -translate-x-1/2 w-max max-w-[calc(100vw-1rem)] pointer-events-auto">
          <div className="atelier-pill rounded-2xl p-1.5 flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3">
            <span className="px-1 font-mono-tech text-[9px] sm:text-[10px] uppercase tracking-[0.12em] text-zinc-400 text-center">
              <span className="sm:hidden">W/S · A/D · SHIFT · Q · SPACE · C · ESC</span>
              <span className="hidden sm:inline">W / S throttle · A / D steer · SHIFT drift · Q turbo · SPACE brake · C camera · ESC pause</span>
            </span>
            <div className="flex items-center justify-center gap-1 sm:gap-1.5">
              <button
                type="button"
                onClick={onToggleLights}
                aria-pressed={lightsOn}
                aria-label={`Turn headlights ${lightsOn ? "off" : "on"}`}
                title={`Headlights ${lightsOn ? "on" : "off"} · press L`}
                className={`atelier-panel rounded-full px-2 py-1.5 flex items-center gap-1.5 font-mono-tech text-[9px] uppercase tracking-[0.1em] cursor-pointer transition-colors ${lightsOn ? "text-[#F5C518]" : "text-zinc-400 hover:text-white"}`}
              >
                <Lightbulb className="w-3.5 h-3.5" />
                <span>Lights</span>
                <kbd className="rounded bg-white/10 px-1 py-0.5 text-[9px] text-zinc-300">L</kbd>
              </button>
              <button
                type="button"
                onClick={onToggleBodyGlow}
                aria-pressed={bodyGlowOn}
                aria-label={`Turn body glow ${bodyGlowOn ? "off" : "on"}`}
                title={`Body underglow ${bodyGlowOn ? "on" : "off"} · press B`}
                className={`atelier-panel rounded-full px-2 py-1.5 flex items-center gap-1.5 font-mono-tech text-[9px] uppercase tracking-[0.1em] cursor-pointer transition-colors ${bodyGlowOn ? "text-[#F19BFF]" : "text-zinc-400 hover:text-white"}`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Body</span>
                <kbd className="rounded bg-white/10 px-1 py-0.5 text-[9px] text-zinc-300">B</kbd>
              </button>
              <button
                type="button"
                onClick={onToggleInteriorLights}
                aria-pressed={interiorLightsOn}
                aria-label={`Turn interior lights ${interiorLightsOn ? "off" : "on"}`}
                title={`Cabin ambience ${interiorLightsOn ? "on" : "off"} · press I`}
                className={`atelier-panel rounded-full px-2 py-1.5 flex items-center gap-1.5 font-mono-tech text-[9px] uppercase tracking-[0.1em] cursor-pointer transition-colors ${interiorLightsOn ? "text-[#A78BFA]" : "text-zinc-400 hover:text-white"}`}
              >
                <Lightbulb className="w-3.5 h-3.5" />
                <span>Cabin</span>
                <kbd className="rounded bg-white/10 px-1 py-0.5 text-[9px] text-zinc-300">I</kbd>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ pause */}
      {paused && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
          <div className="atelier-panel rounded-3xl px-8 py-7 w-[320px] text-center">
            <Gauge className="w-7 h-7 text-[#F5C518] mx-auto" />
            <h2 className="mt-3 font-display text-xl font-bold text-white uppercase tracking-[0.18em]">Paused</h2>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={resume}
                className="w-full rounded-xl bg-[#DC1A22] px-4 py-2.5 font-mono-tech text-[11px] uppercase tracking-[0.2em] text-white hover:bg-[#b9151c] cursor-pointer"
              >
                Resume Race
              </button>
              <button
                type="button"
                onClick={retry}
                className="w-full rounded-xl bg-white/10 px-4 py-2.5 font-mono-tech text-[11px] uppercase tracking-[0.2em] text-zinc-200 hover:bg-white/16 cursor-pointer"
              >
                Restart
              </button>
              <button
                type="button"
                onClick={onExit}
                className="w-full rounded-xl bg-white/5 px-4 py-2.5 font-mono-tech text-[11px] uppercase tracking-[0.2em] text-zinc-300 hover:bg-white/12 cursor-pointer"
              >
                Exit To Showroom
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- finish */}
      {summary && (
        <div className="absolute inset-0 bg-black/78 backdrop-blur-md flex items-center justify-center pointer-events-auto px-4">
          <div className="atelier-panel rounded-3xl w-full max-w-[520px] px-6 py-6">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-[#F5C518]" />
              <div>
                <h2 className="font-display text-2xl font-black uppercase tracking-[0.14em] text-white">
                  Race Complete
                </h2>
                <p className="font-mono-tech text-[10px] uppercase tracking-[0.22em] text-zinc-400">
                  {summary.laps} laps · {formatRaceTime(summary.totalTime)} total
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/6 px-4 py-3">
                <div className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-zinc-400">Best Lap</div>
                <div className="font-mono-tech text-lg text-[#4ADE80]">{formatRaceTime(summary.bestLap)}</div>
              </div>
              <div className="rounded-2xl bg-white/6 px-4 py-3">
                <div className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-zinc-400">Top Speed</div>
                <div className="font-mono-tech text-lg text-[#F5C518]">
                  {Math.round(summary.topSpeedKph)} km/h
                </div>
              </div>
            </div>
            <div className="mt-3 rounded-2xl bg-white/4 px-4 py-3">
              {summary.lapTimes.map((time: number, index: number) => (
                <div key={index} className="flex items-center justify-between py-1 border-b border-white/6 last:border-0">
                  <span className="font-mono-tech text-[11px] uppercase tracking-[0.2em] text-zinc-400">
                    Lap {index + 1}
                  </span>
                  <span
                    className={`font-mono-tech text-sm ${time === summary.bestLap ? "text-[#4ADE80]" : "text-zinc-100"}`}
                  >
                    {formatRaceTime(time)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={retry}
                className="flex-1 rounded-xl bg-[#DC1A22] px-4 py-3 font-mono-tech text-[11px] uppercase tracking-[0.2em] text-white hover:bg-[#b9151c] cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Race Again
              </button>
              <button
                type="button"
                onClick={onExit}
                className="flex-1 rounded-xl bg-white/8 px-4 py-3 font-mono-tech text-[11px] uppercase tracking-[0.2em] text-zinc-200 hover:bg-white/14 cursor-pointer"
              >
                Back To Showroom
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

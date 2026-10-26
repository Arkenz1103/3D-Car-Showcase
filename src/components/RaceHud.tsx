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
import { Camera, CloudRain, Flag, Gauge, Moon, RotateCcw, Sun, Timer, Trophy, Zap } from "lucide-react";
import React from "react";
import { formatRaceTime, raceTelemetry, restartRace, pauseRace, subscribeRace } from "@/three/raceEngine";
import {
  CAMERA_MODES,
  ENVIRONMENTS,
  cycleCamera,
  raceSession,
  setEnvironment,
  subscribeRaceSession,
} from "@/three/raceSession";

const WEATHER_ICONS = [Sun, Moon, CloudRain];

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

export function RaceHud({ onExit }: { onExit: () => void }) {
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
  const [summary, setSummary] = React.useState<any>(null);
  const [paused, setPaused] = React.useState(false);
  const [phase, setPhase] = React.useState("countdown");
  // Weather + camera mount live in a module singleton read by `useFrame`; this
  // state exists purely to highlight the active chips.
  const [session, setSession] = React.useState({
    envIndex: raceSession.envIndex,
    camMode: raceSession.camMode,
  });

  React.useEffect(
    () =>
      subscribeRaceSession((next: any) =>
        setSession((previous: any) =>
          previous.envIndex === next.envIndex && previous.camMode === next.camMode
            ? previous
            : { envIndex: next.envIndex, camMode: next.camMode },
        ),
      ),
    [],
  );

  React.useEffect(() => {
    let hideGO = 0;
    let hideToast = 0;
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
      if (nitroRef.current) nitroRef.current.style.transform = `scaleX(${t.nitro.toFixed(3)})`;
      if (nitroWrapRef.current) {
        nitroWrapRef.current.dataset.active = t.nitroActive ? "1" : "0";
        nitroWrapRef.current.dataset.empty = t.nitro < 0.15 ? "1" : "0";
        // Locked = the bottle ran dry and is still on its cooldown.
        nitroWrapRef.current.dataset.locked = t.nitroLocked ? "1" : "0";
      }
      if (nitroLabelRef.current)
        nitroLabelRef.current.textContent = t.nitroLocked
          ? `COOL ${Math.ceil(t.nitroCooldown)}s`
          : t.nitroActive
            ? "BOOST"
            : "NITRO";
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

      {/* ------------------------------------------- weather + camera mount */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 hidden sm:flex items-center gap-2 pointer-events-auto">
        <div className="atelier-panel rounded-full p-1 flex items-center gap-1">
          {ENVIRONMENTS.map((env: any, index: number) => {
            const Icon = WEATHER_ICONS[index] || Sun;
            const active = session.envIndex === index;
            return (
              <button
                key={env.id}
                type="button"
                onClick={() => setEnvironment(index)}
                title={`${env.label} preset (E)`}
                aria-label={`${env.label} preset`}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.18em] cursor-pointer transition-colors ${
                  active ? "bg-[#F5C518] text-black" : "text-zinc-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{env.label}</span>
              </button>
            );
          })}
        </div>
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

      {/* ----------------------------------------------------------- nitro */}
      <div className="absolute bottom-4 left-3 sm:bottom-6 sm:left-5 w-[190px] sm:w-[240px]">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.22em] text-zinc-400 flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-[#38BDF8]" />
            <span ref={nitroLabelRef}>NITRO</span>
          </span>
          <span className="font-mono-tech text-[9px] uppercase tracking-[0.16em] text-zinc-500">SHIFT</span>
        </div>
        <div
          ref={nitroWrapRef}
          data-active="0"
          data-empty="0"
          className="race-nitro relative h-3 rounded-full overflow-hidden bg-white/8 border border-white/12"
        >
          <div
            ref={nitroRef}
            className="absolute inset-0 origin-left rounded-full bg-gradient-to-r from-[#1D4ED8] via-[#38BDF8] to-[#A5F3FC]"
            style={{ transform: "scaleX(1)" }}
          />
        </div>
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
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 atelier-pill px-4 py-1.5 rounded-full font-mono-tech text-[10px] uppercase tracking-[0.18em] text-zinc-400 hidden sm:block">
          W / S throttle · A / D steer · SHIFT nitro · SPACE handbrake · C camera · E weather · R recover · ESC pause
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

// @ts-nocheck
import {
  CALIPER_SWATCHES,
  CAMERA_PRESETS,
  CARS,
  COMPONENT_SPECS,
  INTERIOR_SWATCHES,
  PAINT_COLORS,
  PAINT_FINISHES,
  STUDIO_THEMES,
  WHEEL_SWATCHES,
  getCarById,
  getComponentSpec,
} from "@/data/catalog";
import { loadVehicleAsset } from "@/lib/gltf";
import { RaceHud } from "@/components/RaceHud";
import { LiftDirector } from "@/three/LiftDirector";
import { RaceCircuit } from "@/three/RaceCircuit";
import { RaceOpponents } from "@/three/RaceOpponents";
import { disposeAudio, initAudio, resumeAudio } from "@/three/raceAudio";
import { NitroPlumes, RaceDirector, RaceSunlight, RaceVehicleRig } from "@/three/RaceDirector";
import { RenderCoordinator } from "@/three/RenderCoordinator";
import { orientCameraGoal } from "@/three/cameraFraming";
import { liftTimeline } from "@/three/liftTimeline";
import { CameraRig, Showroom } from "@/three/Showroom";
import { VehicleModel } from "@/three/VehicleModel";
import { AtelierPanel } from "@/ui/AtelierPanel";
import { ComponentDetailPanel } from "@/ui/ComponentDetailPanel";
import { LiftStatus } from "@/ui/LiftStatus";
import { Canvas } from "@react-three/fiber";
import {
  Box,
  ChevronsUp,
  CircleAlert,
  Compass,
  Eye,
  EyeOff,
  Flag,
  Lightbulb,
  Maximize2,
  MousePointerClick,
  Palette,
  RotateCw,
  SlidersVertical,
  Upload,
  Wind,
} from "lucide-react";
import React from "react";
import { ACESFilmicToneMapping } from "three";

const CANVAS_CAMERA = {
  position: CAMERA_PRESETS[0].position,
  fov: CAMERA_PRESETS[0].fov,
  near: 0.08,
  far: 60,
};
const CANVAS_GL = {
  antialias: true,
  toneMapping: ACESFilmicToneMapping,
  toneMappingExposure: 1.08,
  powerPreference: "high-performance",
};

export function App() {
  const [Q, A] = React.useState("sf90"),
    g = getCarById(Q),
    [I, C] = React.useState(null),
    [E, e] = React.useState(0),
    [o, l] = React.useState(!0),
    [M, n] = React.useState(null),
    [r, h] = React.useState(!1),
    [V, P] = React.useState(null),
    [y, j] = React.useState(null),
    [u, K] = React.useState([]),
    [U, p] = React.useState("hero"),
    [G, q] = React.useState({
      position: CAMERA_PRESETS[0].position,
      target: CAMERA_PRESETS[0].target,
      fov: CAMERA_PRESETS[0].fov,
      interior: false,
      overview: true,
      seq: 1,
    }),
    [N, W] = React.useState(!1),
    [m, X] = React.useState(PAINT_COLORS[0].hex),
    [L, gA] = React.useState(PAINT_FINISHES[0]),
    [QA, AA] = React.useState(WHEEL_SWATCHES[0]),
    [CA, R] = React.useState(CALIPER_SWATCHES[0]),
    [z, IA] = React.useState(INTERIOR_SWATCHES[0]),
    [iA, DA] = React.useState(!1),
    [H, wA] = React.useState(STUDIO_THEMES[0]),
    [BA, MA] = React.useState("solid"),
    [WA, JA] = React.useState("qualify"),
    [nA, rA] = React.useState(!1),
    [kA, og] = React.useState(!1),
    [$A, Ug] = React.useState(!1),
    [Tg, XA] = React.useState(!0),
    [hA, vA] = React.useState(!1),
    [HA, lg] = React.useState(-10),
    [Wg, yg] = React.useState(!0),
    [Mg, mg] = React.useState(!1),
    [tA, eg] = React.useState("garage"),
    [zg, $] = React.useState(!1),
    [raceMode, setRaceMode] = React.useState(!1);
  const requestSequence = React.useRef(0);
  const commitAsset = React.useCallback((asset, car) => {
    React.startTransition(() => {
      C(asset);
      e((sequence) => sequence + 1);
      P(null);
      j(null);
      W(false);
      p("hero");
      MA("solid");
      if (car) X(car.defaultPaintHex);
      q((previous) => ({ ...CAMERA_PRESETS[0], interior: false, seq: previous.seq + 1 }));
      n(null);
      l(false);
    });
  }, []);

  React.useEffect(() => {
    const request = ++requestSequence.current;
    const car = getCarById(Q);
    l(true);
    loadVehicleAsset(null, null, car)
      .then((asset) => {
        if (request === requestSequence.current) commitAsset(asset, car);
      })
      .catch((error) => {
        if (request === requestSequence.current) {
          n(error instanceof Error ? error.message : "Could not load this car.");
          l(false);
        }
      });
    return () => {
      if (request === requestSequence.current) requestSequence.current++;
    };
  }, [Q, commitAsset]);
  const T = React.useMemo(() => (V ? getComponentSpec(g, V) : null), [V, g]),
    YA = React.useMemo(() => (y ? getComponentSpec(g, y.componentId) : null), [y, g]),
    SA = React.useCallback(
      (x) => {
        if (x === Q) return;
        liftTimeline.pauseShowcase();
        A(x);
        P(null);
        j(null);
        W(false);
      },
      [Q],
    );
  React.useEffect(() => {
    window.innerWidth >= 1180 && mg(!0);
  }, []);
  const KA = React.useCallback((x) => {
      const preset = CAMERA_PRESETS.find((item) => item.id === x);
      if (!preset) return;
      liftTimeline.pauseShowcase();
      P(null);
      j(null);
      p(preset.id);
      W(false);
      q((previous) => ({
        ...orientCameraGoal(preset, liftTimeline.yaw),
        interior: !!preset.interior,
        seq: previous.seq + 1,
      }));
    }, []),
    Eg = React.useCallback(
      (x, cA) => {
        if (!COMPONENT_SPECS[x]) return;
        (P(x), p(""), W(!1), liftTimeline.pauseShowcase());
        const yA = COMPONENT_SPECS[x];
        if (
          (x === "hybrid_system" && g.isSF90Reference && MA((tg) => (tg === "solid" ? "xray" : tg)),
          !cA && !g.isSF90Reference)
        ) {
          const tg = u.filter((mA) => mA.componentId === x);
          if (tg.length) {
            const mA = tg.reduce(
                (sA, Yg) => [
                  sA[0] + Yg.center[0] / tg.length,
                  sA[1] + Yg.center[1] / tg.length,
                  sA[2] + Yg.center[2] / tg.length,
                ],
                [0, 0, 0],
              ),
              bg = Math.max(
                ...tg.map(
                  (sA) =>
                    sA.radius + Math.hypot(sA.center[0] - mA[0], sA.center[1] - mA[1], sA.center[2] - mA[2]),
                ),
              );
            cA = {
              target: orientCameraGoal({ position: mA, target: mA, fov: 35 }, liftTimeline.yaw).target,
              radius: Math.min(bg, 2.6),
            };
          }
        }
        if (cA) {
          const [tg, mA, bg] = cA.target,
            sA = Math.max(cA.radius * 2.4, 1.35),
            Yg = tg >= 0 ? 1 : -1,
            zA = bg >= 0 ? 1 : -1;
          q((ng) => ({
            position: [tg + Yg * sA * 0.72, Math.max(mA + sA * 0.42, 0.35), bg + zA * sA * 0.72],
            target: [tg, mA, bg],
            fov: 35,
            interior: !!yA.camera.interior,
            seq: ng.seq + 1,
          }));
        } else
          q((tg) => ({
            ...orientCameraGoal(yA.camera, liftTimeline.yaw),
            interior: !!yA.camera.interior,
            seq: tg.seq + 1,
          }));
        window.innerWidth < 960 && mg(!1);
      },
      [g.isSF90Reference, u],
    ),
    runAssetRequest = React.useCallback(
      async (load, car = null) => {
        const request = ++requestSequence.current;
        l(true);
        n(null);
        liftTimeline.pauseShowcase();
        try {
          const asset = await load();
          if (request === requestSequence.current) commitAsset(asset, car);
        } catch (error) {
          if (request === requestSequence.current) {
            n(error instanceof Error ? error.message : "Could not load the model.");
            l(false);
          }
        }
      },
      [commitAsset],
    ),
    xA = React.useCallback(
      (file) =>
        runAssetRequest(async () =>
          loadVehicleAsset({ buffer: await file.arrayBuffer(), name: file.name }, null),
        ),
      [runAssetRequest],
    ),
    RA = React.useCallback((url) => runAssetRequest(() => loadVehicleAsset(null, url)), [runAssetRequest]),
    fA = React.useCallback(() => {
      const car = getCarById(Q);
      return runAssetRequest(() => loadVehicleAsset(null, null, car), car);
    }, [Q, runAssetRequest]);
  const replayEntrance = React.useCallback(() => {
    if (!I || o) return;
    P(null);
    W(false);
    p("hero");
    q((previous) => ({ ...CAMERA_PRESETS[0], interior: false, seq: previous.seq + 1 }));
    e((sequence) => sequence + 1);
  }, [I, o]);
  const userCameraInteraction = React.useCallback(() => {
    W(false);
    p("");
    liftTimeline.pauseShowcase();
  }, []);
  // Race mode swaps the showroom for the circuit and hands the car to <RaceDirector/>.
  const enterRace = React.useCallback(() => {
    if (!I || o) return;
    // The click IS the gesture browser autoplay policies want: build the whole
    // WebAudio graph here, not lazily inside the frame loop.
    initAudio();
    liftTimeline.pauseShowcase();
    P(null);
    j(null);
    W(false);
    n(null);
    mg(!1);
    setRaceMode(!0);
  }, [I, o]);
  const exitRace = React.useCallback(() => {
    // No entrance replay: the timeline stays parked where it was.
    liftTimeline.pauseShowcase();
    // Tear the graph down so nothing keeps running (or holding the audio
    // device) while the showroom is on screen.
    disposeAudio();
    setRaceMode(!1);
  }, []);
  // Browsers suspend the context when the tab is backgrounded; re-arm it on the
  // way back so the engine note returns with the race.
  React.useEffect(() => {
    if (!raceMode) return;
    const onVisibility = () => {
      if (!document.hidden) resumeAudio();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [raceMode]);
  const toggleOrbit = React.useCallback(() => {
    liftTimeline.pauseShowcase();
    if (G.interior) {
      KA("hero");
      W(true);
    } else W((value) => !value);
  }, [G.interior, KA]);
  const clearSelection = React.useCallback((event) => {
    if (event.type === "click") P(null);
  }, []);
  React.useEffect(() => {
    const x = (cA) => {
      // Race mode owns the keyboard: <RaceDirector/> reads WASD/Shift/Space and
      // these showroom shortcuts would fight it.
      if (raceMode) return;
      if (
        cA.repeat ||
        cA.ctrlKey ||
        cA.metaKey ||
        cA.altKey ||
        cA.target.closest?.("input, textarea, select, [contenteditable=true]")
      )
        return;
      if (!(cA.target instanceof HTMLInputElement || cA.target instanceof HTMLTextAreaElement))
        if (cA.key >= "1" && cA.key <= "8") {
          const yA = CAMERA_PRESETS[Number(cA.key) - 1];
          yA && KA(yA.id);
        } else
          cA.key.toLowerCase() === "x"
            ? MA((yA) => (yA === "xray" ? "solid" : "xray"))
            : cA.key.toLowerCase() === "g"
              ? rA((yA) => !yA)
              : cA.key.toLowerCase() === "h"
                ? $((yA) => !yA)
                : cA.key.toLowerCase() === "l"
                  ? XA((yA) => !yA)
                  : cA.key.toLowerCase() === "r"
                    ? replayEntrance()
                    : cA.key === "Escape" && (P(null), G.interior && KA("hero"));
    };
    return (window.addEventListener("keydown", x), () => window.removeEventListener("keydown", x));
  }, [KA, G.interior, replayEntrance, raceMode]);
  const wg = (x) => {
    Mg && tA === x ? mg(!1) : (eg(x), mg(!0));
  };
  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-[#060709] select-none"
      onDragOver={(x) => {
        (x.preventDefault(), h(!0));
      }}
      onDragLeave={(x) => {
        x.currentTarget.contains(x.relatedTarget) || h(!1);
      }}
      onDrop={(x) => {
        (x.preventDefault(), h(!1));
        const cA = x.dataTransfer.files?.[0];
        cA && /\.(glb|gltf)$/i.test(cA.name)
          ? xA(cA)
          : cA && n("Please drop a valid binary .glb or .gltf 3D model file.");
      }}
    >
      <Canvas
        frameloop="demand"
        shadows={!0}
        dpr={1.2}
        gl={CANVAS_GL}
        camera={CANVAS_CAMERA}
        onPointerMissed={clearSelection}
      >
        <RenderCoordinator />
        {/* Circuit fixtures are mounted only while racing. Their geometry,
            textures and instance tables are built once per session and cached,
            so re-entering race mode is free. */}
        {raceMode && (
          <>
            <RaceCircuit />
            <RaceOpponents />
            <RaceSunlight />
            <RaceDirector />
            <NitroPlumes />
          </>
        )}
        {/* The rig wraps the car in BOTH modes. In the showroom it stays an
            identity transform, so switching modes re-parents without remounting
            the GLB, its shader programs or its textures. */}
        {I && (
          <RaceVehicleRig>
            <VehicleModel
              asset={I}
              selectedComponent={V}
              entranceSeq={E}
              onSelectComponent={Eg}
              onHoverTelemetry={j}
              onMeshInventoryReady={K}
              paintHex={m}
              paintFinish={L}
              caliperSwatch={CA}
              wheelSwatch={QA}
              interiorSwatch={z}
              matteCarbon={iA}
              headlightsOn={Tg}
              brakeLightsOn={hA}
              highDownforceGurney={nA}
              rollingRoad={$A}
              steeringAngleDeg={HA}
              technicalView={BA}
              powerMode={WA}
              showHotspotPins={Wg && !zg && !G.interior && !raceMode}
            />
          </RaceVehicleRig>
        )}
        {!raceMode && (
          <>
            <LiftDirector entranceSeq={E} />
            <Showroom theme={H} showAeroStreamlines={kA} highDownforceGurney={nA} rollingRoad={$A} />
            <CameraRig goal={G} autoOrbit={N} onUserInteract={userCameraInteraction} />
          </>
        )}
      </Canvas>
      <div
        className="pointer-events-none fixed inset-0 z-10"
        style={{
          background: "radial-gradient(circle at 50% 48%, rgba(6,7,9,0) 58%, rgba(4,5,7,0.55) 100%)",
          contain: "strict",
        }}
      />
      {/* Race overlay. It reads the simulation through refs + a subscription, so
          the 60 fps numbers never re-render React or the canvas. */}
      {raceMode && <RaceHud onExit={exitRace} />}
      {o && !I && (
        <div className="fixed inset-0 z-50 bg-[#060709]/97 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="w-48 h-[2px] bg-white/10 rounded-full overflow-hidden">
            <div className="w-1/2 h-full bg-[#DC1A22] animate-pulse" />
          </div>
          <div className="space-y-1">
            <div className="font-mono-tech text-[11px] uppercase tracking-[0.25em] text-[#F5C518]">
              Maranello Digital Atelier
            </div>
            <div className="font-display text-lg text-white font-medium">
              Initializing 3D GLTF 2.0 Showroom & PBR Shaders
            </div>
          </div>
        </div>
      )}
      {o && I && (
        <div
          className="loading-car-notice atelier-pill fixed top-24 left-1/2 -translate-x-1/2 z-40 rounded-xl px-4 py-2 text-xs text-zinc-200 pointer-events-none"
          role="status"
        >
          Preparing the next car. Your current view stays available.
        </div>
      )}
      {r && (
        <div className="fixed inset-4 z-50 rounded-3xl border-2 border-dashed border-[#F5C518] bg-black/92 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <Upload className="w-10 h-10 text-[#F5C518]" />
          <div className="font-display text-xl text-white font-semibold">
            Drop Custom Ferrari SF90 Stradale .GLB / .GLTF Model
          </div>
          <div className="font-mono-tech text-xs text-zinc-400">
            Auto-normalizes scale, ground plane, PBR clearcoat materials & interactive raycasting
          </div>
        </div>
      )}
      {M && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 atelier-panel border-[#DC1A22]/60 px-4 py-2.5 rounded-xl flex items-center gap-2.5 text-xs text-red-200 max-w-md">
          <CircleAlert className="w-4 h-4 text-[#DC1A22] shrink-0" />
          <span>{M}</span>
          <button
            type="button"
            onClick={() => n(null)}
            className="ml-2 font-mono-tech text-[10px] uppercase text-white underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}
      {!zg && !raceMode && (
        <header className="fixed top-0 inset-x-0 z-30 px-3 sm:px-5 py-3 flex items-center justify-between gap-3 pointer-events-none">
          <div className="pointer-events-auto min-w-0 flex items-center gap-3 atelier-pill px-3.5 py-2 rounded-2xl">
            <div className="flex flex-col gap-[2px] w-1">
              <span className="h-2 bg-[#009246] rounded-full" />
              <span className="h-2 bg-white rounded-full" />
              <span className="h-2 bg-[#CE2B37] rounded-full" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-sm sm:text-base font-bold tracking-tight text-white uppercase truncate">
                  {g.brand} {g.model}
                </h1>
                <span
                  className="hidden xl:inline-block font-mono-tech text-[10px] px-1.5 py-0.5 rounded border"
                  style={{
                    backgroundColor: `${g.accentHex}22`,
                    color: g.accentHex,
                    borderColor: `${g.accentHex}66`,
                  }}
                >
                  {g.year}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono-tech text-zinc-400">
                <span className="truncate max-w-[180px] sm:max-w-none">{g.tagline}</span>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => wg("asset")}
                  className="text-[#F5C518] hover:underline cursor-pointer truncate max-w-[205px] sm:max-w-none"
                  title="Inspect 3D GLB Asset Provenance or Hot-Swap .GLB File"
                >
                  {I?.isBundledReference
                    ? `REF GLB (${I.meshCount} Meshes · Replaceable)`
                    : `CUSTOM GLB (${I?.meshCount ?? 0} Meshes)`}
                </button>
              </div>
            </div>
          </div>
          <div className="hidden 2xl:flex items-center gap-1 atelier-pill p-1 rounded-2xl pointer-events-auto">
            {CARS.map((x) => {
              const cA = x.id === Q;
              return (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => SA(x.id)}
                  disabled={o}
                  className={`px-3 py-1.5 rounded-xl text-left transition-all cursor-pointer disabled:opacity-60 ${cA ? "bg-white text-black shadow" : "text-zinc-300 hover:text-white hover:bg-white/8"}`}
                >
                  <div className="font-mono-tech text-[9px] uppercase tracking-[0.16em] opacity-70">
                    {x.brand}
                  </div>
                  <div className="font-display text-xs font-semibold leading-tight whitespace-nowrap">
                    {x.shortTitle}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="pointer-events-auto shrink-0 flex items-center gap-1.5">
            <button
              type="button"
              onClick={enterRace}
              disabled={o || !I}
              className="atelier-pill px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 border-[#DC1A22]/60 text-white bg-[#DC1A22]/20 hover:bg-[#DC1A22]/35"
              title="Enter Race Mode — Drive the Circuit [WASD · Shift Nitro · Space Handbrake]"
            >
              <Flag className="w-3.5 h-3.5 text-[#DC1A22]" />
              <span className="font-mono-tech text-[10px] uppercase tracking-wider">Race</span>
            </button>
            <button
              type="button"
              onClick={() => wg("garage")}
              className={`2xl:hidden atelier-pill px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${Mg && tA === "garage" ? "border-white/35 text-white bg-white/14" : "text-zinc-300 hover:text-white"}`}
              title="Switch Supercar"
            >
              <span className="font-mono-tech text-[10px] uppercase">Garage</span>
            </button>
            <button
              type="button"
              onClick={() => wg("customize")}
              className={`atelier-pill px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${Mg && tA === "customize" ? "border-white/35 text-white bg-white/14" : "text-zinc-300 hover:text-white"}`}
              title="Open Tailor Made Paint & Finish Configurator"
            >
              <Palette className="w-3.5 h-3.5 text-[#DC1A22]" />
              <span className="hidden sm:inline">Atelier</span>
            </button>
            <button
              type="button"
              onClick={() => wg("systems")}
              className={`atelier-pill px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${Mg && tA === "systems" ? "border-white/35 text-white bg-white/14" : "text-zinc-300 hover:text-white"}`}
              title="Technical Views, Active Aero & Powertrain Controls"
            >
              <SlidersVertical className="w-3.5 h-3.5 text-[#F5C518]" />
              <span className="hidden sm:inline">Tech Lab</span>
            </button>
            <button
              type="button"
              onClick={() => wg("asset")}
              className={`atelier-pill px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${Mg && tA === "asset" ? "border-[#F5C518]/60 text-white bg-white/14" : "text-zinc-300 hover:text-white"}`}
              title="3D GLB Asset Info & Hot-Swap Custom Model"
            >
              <Box className="w-3.5 h-3.5 text-[#F5C518]" />
              <span className="hidden 2xl:inline">GLB</span>
            </button>
            <button
              type="button"
              onClick={() => MA((x) => (x === "xray" ? "solid" : "xray"))}
              className={`atelier-pill px-3 py-2 rounded-xl font-mono-tech text-[11px] uppercase flex items-center gap-1.5 transition-all cursor-pointer ${BA === "xray" ? "border-[#F5C518] text-[#F5C518] bg-[#F5C518]/15" : "text-zinc-300 hover:text-white"}`}
              title="Toggle Powertrain X-Ray Cutaway [Key: X]"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden 2xl:inline">X-Ray</span>
            </button>
            <button
              type="button"
              onClick={() => XA((x) => !x)}
              className={`atelier-pill px-3 py-2 rounded-xl font-mono-tech text-[11px] uppercase flex items-center gap-1.5 transition-all cursor-pointer ${Tg ? "border-[#F5C518] text-[#F5C518] bg-[#F5C518]/15" : "text-zinc-400 hover:text-white"}`}
              title="Toggle Matrix LED Headlights & Tail Lights [Key: L]"
              aria-label="Toggle car lights"
              aria-pressed={Tg}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              <span className="hidden 2xl:inline">{Tg ? "Lights On" : "Lights Off"}</span>
            </button>
            <button
              type="button"
              onClick={toggleOrbit}
              className={`atelier-pill p-2 rounded-xl transition-all cursor-pointer ${N ? "border-[#DC1A22] text-white bg-[#DC1A22]/25" : "text-zinc-400 hover:text-white"}`}
              title="Toggle 360° Turntable Auto-Orbit"
              aria-label="Toggle 360-degree orbit"
              aria-pressed={N}
            >
              <RotateCw
                className={`w-4 h-4 ${N ? "animate-spin" : ""}`}
                style={{
                  animationDuration: "8s",
                }}
              />
            </button>
            <button
              type="button"
              onClick={replayEntrance}
              disabled={o || !I}
              className="atelier-pill p-2 rounded-xl text-zinc-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              title="Replay Hydraulic Lift Entrance & 360° Showcase [Key: R]"
            >
              <ChevronsUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => $(!0)}
              className="atelier-pill p-2 rounded-xl text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Pure Cinema Mode — Hide UI [Key: H]"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </header>
      )}
      {zg && (
        <button
          type="button"
          onClick={() => $(!1)}
          className="fixed top-4 right-4 z-40 atelier-pill px-3.5 py-2 rounded-xl text-xs text-zinc-200 hover:text-white flex items-center gap-2 cursor-pointer"
        >
          <EyeOff className="w-3.5 h-3.5 text-[#DC1A22]" />
          <span className="font-mono-tech text-[10px] uppercase tracking-wider">Restore HUD [H]</span>
        </button>
      )}
      {!zg && !raceMode && (
        <AtelierPanel
          open={Mg}
          activeTab={tA}
          onChangeTab={eg}
          onClose={() => mg(!1)}
          paintHex={m}
          onChangePaintHex={X}
          paintFinish={L}
          onChangePaintFinish={gA}
          wheelSwatch={QA}
          onChangeWheelSwatch={AA}
          caliperSwatch={CA}
          onChangeCaliperSwatch={R}
          interiorSwatch={z}
          onChangeInteriorSwatch={IA}
          matteCarbon={iA}
          onToggleMatteCarbon={() => DA((x) => !x)}
          studioTheme={H}
          onChangeStudioTheme={wA}
          technicalView={BA}
          onChangeTechnicalView={MA}
          powerMode={WA}
          onChangePowerMode={JA}
          highDownforceGurney={nA}
          onToggleGurney={() => rA((x) => !x)}
          showAeroStreamlines={kA}
          onToggleStreamlines={() => og((x) => !x)}
          rollingRoad={$A}
          onToggleRollingRoad={() => Ug((x) => !x)}
          headlightsOn={Tg}
          onToggleHeadlights={() => XA((x) => !x)}
          brakeLightsOn={hA}
          onToggleBrakeLights={() => vA((x) => !x)}
          steeringAngleDeg={HA}
          onChangeSteering={lg}
          showHotspotPins={Wg}
          onToggleHotspotPins={() => yg((x) => !x)}
          selectedComponent={V}
          onSelectComponent={(x) => Eg(x)}
          activeCarId={Q}
          onSelectCar={SA}
          loadingAsset={o}
          vehicleAsset={I}
          meshInventory={u}
          onUploadCustomGlbFile={xA}
          onLoadCustomGlbUrl={RA}
          onResetBundledGlb={fA}
        />
      )}
      {!zg && !raceMode && (
        <ComponentDetailPanel
          componentId={V}
          specOverride={T}
          isSF90={g.isSF90Reference}
          onClose={() => {
            (P(null), G.interior && KA("hero"));
          }}
          onSelectComponent={(x) => Eg(x)}
          meshInventory={u}
          paintHex={m}
          onChangePaintHex={X}
          caliperSwatch={CA}
          onChangeCaliper={R}
          wheelSwatch={QA}
          onChangeWheel={AA}
          headlightsOn={Tg}
          onToggleHeadlights={() => XA((x) => !x)}
          brakeLightsOn={hA}
          onToggleBrakeLights={() => vA((x) => !x)}
          highDownforceGurney={nA}
          onToggleGurney={() => rA((x) => !x)}
          showAeroStreamlines={kA}
          onToggleStreamlines={() => og((x) => !x)}
          rollingRoad={$A}
          onToggleRollingRoad={() => Ug((x) => !x)}
          steeringAngleDeg={HA}
          onChangeSteering={lg}
          technicalView={BA}
          onChangeTechnicalView={MA}
          powerMode={WA}
          onChangePowerMode={JA}
        />
      )}
      {!zg && !raceMode && (
        <footer className="fixed bottom-3 inset-x-3 z-20 flex flex-col items-center gap-2 pointer-events-none">
          <LiftStatus />
          <div className="h-7 flex items-center justify-center">
            {y ? (
              <div className="atelier-pill px-3.5 py-1 rounded-full flex items-center gap-2 text-[11px] text-zinc-100 shadow-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F5C518]" />
                <span className="font-mono-tech text-[10px] text-[#F5C518]">{YA?.code}</span>
                <span className="font-medium">{YA?.name}</span>
                <span className="hidden sm:inline font-mono-tech text-[10px] text-zinc-400">
                  [{y.meshName}] · Click to Focus
                </span>
              </div>
            ) : V ? null : (
              <div className="hidden sm:flex atelier-pill px-3.5 py-1 rounded-full items-center gap-2 text-[11px] text-zinc-400">
                <MousePointerClick className="w-3.5 h-3.5 text-[#DC1A22]" />
                <span>
                  Drag 360° · Scroll to Zoom · Click any modeled component to inspect specifications
                </span>
              </div>
            )}
          </div>
          <div className="pointer-events-auto max-w-full overflow-x-auto no-scrollbar atelier-panel px-2 py-1.5 rounded-2xl flex items-center gap-1">
            {G.interior && (
              <button
                type="button"
                onClick={() => KA("hero")}
                className="px-3 py-1.5 rounded-xl bg-[#DC1A22] text-white font-mono-tech text-[10px] uppercase tracking-wider flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5" />
                {" Exit Cockpit"}
              </button>
            )}
            {CAMERA_PRESETS.map((x) => {
              const cA = U === x.id;
              return (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => KA(x.id)}
                  className={`px-3 py-1.5 rounded-xl font-mono-tech text-[10px] uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer shrink-0 ${cA ? "bg-white text-black font-semibold shadow-sm" : "text-zinc-300 hover:text-white hover:bg-white/8"}`}
                >
                  {x.shortLabel}
                </button>
              );
            })}
            <div className="w-[1px] h-4 bg-white/15 mx-1 shrink-0" />
            <button
              type="button"
              onClick={() => {
                const x = !nA;
                (rA(x), x && !kA && og(!0));
              }}
              className={`px-3 py-1.5 rounded-xl font-mono-tech text-[10px] uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${nA ? "bg-[#DC1A22]/30 border border-[#DC1A22] text-white" : "text-zinc-300 hover:text-white hover:bg-white/8"}`}
              title="Actuate Patented Shut-Off Gurney Active Rear Wing [Key: G]"
            >
              <Wind className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>{nA ? "Gurney: High DF" : "Shut-Off Gurney"}</span>
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
export default App;

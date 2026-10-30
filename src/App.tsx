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
import { ENVIRONMENTS, RACE_DIFFICULTIES, RACE_MAPS, lockRaceConditions, raceSession, setEnvironment, setRaceDifficulty, setRaceLightsEnabled } from "@/three/raceSession";
import { selectRaceTrack } from "@/three/raceTrack";
import { RaceHud } from "@/components/RaceHud";
import { CityHud } from "@/components/CityHud";
import { MainMenu } from "@/components/MainMenu";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RaceLoadingScreen } from "@/components/RaceLoadingScreen";
import { warmRaceOpponentModels } from "@/data/raceOpponentCars";
import { CityDriveDirector } from "@/three/CityDriveDirector";
import { GarageCarDisplays } from "@/three/GarageCarDisplays";
import { OpenCityWorld } from "@/three/CityWorld";
import { stopCityDrive } from "@/three/cityDrive";
import { LiftDirector } from "@/three/LiftDirector";
import { RaceCircuit, warmRaceCircuit } from "@/three/RaceCircuit";
import { RaceOpponents } from "@/three/RaceOpponents";
import { disposeAudio, initAudio, playLiftServoSound, resumeAudio, unlockAudioFromGesture } from "@/three/raceAudio";
import { GarageSoundtrack, type GarageSoundtrackHandle } from "@/components/GarageSoundtrack";
import { NitroPlumes, RaceCrashSparks, RaceDirector, RaceSceneReady, RaceSunlight, RaceVehicleRig } from "@/three/RaceDirector";
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
  CloudRain,
  Compass,
  DoorClosed,
  DoorOpen,
  Eye,
  EyeOff,
  Flag,
  Lightbulb,
  Map,
  Maximize2,
  Moon,
  Mountain,
  MousePointerClick,
  Palette,
  Power,
  Sun,
  RotateCw,
  SlidersVertical,
  Sparkles,
  Upload,
  Waves,
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
    // Keep the showroom presentation lights off until the user enables them.
    [Tg, XA] = React.useState(false),
    [hA, vA] = React.useState(!1),
    [HA, lg] = React.useState(0),
    [Wg, yg] = React.useState(!0),
    [Mg, mg] = React.useState(!1),
    [tA, eg] = React.useState("garage"),
    [zg, $] = React.useState(!1),
    [raceMode, setRaceMode] = React.useState(!1),
    [raceLoading, setRaceLoading] = React.useState(false),
    [raceCinematic, setRaceCinematic] = React.useState(false),
    [raceSceneReady, setRaceSceneReady] = React.useState(false),
    [cityMode, setCityMode] = React.useState(false),
    [cityExteriorVisible, setCityExteriorVisible] = React.useState(false),
    [cityPreparing, setCityPreparing] = React.useState(false),
    [driveAlignmentReady, setDriveAlignmentReady] = React.useState(false),
    [driveReady, setDriveReady] = React.useState(false),
    [cityGateReady, setCityGateReady] = React.useState(false),
    [citySceneReady, setCitySceneReady] = React.useState(false),
    [cityHeadlightsOn, setCityHeadlightsOn] = React.useState(true),
    [raceLightsOn, setRaceLightsOn] = React.useState(false),
    [raceBodyGlowOn, setRaceBodyGlowOn] = React.useState(false),
    [raceSetupOpen, setRaceSetupOpen] = React.useState(false),
    [raceSetupMap, setRaceSetupMap] = React.useState(raceSession.mapId),
    [raceSetupEnvironment, setRaceSetupEnvironment] = React.useState(raceSession.envIndex),
    [raceSetupDifficulty, setRaceSetupDifficulty] = React.useState(raceSession.difficulty),
    [raceSetupReady, setRaceSetupReady] = React.useState(false),
    [garageGateOpen, setGarageGateOpen] = React.useState(false),
    [openingGate, setOpeningGate] = React.useState(false),
    [garageLightsOn, setGarageLightsOn] = React.useState(true),
    [neonLightsOn, setNeonLightsOn] = React.useState(false),
    [garageMusicOn, setGarageMusicOn] = React.useState(false);
  const [liftStartRequested, setLiftStartRequested] = React.useState(false);
  const [mainMenuOpen, setMainMenuOpen] = React.useState(true);
  const [pauseMenuOpen, setPauseMenuOpen] = React.useState(false);
  const [pendingCarId, setPendingCarId] = React.useState(null);
  const [gameStarted, setGameStarted] = React.useState(false);
  const [startGameLoading, setStartGameLoading] = React.useState(false);
  const [graphicsQuality, setGraphicsQuality] = React.useState(() => {
    try {
      const saved = window.localStorage.getItem("maranello-graphics-quality");
      return saved === "low" || saved === "high" ? saved : "standard";
    } catch {
      return "standard";
    }
  });
  const requestSequence = React.useRef(0);
  const garageSoundtrackRef = React.useRef<GarageSoundtrackHandle>(null);
  const raceTransitionTimer = React.useRef(null);
  const raceLightsRef = React.useRef(false);
  const raceBodyGlowRef = React.useRef(false);
  React.useEffect(
    () => () => {
      if (raceTransitionTimer.current !== null) window.clearTimeout(raceTransitionTimer.current);
    },
    [],
  );
  React.useEffect(() => {
    try {
      window.localStorage.setItem("maranello-graphics-quality", graphicsQuality);
    } catch {
      // Quality selection still works for this session when storage is blocked.
    }
  }, [graphicsQuality]);
  const commitAsset = React.useCallback((asset, car) => {
    setLiftStartRequested(false);
    setDriveReady(false);
    setDriveAlignmentReady(false);
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
    if (!gameStarted) return;
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
  }, [Q, commitAsset, gameStarted]);
  const T = React.useMemo(() => (V ? getComponentSpec(g, V) : null), [V, g]),
    YA = React.useMemo(() => (y ? getComponentSpec(g, y.componentId) : null), [y, g]),
    SA = React.useCallback(
      (x) => {
        if (x === Q) return;
        setPendingCarId(x);
      },
      [Q],
    ),
    confirmCarSwitch = React.useCallback(() => {
      if (!pendingCarId || pendingCarId === Q) {
        setPendingCarId(null);
        return;
      }
      const nextCarId = pendingCarId;
      setPendingCarId(null);
      liftTimeline.pauseShowcase();
      A(nextCarId);
      P(null);
      j(null);
      W(false);
    }, [pendingCarId, Q, A]);
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
  const replayEntrance = React.useCallback(async () => {
    if (!I || o) return;
    // The button/key press is a browser-approved gesture: resume audio first,
    // then start the hydraulic lift so its sound begins with the movement.
    await unlockAudioFromGesture();
    setLiftStartRequested(true);
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
  // Race first opens a setup screen; the actual circuit starts only after the
  // player confirms a map and weather/time preset.
  const enterRace = React.useCallback(() => {
    if (!I || o || openingGate || cityMode || cityPreparing) return;
    setRaceSetupMap(raceSession.mapId);
    setRaceSetupEnvironment(raceSession.envIndex);
    setRaceSetupDifficulty(raceSession.difficulty);
    setRaceSetupReady(false);
    setRaceSetupOpen(true);
  }, [I, o, openingGate, cityMode, cityPreparing]);
  React.useEffect(() => {
    if (!raceSetupOpen) return;
    let cancelled = false;
    let idleId = 0;
    let timer = 0;
    setRaceSetupReady(false);
    const prepareRace = async () => {
      const opponentAssets = warmRaceOpponentModels();
      try {
        warmRaceCircuit(raceSetupMap);
      } catch {
        // Keep setup usable; RaceCircuit can still construct the route on entry.
      }
      await opponentAssets;
      if (!cancelled) setRaceSetupReady(true);
    };
    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(() => void prepareRace(), { timeout: 450 });
    } else {
      timer = window.setTimeout(() => void prepareRace(), 24);
    }
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (idleId && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idleId);
    };
  }, [raceSetupOpen, raceSetupMap]);
  const onCitySceneReady = React.useCallback(() => setCitySceneReady(true), []);
  const onCityDriveAlignmentComplete = React.useCallback(() => setDriveAlignmentReady(true), []);
  const openGarageForCity = React.useCallback(() => {
    setCityGateReady(false);
    setCitySceneReady(false);
    setCityExteriorVisible(true);
    setGarageGateOpen(true);
    setOpeningGate(true);
    if (raceTransitionTimer.current !== null) window.clearTimeout(raceTransitionTimer.current);
    raceTransitionTimer.current = window.setTimeout(() => {
      raceTransitionTimer.current = null;
      setCityGateReady(true);
      setOpeningGate(false);
    }, 1350);
  }, []);
  const enterCityDrive = React.useCallback(async () => {
    if (cityMode) {
      setCityMode(false);
      setCityPreparing(false);
      setDriveReady(false);
      setCityHeadlightsOn(false);
      stopCityDrive();
      disposeAudio();
      return;
    }
    if (driveReady) {
      setDriveReady(false);
      setDriveAlignmentReady(false);
      return;
    }
    if (!I || o || raceMode || cityPreparing || !liftStartRequested) return;
    // Wait for the browser to resume audio before starting a sound-bearing motion.
    await unlockAudioFromGesture();
    setDriveAlignmentReady(false);
    const alignmentNeeded = liftTimeline.alignForDrive(Math.PI);
    if (!alignmentNeeded) setDriveAlignmentReady(true);
    // Keep the garage view and closed gate unchanged while the turntable aligns.
    initAudio();
    if (alignmentNeeded) playLiftServoSound();
    setCityPreparing(true);
  }, [cityMode, driveReady, I, o, raceMode, cityPreparing, liftStartRequested]);
  React.useEffect(() => {
    if (!cityPreparing || !driveAlignmentReady) return;
    setCityPreparing(false);
    setDriveReady(true);
  }, [cityPreparing, driveAlignmentReady]);
  React.useEffect(() => {
    if (!driveReady || !garageGateOpen || openingGate || !cityGateReady || !citySceneReady || cityMode) return;
    P(null);
    j(null);
    p("hero");
    q((previous) => ({ ...CAMERA_PRESETS[0], interior: false, seq: previous.seq + 1 }));
    W(false);
    n(null);
    mg(false);
    setCityHeadlightsOn(true);
    setDriveReady(false);
    setCityMode(true);
  }, [driveReady, garageGateOpen, openingGate, cityGateReady, citySceneReady, cityMode]);
  const exitCityDrive = React.useCallback(() => {
    setCityMode(false);
    setCityPreparing(false);
    setDriveReady(false);
    setCityHeadlightsOn(false);
    stopCityDrive();
    disposeAudio();
  }, []);
  const toggleCityHeadlights = React.useCallback(() => setCityHeadlightsOn((on) => !on), []);
  const toggleRaceLights = React.useCallback(() => {
    const next = !raceLightsRef.current;
    raceLightsRef.current = next;
    setRaceLightsOn(next);
    setRaceLightsEnabled(next);
  }, []);
  const toggleRaceBodyGlow = React.useCallback(() => {
    const next = !raceBodyGlowRef.current;
    raceBodyGlowRef.current = next;
    setRaceBodyGlowOn(next);
  }, []);
  React.useEffect(() => {
    if (!raceMode) return;
    const onKeyDown = (event) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || raceCinematic) return;
      if (event.target?.closest?.("input, textarea, select, [contenteditable=true]")) return;
      if (event.code === "KeyL") toggleRaceLights();
      else if (event.code === "KeyB") toggleRaceBodyGlow();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [raceMode, raceCinematic, toggleRaceLights, toggleRaceBodyGlow]);
  const onRaceSceneReady = React.useCallback(() => setRaceSceneReady(true), []);
  const onRaceLoadingComplete = React.useCallback(() => setRaceLoading(false), []);
  const onRaceCinematicComplete = React.useCallback(() => {
    setRaceCinematic(false);
    raceBodyGlowRef.current = false;
    setRaceBodyGlowOn(false);
  }, []);
  const beginRace = React.useCallback(() => {
    if (!raceSetupReady || !I || o || openingGate || cityMode || cityPreparing) return;
    setDriveReady(false);
    setDriveAlignmentReady(false);
    selectRaceTrack(raceSetupMap);
    setEnvironment(raceSetupEnvironment);
    setRaceDifficulty(raceSetupDifficulty);
    const automaticLights = raceSetupEnvironment !== 0;
    raceLightsRef.current = automaticLights;
    setRaceLightsOn(automaticLights);
    setRaceLightsEnabled(automaticLights);
    // Switch on the paint-matched underglow for the cinematic left-side pass;
    // it is restored to the normal off state when the countdown begins.
    raceBodyGlowRef.current = true;
    setRaceBodyGlowOn(true);
    lockRaceConditions(true);
    setRaceSetupOpen(false);
    setRaceSceneReady(false);
    setRaceCinematic(true);
    setRaceLoading(true);
    // The Start Race click is the browser gesture needed to initialize audio.
    initAudio();
    liftTimeline.pauseShowcase();
    P(null);
    j(null);
    W(false);
    n(null);
    mg(!1);
    // The race scene supplies its own exterior; hide the boulevard while the shutter opens.
    setCityExteriorVisible(false);
    // Give the motorized shutter time to rise before handing over to the circuit.
    setGarageGateOpen(true);
    setOpeningGate(true);
    raceTransitionTimer.current = window.setTimeout(() => {
      raceTransitionTimer.current = null;
      setOpeningGate(false);
      setRaceMode(true);
    }, 1350);
  }, [I, o, openingGate, raceSetupMap, raceSetupEnvironment, raceSetupDifficulty, raceSetupReady, cityMode, cityPreparing]);
  const exitRace = React.useCallback(() => {
    setDriveReady(false);
    setDriveAlignmentReady(false);
    lockRaceConditions(false);
    raceLightsRef.current = false;
    setRaceLightsOn(false);
    setRaceLightsEnabled(false);
    raceBodyGlowRef.current = false;
    setRaceBodyGlowOn(false);
    // No entrance replay: the timeline stays parked where it was.
    liftTimeline.pauseShowcase();
    // Tear the graph down so nothing keeps running (or holding the audio
    // device) while the showroom is on screen.
    disposeAudio();
    setGarageGateOpen(false);
    setCityExteriorVisible(false);
    setOpeningGate(false);
    if (raceTransitionTimer.current !== null) {
      window.clearTimeout(raceTransitionTimer.current);
      raceTransitionTimer.current = null;
    }
    setRaceMode(!1);
    setRaceLoading(false);
    setRaceCinematic(false);
    setRaceSceneReady(false);
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
  const toggleGarageGate = React.useCallback(() => {
    if (openingGate || raceMode || cityMode || cityPreparing) return;
    if (!garageGateOpen) {
      openGarageForCity();
      return;
    }
    setGarageGateOpen(false);
    setOpeningGate(true);
    if (raceTransitionTimer.current !== null) window.clearTimeout(raceTransitionTimer.current);
    raceTransitionTimer.current = window.setTimeout(() => {
      raceTransitionTimer.current = null;
      setOpeningGate(false);
      setCityExteriorVisible(false);
      setCityGateReady(false);
      setCitySceneReady(false);
    }, 1350);
  }, [openingGate, raceMode, cityMode, cityPreparing, garageGateOpen, openGarageForCity]);
  const toggleGarageLights = React.useCallback(() => setGarageLightsOn((on) => !on), []);
  const toggleGarageMusic = React.useCallback(() => garageSoundtrackRef.current?.togglePlayback(), []);
  const toggleNeonLighting = React.useCallback(() => setNeonLightsOn((enabled) => !enabled), []);
  const toggleGurney = React.useCallback(() => {
    const enabled = !nA;
    rA(enabled);
    // Gurney-linked streamlines are enabled for the high-downforce pose and
    // cleared again when the flap is shut, so stale flow lines cannot linger.
    og(enabled);
  }, [nA]);
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
      // Race mode owns the keyboard: <RaceDirector/> reads WASD, Shift, Q and
      // Space, so showroom shortcuts would fight driving controls.
      if (raceMode || cityMode || cityPreparing || mainMenuOpen || pauseMenuOpen || !gameStarted || startGameLoading || o) return;
      if (pendingCarId) {
        if (cA.key === "Escape") {
          cA.preventDefault();
          setPendingCarId(null);
        }
        return;
      }
      if (
        cA.repeat ||
        cA.ctrlKey ||
        cA.metaKey ||
        cA.altKey ||
        cA.target.closest?.("input, textarea, select, [contenteditable=true]")
      )
        return;
      if (raceSetupOpen) {
        if (cA.key === "Escape") setRaceSetupOpen(false);
        return;
      }
      if (cA.key === "Escape") {
        cA.preventDefault();
        liftTimeline.pauseShowcase();
        P(null);
        setPauseMenuOpen(true);
        return;
      }
      if (!(cA.target instanceof HTMLInputElement || cA.target instanceof HTMLTextAreaElement))
        if (cA.key >= "1" && cA.key <= "7") {
          const yA = CAMERA_PRESETS[Number(cA.key) - 1];
          yA && KA(yA.id);
        } else
          cA.key.toLowerCase() === "x"
            ? MA((yA) => (yA === "xray" ? "solid" : "xray"))
            : cA.key.toLowerCase() === "g"
              ? toggleGurney()
              : cA.key.toLowerCase() === "h"
                ? $((yA) => !yA)
                : cA.key.toLowerCase() === "l"
                  ? toggleNeonLighting()
                  : cA.key.toLowerCase() === "r"
                    ? replayEntrance()
                    : cA.key === "Escape" && (P(null), G.interior && KA("hero"));
    };
    return (window.addEventListener("keydown", x), () => window.removeEventListener("keydown", x));
  }, [KA, G.interior, replayEntrance, raceMode, cityMode, cityPreparing, mainMenuOpen, pauseMenuOpen, gameStarted, startGameLoading, o, pendingCarId, raceSetupOpen, toggleNeonLighting, toggleGurney]);
  const wg = (x) => {
    Mg && tA === x ? mg(!1) : (eg(x), mg(!0));
  };
  const runToolbarAction = (event, action) => {
    event.currentTarget.closest("details")?.removeAttribute("open");
    action();
  };
  const startGame = React.useCallback(() => {
    garageSoundtrackRef.current?.startRandomTrack();
    setStartGameLoading(true);
    l(true);
    n(null);
    setGameStarted(true);
    setMainMenuOpen(false);
    void unlockAudioFromGesture();
  }, []);
  const finishStartGameLoading = React.useCallback(() => {
    setStartGameLoading(false);
  }, []);
  const quitGame = React.useCallback(() => {
    try {
      window.close();
    } catch {
      // Most browsers only close tabs opened by script; MainMenu shows a fallback.
    }
  }, []);
  const quitToMainMenu = React.useCallback(() => {
    liftTimeline.pauseShowcase();
    setPauseMenuOpen(false);
    setStartGameLoading(false);
    setGameStarted(false);
    setMainMenuOpen(true);
    setGarageGateOpen(false);
    setOpeningGate(false);
    setCityExteriorVisible(false);
  }, []);
  const resumeGame = React.useCallback(() => {
    garageSoundtrackRef.current?.resumePlayback();
    setPauseMenuOpen(false);
  }, []);
  const pendingCar = pendingCarId ? getCarById(pendingCarId) : null;
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
      {gameStarted && (
        <>
      <Canvas
        frameloop="demand"
        shadows={!raceMode && graphicsQuality !== "low"}
        // A slightly reduced race resolution and no shadow map free GPU time for
        // stable 60 fps; the showroom keeps the selected higher-fidelity preset.
        dpr={raceMode ? 0.9 : graphicsQuality === "low" ? 1 : graphicsQuality === "high" ? [1, 2] : [1, 1.5]}
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
            <RaceSceneReady onReady={onRaceSceneReady} />
            <RaceSunlight />
            {!raceLoading && <RaceDirector onCinematicComplete={onRaceCinematicComplete} />}
            {!raceLoading && <NitroPlumes />}
            {!raceLoading && <RaceCrashSparks />}
          </>
        )}
        {/* The rig wraps the car in BOTH modes. In the showroom it stays an
            identity transform, so switching modes re-parents without remounting
            the GLB, its shader programs or its textures. */}
        {I && (
          <RaceVehicleRig>
            <VehicleModel
              asset={I}
              selectedComponent={raceMode ? null : V}
              entranceSeq={E}
              onSelectComponent={raceMode ? null : Eg}
              onHoverTelemetry={j}
              onMeshInventoryReady={K}
              paintHex={m}
              paintFinish={L}
              caliperSwatch={CA}
              wheelSwatch={QA}
              interiorSwatch={z}
              matteCarbon={iA}
              headlightsOn={cityMode ? cityHeadlightsOn : raceMode ? raceLightsOn : Tg}
              brakeLightsOn={hA}
              highDownforceGurney={nA}
              rollingRoad={$A}
              steeringAngleDeg={HA}
              technicalView={BA}
              powerMode={WA}
              bodyGlowOn={raceMode ? raceBodyGlowOn : neonLightsOn}
              interiorLightsOn={!raceMode && !cityMode && neonLightsOn}
              showHotspotPins={Wg && !zg && !G.interior && !raceMode && !cityMode}
            />
          </RaceVehicleRig>
        )}
        {I && !raceMode && !cityMode && !cityPreparing && (
          <GarageCarDisplays activeCarId={Q} onSelectCar={SA} />
        )}
        {!raceMode && (
          <>
            <LiftDirector entranceSeq={E} startAllowed={liftStartRequested} onDriveAlignmentComplete={onCityDriveAlignmentComplete} />
            <Showroom
              theme={H}
              showAeroStreamlines={kA}
              highDownforceGurney={nA}
              rollingRoad={$A}
              garageGateOpen={garageGateOpen}
              garageLightsOn={garageLightsOn}
              cityDriveMode={cityExteriorVisible}
            />
            <OpenCityWorld visible={cityExteriorVisible} driving={cityMode} onReady={onCitySceneReady} />
            {cityMode ? (
              <CityDriveDirector carId={Q} onExit={exitCityDrive} onToggleHeadlights={toggleCityHeadlights} />
            ) : (
              <CameraRig goal={G} autoOrbit={N} onUserInteract={userCameraInteraction} />
            )}
          </>
        )}
      </Canvas>
      {!pauseMenuOpen && !pendingCar && (
        <>
      <div
        className="pointer-events-none fixed inset-0 z-10"
        style={{
          background: "radial-gradient(circle at 50% 48%, rgba(6,7,9,0) 58%, rgba(4,5,7,0.55) 100%)",
          contain: "strict",
        }}
      />
      {I && !o && !liftStartRequested && !raceMode && !cityMode && (
        <div className="fixed inset-0 z-30 flex items-center justify-center pointer-events-none">
          <button
            type="button"
            onClick={replayEntrance}
            className="pointer-events-auto atelier-pill flex items-center gap-3 rounded-2xl border border-[#F5C518]/80 bg-black/90 px-9 py-5 text-base font-semibold uppercase tracking-[0.16em] text-white shadow-[0_0_42px_rgba(245,197,24,0.28)] backdrop-blur-md transition-all hover:scale-[1.03] hover:bg-[#1a1710] hover:border-[#F5C518] cursor-pointer"
            aria-label="Lift the Car and play the hydraulic lift sound"
          >
            <ChevronsUp className="w-6 h-6 text-[#F5C518]" />
            Lift the Car
          </button>
        </div>
      )}
      {/* Race overlay. It reads the simulation through refs + a subscription, so
          the 60 fps numbers never re-render React or the canvas. */}
      {cityMode && (
        <CityHud headlightsOn={cityHeadlightsOn} onToggleHeadlights={toggleCityHeadlights} />
      )}
      {raceMode && !raceLoading && !raceCinematic && (
        <RaceHud
          onExit={exitRace}
          lightsOn={raceLightsOn}
          bodyGlowOn={raceBodyGlowOn}
          onToggleLights={toggleRaceLights}
          onToggleBodyGlow={toggleRaceBodyGlow}
        />
      )}
      {raceLoading && <RaceLoadingScreen sceneReady={raceSceneReady} onComplete={onRaceLoadingComplete} />}
      {!mainMenuOpen && (startGameLoading || (o && !I)) && (
        <LoadingScreen assetReady={!o} onComplete={finishStartGameLoading} />
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
      <header hidden={raceMode || zg} className="fixed top-0 inset-x-0 z-30 px-2 sm:px-4 py-2 pointer-events-none">
          <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between gap-2 sm:gap-3">
            <div className="hidden xl:flex min-w-0 max-w-[260px] shrink items-center gap-3 rounded-2xl atelier-pill px-3 py-2 pointer-events-auto">
              <div className="flex w-1 shrink-0 flex-col gap-[2px]">
                <span className="h-2 rounded-full bg-[#009246]" />
                <span className="h-2 rounded-full bg-white" />
                <span className="h-2 rounded-full bg-[#CE2B37]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate font-display text-sm font-bold uppercase tracking-tight text-white">
                    {g.brand} {g.model}
                  </h1>
                  <span className="hidden 2xl:inline font-mono-tech text-[9px] text-zinc-500">{g.year}</span>
                </div>
                <div className="truncate font-mono-tech text-[9px] uppercase tracking-wider text-zinc-500">
                  {g.shortName || g.shortTitle || g.tagline}
                </div>
              </div>
            </div>

            <nav aria-label="Showroom navigation" className="pointer-events-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
              <div role="group" aria-label="Race and driving" className="atelier-pill flex shrink-0 items-center gap-0.5 rounded-xl p-1">
                <button
                  type="button"
                  onClick={enterRace}
                  disabled={o || !I || openingGate || cityMode || cityPreparing}
                  aria-label="Choose a race"
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-[#DC1A22]/60 bg-[#DC1A22]/20 px-2.5 text-white transition-colors hover:bg-[#DC1A22]/35 disabled:opacity-50 sm:px-3"
                  title="Choose a circuit, weather and difficulty before starting"
                >
                  <Flag className="h-3.5 w-3.5 text-[#F87171]" />
                  <span className="font-mono-tech text-[9px] font-semibold uppercase tracking-wider">{openingGate ? "Opening…" : "Race"}</span>
                </button>
                <button
                  type="button"
                  onClick={enterCityDrive}
                  disabled={o || !I || raceMode || cityPreparing || !liftStartRequested}
                  aria-pressed={cityMode || driveReady}
                  aria-label={cityPreparing ? "Turning car toward the garage" : `Drive ${cityMode || driveReady ? "on" : "off"}`}
                  className={`flex h-9 items-center gap-1.5 rounded-lg px-2.5 transition-colors disabled:opacity-50 sm:px-3 ${cityMode || driveReady ? "bg-sky-300/20 text-sky-100" : "text-zinc-300 hover:bg-white/8 hover:text-white"}`}
                  title={!liftStartRequested ? "Click Lift the Car before enabling Drive" : cityPreparing ? "The elevator is turning the car toward the garage gate" : driveReady ? "The car is aligned. Open the garage gate to start driving" : cityMode ? "Turn city driving off and return the car to the garage" : "Turn on Drive to align the car, then open the gate to leave"}
                  aria-busy={cityPreparing}
                >
                  <Power className={`h-3.5 w-3.5 ${cityMode || driveReady ? "text-sky-200" : "text-zinc-400"}`} />
                  <span className="hidden font-mono-tech text-[9px] uppercase tracking-wider sm:inline">
                    {cityPreparing ? "Turning…" : `Drive ${cityMode || driveReady ? "ON" : "OFF"}`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={toggleGarageGate}
                  disabled={openingGate || raceMode || cityMode || cityPreparing}
                  aria-label={garageGateOpen ? "Close garage gate" : "Open garage gate"}
                  aria-pressed={garageGateOpen}
                  className={`hidden h-9 items-center gap-1.5 rounded-lg px-2.5 transition-colors disabled:opacity-50 sm:flex sm:px-3 ${garageGateOpen ? "bg-[#F5C518]/10 text-[#F5C518]" : "text-zinc-300 hover:bg-white/8 hover:text-white"}`}
                  title={driveReady && !garageGateOpen ? "Open the garage gate to let the aligned car drive outside" : garageGateOpen ? "Close the motorized garage gate" : "Open the motorized garage gate"}
                >
                  {garageGateOpen ? <DoorOpen className="h-3.5 w-3.5" /> : <DoorClosed className="h-3.5 w-3.5" />}
                  <span className="hidden font-mono-tech text-[9px] uppercase tracking-wider md:inline">Gate</span>
                </button>
              </div>

              <div aria-hidden="true" className="hidden h-7 w-px bg-white/15 sm:block" />

              <div role="group" aria-label="Studio sections" className="atelier-pill hidden shrink-0 items-center gap-0.5 rounded-xl p-1 sm:flex">
                <button
                  type="button"
                  onClick={() => wg("garage")}
                  aria-label="Garage and car selection"
                  aria-pressed={Mg && tA === "garage"}
                  className={`flex h-9 items-center gap-1.5 rounded-lg px-2.5 transition-colors sm:px-3 ${Mg && tA === "garage" ? "bg-white/14 text-white" : "text-zinc-300 hover:bg-white/8 hover:text-white"}`}
                  title="Garage and vehicle selection"
                >
                  <DoorClosed className="h-3.5 w-3.5" />
                  <span className="hidden font-mono-tech text-[9px] uppercase tracking-wider md:inline">Garage</span>
                </button>
                <button
                  type="button"
                  onClick={() => wg("customize")}
                  aria-label="Open Atelier paint and finish"
                  aria-pressed={Mg && tA === "customize"}
                  className={`flex h-9 items-center gap-1.5 rounded-lg px-2.5 transition-colors sm:px-3 ${Mg && tA === "customize" ? "bg-white/14 text-white" : "text-zinc-300 hover:bg-white/8 hover:text-white"}`}
                  title="Paint and finish configurator"
                >
                  <Palette className="h-3.5 w-3.5 text-[#DC1A22]" />
                  <span className="hidden font-mono-tech text-[9px] uppercase tracking-wider md:inline">Atelier</span>
                </button>
                <button
                  type="button"
                  onClick={() => wg("systems")}
                  aria-label="Open Tech Lab"
                  aria-pressed={Mg && tA === "systems"}
                  className={`flex h-9 items-center gap-1.5 rounded-lg px-2.5 transition-colors sm:px-3 ${Mg && tA === "systems" ? "bg-white/14 text-white" : "text-zinc-300 hover:bg-white/8 hover:text-white"}`}
                  title="Technical views, active aero and powertrain controls"
                >
                  <SlidersVertical className="h-3.5 w-3.5 text-[#F5C518]" />
                  <span className="hidden font-mono-tech text-[9px] uppercase tracking-wider md:inline">Tech Lab</span>
                </button>
              </div>
            </nav>

            <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
              <details
                className="relative"
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.currentTarget.removeAttribute("open");
                    event.currentTarget.querySelector("summary")?.focus();
                  }
                }}
              >
                <summary
                  aria-label="Open vehicle and showroom controls"
                  className="atelier-pill flex h-10 list-none cursor-pointer select-none items-center gap-1.5 rounded-xl px-2.5 text-zinc-300 transition-colors hover:text-white [&::-webkit-details-marker]:hidden sm:px-3"
                  title="Vehicle, lighting and showcase controls"
                >
                  <SlidersVertical className="h-4 w-4 text-[#F5C518]" />
                  <span className="hidden font-mono-tech text-[9px] uppercase tracking-wider sm:inline">Controls</span>
                  <span aria-hidden="true" className="text-[10px] text-zinc-500">⌄</span>
                </summary>
                <div className="atelier-panel absolute right-0 top-full z-[60] mt-2 max-h-[min(76vh,36rem)] w-[min(22rem,calc(100vw_-_1rem))] overflow-y-auto rounded-2xl border border-white/12 p-3 shadow-[0_20px_70px_rgba(0,0,0,0.65)]">
                  <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-2">
                    <div>
                      <div className="font-mono-tech text-[9px] uppercase tracking-[0.2em] text-[#F5C518]">Showroom controls</div>
                      <div className="mt-1 text-xs text-zinc-500">Vehicle, lighting and display</div>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => runToolbarAction(event, () => {})}
                      className="grid h-8 w-8 place-items-center rounded-lg text-lg leading-none text-zinc-400 transition-colors hover:bg-white/8 hover:text-white"
                      aria-label="Close showroom controls"
                    >×</button>
                  </div>

                  <div className="mb-3 sm:hidden">
                    <div className="mb-2 font-mono-tech text-[9px] uppercase tracking-wider text-zinc-500">Studio sections</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button type="button" onClick={(event) => runToolbarAction(event, () => wg("garage"))} aria-pressed={Mg && tA === "garage"} className="flex min-w-0 flex-col items-center gap-1 rounded-lg border border-white/8 bg-black/15 px-1.5 py-2 text-[10px] text-zinc-200 hover:border-white/20">
                        <DoorClosed className="h-4 w-4" /><span>Garage</span>
                      </button>
                      <button type="button" onClick={(event) => runToolbarAction(event, () => wg("customize"))} aria-pressed={Mg && tA === "customize"} className="flex min-w-0 flex-col items-center gap-1 rounded-lg border border-white/8 bg-black/15 px-1.5 py-2 text-[10px] text-zinc-200 hover:border-white/20">
                        <Palette className="h-4 w-4 text-[#DC1A22]" /><span>Atelier</span>
                      </button>
                      <button type="button" onClick={(event) => runToolbarAction(event, () => wg("systems"))} aria-pressed={Mg && tA === "systems"} className="flex min-w-0 flex-col items-center gap-1 rounded-lg border border-white/8 bg-black/15 px-1.5 py-2 text-[10px] text-zinc-200 hover:border-white/20">
                        <SlidersVertical className="h-4 w-4 text-[#F5C518]" /><span>Tech Lab</span>
                      </button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="mb-2 font-mono-tech text-[9px] uppercase tracking-wider text-zinc-500">Select vehicle</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {CARS.map((car) => {
                        const selected = car.id === Q;
                        return (
                          <button
                            key={car.id}
                            type="button"
                            onClick={(event) => runToolbarAction(event, () => SA(car.id))}
                            disabled={o}
                            aria-pressed={selected}
                            className={`min-w-0 rounded-lg border px-2.5 py-2 text-left transition-colors disabled:opacity-50 ${selected ? "border-[#F5C518]/60 bg-[#F5C518]/10 text-white" : "border-white/8 bg-black/15 text-zinc-300 hover:border-white/20 hover:text-white"}`}
                          >
                            <span className="block truncate font-mono-tech text-[8px] uppercase tracking-wider text-zinc-500">{car.brand}</span>
                            <span className="mt-0.5 block truncate font-display text-[11px] font-semibold">{car.shortTitle}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mb-2 font-mono-tech text-[9px] uppercase tracking-wider text-zinc-500">Quick controls</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button type="button" onClick={(event) => runToolbarAction(event, toggleGarageGate)} disabled={openingGate || raceMode || cityMode || cityPreparing} aria-pressed={garageGateOpen} className="flex min-w-0 items-center gap-2 rounded-lg border border-white/8 bg-black/15 px-2.5 py-2 text-left text-[11px] text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/5 disabled:opacity-50 sm:hidden">
                      {garageGateOpen ? <DoorOpen className="h-3.5 w-3.5 shrink-0 text-[#F5C518]" /> : <DoorClosed className="h-3.5 w-3.5 shrink-0 text-zinc-500" />}
                      <span className="min-w-0"><span className="block truncate">Garage gate</span><span className="block text-[9px] text-zinc-500">{garageGateOpen ? "Open" : "Closed"}</span></span>
                    </button>
                    <button type="button" onClick={(event) => runToolbarAction(event, toggleGarageLights)} aria-pressed={garageLightsOn} className="flex min-w-0 items-center gap-2 rounded-lg border border-white/8 bg-black/15 px-2.5 py-2 text-left text-[11px] text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/5">
                      {garageLightsOn ? <Sun className="h-3.5 w-3.5 shrink-0 text-[#F5C518]" /> : <Moon className="h-3.5 w-3.5 shrink-0 text-[#E7B5FF]" />}
                      <span className="min-w-0"><span className="block truncate">Garage lights</span><span className="block text-[9px] text-zinc-500">{garageLightsOn ? "On" : "Off"}</span></span>
                    </button>
                    <GarageSoundtrack
                      ref={garageSoundtrackRef}
                      active={gameStarted && !pauseMenuOpen && !raceMode && !raceCinematic && !raceLoading && !cityMode && !cityPreparing && !openingGate}
                      isPaused={pauseMenuOpen}
                      onPlaybackChange={setGarageMusicOn}
                    />
                    <button type="button" onClick={(event) => runToolbarAction(event, () => XA((value) => !value))} aria-pressed={Tg} className="flex min-w-0 items-center gap-2 rounded-lg border border-white/8 bg-black/15 px-2.5 py-2 text-left text-[11px] text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/5">
                      <Lightbulb className={`h-3.5 w-3.5 shrink-0 ${Tg ? "text-[#F5C518]" : "text-zinc-500"}`} />
                      <span className="min-w-0"><span className="block truncate">Vehicle lights</span><span className="block text-[9px] text-zinc-500">{Tg ? "On" : "Off"}</span></span>
                    </button>
                    <button type="button" onClick={(event) => runToolbarAction(event, toggleNeonLighting)} aria-pressed={neonLightsOn} className="flex min-w-0 items-center gap-2 rounded-lg border border-white/8 bg-black/15 px-2.5 py-2 text-left text-[11px] text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/5">
                      <Sparkles className={`h-3.5 w-3.5 shrink-0 ${neonLightsOn ? "text-[#F19BFF]" : "text-zinc-500"}`} />
                      <span className="min-w-0"><span className="block truncate">Underglow</span><span className="block text-[9px] text-zinc-500">{neonLightsOn ? "On" : "Off"} · L</span></span>
                    </button>
                    <button type="button" onClick={(event) => runToolbarAction(event, () => MA((value) => value === "xray" ? "solid" : "xray"))} aria-pressed={BA === "xray"} className="flex min-w-0 items-center gap-2 rounded-lg border border-white/8 bg-black/15 px-2.5 py-2 text-left text-[11px] text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/5">
                      <Eye className={`h-3.5 w-3.5 shrink-0 ${BA === "xray" ? "text-[#F5C518]" : "text-zinc-500"}`} />
                      <span className="min-w-0"><span className="block truncate">Powertrain X-Ray</span><span className="block text-[9px] text-zinc-500">{BA === "xray" ? "On" : "Off"} · X</span></span>
                    </button>
                    <button type="button" onClick={(event) => runToolbarAction(event, toggleOrbit)} aria-pressed={N} className="flex min-w-0 items-center gap-2 rounded-lg border border-white/8 bg-black/15 px-2.5 py-2 text-left text-[11px] text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/5">
                      <RotateCw className={`h-3.5 w-3.5 shrink-0 ${N ? "animate-spin text-[#DC1A22]" : "text-zinc-500"}`} />
                      <span className="min-w-0"><span className="block truncate">Auto-orbit</span><span className="block text-[9px] text-zinc-500">{N ? "On" : "Off"}</span></span>
                    </button>
                    <button type="button" onClick={(event) => runToolbarAction(event, () => wg("asset"))} className="flex min-w-0 items-center gap-2 rounded-lg border border-white/8 bg-black/15 px-2.5 py-2 text-left text-[11px] text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/5">
                      <Box className="h-3.5 w-3.5 shrink-0 text-[#F5C518]" />
                      <span className="min-w-0"><span className="block truncate">Model & GLB</span><span className="block text-[9px] text-zinc-500">Info / upload</span></span>
                    </button>
                    <button type="button" onClick={(event) => runToolbarAction(event, replayEntrance)} disabled={o || !I} className="flex min-w-0 items-center gap-2 rounded-lg border border-white/8 bg-black/15 px-2.5 py-2 text-left text-[11px] text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/5 disabled:opacity-50">
                      <ChevronsUp className="h-3.5 w-3.5 shrink-0 text-[#F5C518]" />
                      <span className="min-w-0"><span className="block truncate">Lift the car</span><span className="block text-[9px] text-zinc-500">Replay showcase</span></span>
                    </button>
                  </div>
                </div>
              </details>
              <button
                type="button"
                onClick={() => $(!0)}
                className="atelier-pill grid h-10 w-10 place-items-center rounded-xl text-zinc-300 transition-colors hover:text-white"
                title="Pure Cinema Mode — Hide UI [Key: H]"
                aria-label="Hide interface for cinema mode"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
          </div>
      </header>
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
      {!zg && !raceMode && !cityMode && !cityPreparing && (
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
          onToggleGurney={toggleGurney}
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
      {!zg && !raceMode && !cityMode && !cityPreparing && (
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
          onToggleGurney={toggleGurney}
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
      {!zg && !raceMode && !cityMode && !cityPreparing && (
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
          <div className="pointer-events-auto max-w-full overflow-x-auto no-scrollbar atelier-panel flex items-center gap-1 rounded-2xl px-2 py-1.5">
            {G.interior && (
              <button
                type="button"
                onClick={() => KA("hero")}
                aria-label="Exit cockpit camera"
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#DC1A22] px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-wider text-white transition-colors hover:bg-[#B9151C]"
              >
                <Compass className="h-3.5 w-3.5" /> Exit Cockpit
              </button>
            )}
            {CAMERA_PRESETS.map((preset) => {
              const selected = U === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => KA(preset.id)}
                  aria-label={preset.label}
                  aria-pressed={selected}
                  title={preset.label}
                  className={`shrink-0 whitespace-nowrap rounded-xl px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-wider transition-all ${selected ? "bg-white font-semibold text-black shadow-sm" : "text-zinc-300 hover:bg-white/8 hover:text-white"}`}
                >
                  {preset.shortLabel}
                </button>
              );
            })}
            <div aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-white/15" />
            <button
              type="button"
              onClick={toggleGurney}
              aria-pressed={nA}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-wider transition-all ${nA ? "border border-[#DC1A22]/70 bg-[#DC1A22]/20 text-white" : "text-zinc-300 hover:bg-white/8 hover:text-white"}`}
              title="Toggle the active rear-wing shut-off gurney [Key: G]"
            >
              <Wind className="h-3.5 w-3.5 text-[#38BDF8]" />
              <span className="hidden sm:inline">{nA ? "Gurney: High DF" : "Shut-Off Gurney"}</span>
              <span className="sm:hidden">{nA ? "High DF" : "Gurney"}</span>
            </button>
          </div>
        </footer>
      )}
      {raceSetupOpen && !raceMode && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#030407]/82 backdrop-blur-md p-3 sm:p-6 pointer-events-auto"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRaceSetupOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="race-setup-title"
            className="atelier-panel w-full max-w-5xl max-h-[94vh] overflow-y-auto rounded-3xl border border-white/12 shadow-[0_30px_120px_rgba(0,0,0,0.7)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-7">
              <div>
                <div className="flex items-center gap-2 font-mono-tech text-[10px] uppercase tracking-[0.24em] text-[#F5C518]">
                  <Flag className="h-3.5 w-3.5" /> Race Control · Grid Setup
                </div>
                <h2 id="race-setup-title" className="mt-2 font-display text-2xl sm:text-3xl font-bold uppercase tracking-wide text-white">
                  Choose your race
                </h2>
                <p className="mt-1 text-sm text-zinc-400">Pick a circuit and conditions before the garage gate opens.</p>
              </div>
              <button
                type="button"
                onClick={() => setRaceSetupOpen(false)}
                aria-label="Close race setup"
                className="atelier-pill grid h-9 w-9 place-items-center rounded-full text-zinc-300 hover:text-white cursor-pointer"
              >
                <span className="text-xl leading-none">×</span>
              </button>
            </div>

            <div className="space-y-7 px-5 py-5 sm:px-7 sm:py-6">
              <section aria-labelledby="race-map-heading">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <div className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-zinc-500">01 · Circuit</div>
                    <h3 id="race-map-heading" className="mt-1 font-display text-lg font-semibold text-white">Select a map</h3>
                  </div>
                  <span className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-500">3 routes</span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {RACE_MAPS.map((map, index) => {
                    const Icon = index === 0 ? Map : index === 1 ? Waves : Mountain;
                    const selected = raceSetupMap === map.id;
                    const landscape = index === 0
                      ? "linear-gradient(135deg, rgba(220,26,34,.45), rgba(13,16,24,.35) 58%, rgba(245,197,24,.16))"
                      : index === 1
                        ? "linear-gradient(135deg, rgba(30,142,185,.45), rgba(13,16,24,.35) 58%, rgba(50,200,170,.18))"
                        : "linear-gradient(135deg, rgba(112,117,160,.46), rgba(13,16,24,.34) 58%, rgba(56,189,248,.18))";
                    const routeShape = index === 0
                      ? "M32 25 C54 11 87 17 109 19 C136 21 168 21 184 37 C199 52 179 69 158 70 C136 71 134 84 109 77 C83 70 62 84 42 69 C22 55 17 37 32 25 Z"
                      : index === 1
                        ? "M24 38 C39 18 59 19 77 27 C99 37 106 13 130 17 C153 20 157 41 180 34 C202 27 204 51 183 57 C161 63 174 81 151 79 C127 77 119 58 96 63 C71 69 64 84 43 72 C24 62 13 51 24 38 Z"
                        : "M33 20 L68 15 L88 32 L115 17 L143 30 L169 22 L188 42 L169 55 L177 74 L144 81 L121 64 L94 79 L72 60 L45 72 L27 52 Z";
                    const routeStart = index === 0 ? [32, 25] : index === 1 ? [24, 38] : [33, 20];
                    return (
                      <button
                        key={map.id}
                        type="button"
                        onClick={() => setRaceSetupMap(map.id)}
                        aria-pressed={selected}
                        className={`overflow-hidden rounded-2xl border text-left transition-all cursor-pointer ${selected ? "border-[#F5C518] bg-[#F5C518]/[0.07] shadow-[0_0_26px_rgba(245,197,24,0.1)]" : "border-white/10 bg-black/25 hover:border-white/30"}`}
                      >
                        <div className="relative flex h-24 items-end justify-between overflow-hidden p-4" style={{ background: landscape }}>
                          <svg className="absolute inset-0 h-full w-full opacity-75" viewBox="0 0 220 96" fill="none" aria-hidden="true">
                            <path d={routeShape} stroke={selected ? "#F5C518" : "#FFFFFF"} strokeOpacity="0.82" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx={routeStart[0]} cy={routeStart[1]} r="3.5" fill={selected ? "#F5C518" : "#FFFFFF"} />
                          </svg>
                          <Icon className={`relative z-10 h-6 w-6 ${selected ? "text-[#F5C518]" : "text-white/80"}`} />
                          <span className="relative rounded-full bg-black/45 px-2 py-1 font-mono-tech text-[9px] uppercase tracking-wider text-white/80">{map.region}</span>
                        </div>
                        <div className="p-4">
                          <div className="font-display text-[15px] font-semibold text-white">{map.name}</div>
                          <p className="mt-1.5 min-h-[2.5rem] text-xs leading-relaxed text-zinc-400">{map.description}</p>
                          <div className={`mt-3 font-mono-tech text-[9px] uppercase tracking-[0.18em] ${selected ? "text-[#F5C518]" : "text-zinc-600"}`}>
                            {selected ? "Selected circuit" : "Choose circuit"}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section aria-labelledby="race-weather-heading">
                <div className="mb-3">
                  <div className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-zinc-500">02 · Conditions</div>
                  <h3 id="race-weather-heading" className="mt-1 font-display text-lg font-semibold text-white">Choose time and weather</h3>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {ENVIRONMENTS.map((environment, index) => {
                    const Icon = index === 0 ? Sun : index === 1 ? Moon : CloudRain;
                    const selected = raceSetupEnvironment === index;
                    const note = index === 0 ? "Clear skies · full daylight" : index === 1 ? "Night run · lamps on" : "Wet asphalt · rain and fog";
                    return (
                      <button
                        key={environment.id}
                        type="button"
                        onClick={() => setRaceSetupEnvironment(index)}
                        aria-pressed={selected}
                        className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all cursor-pointer ${selected ? "border-[#38BDF8]/70 bg-[#38BDF8]/[0.09] text-white" : "border-white/10 bg-black/20 text-zinc-300 hover:border-white/25"}`}
                      >
                        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${selected ? "bg-[#38BDF8]/15 text-[#7DD3FC]" : "bg-white/5 text-zinc-400"}`}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <span>
                          <span className="block font-display text-sm font-semibold">{environment.label}</span>
                          <span className="mt-0.5 block font-mono-tech text-[9px] uppercase tracking-wider text-zinc-500">{note}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section aria-labelledby="race-difficulty-heading">
                <div className="mb-3">
                  <div className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-zinc-500">03 · Rival pace</div>
                  <h3 id="race-difficulty-heading" className="mt-1 font-display text-lg font-semibold text-white">Choose difficulty</h3>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {RACE_DIFFICULTIES.map((difficulty) => {
                    const selected = raceSetupDifficulty === difficulty.id;
                    return (
                      <button
                        key={difficulty.id}
                        type="button"
                        onClick={() => setRaceSetupDifficulty(difficulty.id)}
                        aria-pressed={selected}
                        className={`rounded-xl border px-4 py-3 text-left transition-all cursor-pointer ${selected ? "border-[#DC1A22]/70 bg-[#DC1A22]/[0.09] text-white" : "border-white/10 bg-black/20 text-zinc-300 hover:border-white/25"}`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-display text-sm font-semibold">{difficulty.label}</span>
                          <span className={`font-mono-tech text-[9px] uppercase tracking-wider ${selected ? "text-[#FCA5A5]" : "text-zinc-600"}`}>
                            {selected ? "Selected" : "Select"}
                          </span>
                        </span>
                        <span className="mt-1 block font-mono-tech text-[9px] leading-relaxed text-zinc-500">{difficulty.description}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <span className="font-mono-tech text-[9px] uppercase tracking-wider text-zinc-500">
                {raceSetupReady ? "Circuit, Porsche and Bugatti are ready." : "Preparing circuit and opponent cars…"}
              </span>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRaceSetupOpen(false)}
                  className="atelier-pill rounded-xl px-4 py-2.5 font-mono-tech text-[10px] uppercase tracking-wider text-zinc-300 hover:text-white cursor-pointer"
                >Cancel</button>
                <button
                  type="button"
                  onClick={beginRace}
                  disabled={!raceSetupReady || o || !I || openingGate || cityMode || cityPreparing}
                  className="flex items-center gap-2 rounded-xl border border-[#DC1A22]/70 bg-[#DC1A22] px-5 py-2.5 font-mono-tech text-[10px] font-bold uppercase tracking-[0.16em] text-white shadow-[0_0_24px_rgba(220,26,34,0.24)] transition-colors hover:bg-[#B9151C] disabled:opacity-50 cursor-pointer"
                ><Flag className="h-3.5 w-3.5" />{raceSetupReady ? "Start Race" : "Preparing…"}</button>
              </div>
            </div>
          </section>
        </div>
      )}
        </>
      )}
        </>
      )}
      <MainMenu
        open={mainMenuOpen}
        musicOn={garageMusicOn}
        lightsOn={garageLightsOn}
        autoOrbit={N}
        graphicsQuality={graphicsQuality}
        onStart={startGame}
        onQuit={quitGame}
        onToggleMusic={toggleGarageMusic}
        onToggleLights={toggleGarageLights}
        onToggleOrbit={toggleOrbit}
        onGraphicsQualityChange={setGraphicsQuality}
      />
      <MainMenu
        open={pauseMenuOpen}
        mode="pause"
        musicOn={garageMusicOn}
        lightsOn={garageLightsOn}
        autoOrbit={N}
        graphicsQuality={graphicsQuality}
        onStart={startGame}
        onResume={resumeGame}
        onQuit={quitGame}
        onQuitToTitle={quitToMainMenu}
        onToggleMusic={toggleGarageMusic}
        onToggleLights={toggleGarageLights}
        onToggleOrbit={toggleOrbit}
        onGraphicsQualityChange={setGraphicsQuality}
      />
      {pendingCar && gameStarted && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-[#030407]/88 p-4 backdrop-blur-md"
          style={{ zIndex: 2147483000, isolation: "isolate" }}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPendingCarId(null);
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="switch-car-title"
            aria-describedby="switch-car-description"
            className="atelier-panel w-full max-w-md rounded-3xl border border-white/12 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.7)] sm:p-8"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="h-10 w-1 rounded-full bg-[#DC1A22] shadow-[0_0_20px_rgba(220,26,34,0.75)]" />
              <div>
                <p className="font-mono-tech text-[10px] uppercase tracking-[0.24em] text-[#DC1A22]">
                  Garage · Vehicle Selection
                </p>
                <h2 id="switch-car-title" className="mt-1 text-xl font-semibold tracking-wide text-white">
                  Switch cars?
                </h2>
              </div>
            </div>
            <p id="switch-car-description" className="text-sm leading-relaxed text-zinc-300">
              Switch from <span className="font-semibold text-white">{g.shortTitle}</span> to{" "}
              <span className="font-semibold text-white">{pendingCar.shortTitle}</span>?
            </p>
            <div className="my-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-mono-tech text-[9px] uppercase tracking-[0.18em] text-zinc-500">Current</p>
                <p className="mt-1 truncate text-sm font-medium text-zinc-200">{g.shortTitle}</p>
              </div>
              <span aria-hidden="true" className="text-[#DC1A22]">→</span>
              <div className="min-w-0 flex-1 text-right">
                <p className="font-mono-tech text-[9px] uppercase tracking-[0.18em] text-zinc-500">Selected car</p>
                <p className="mt-1 truncate text-sm font-medium text-white">{pendingCar.shortTitle}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => setPendingCarId(null)}
                className="min-w-24 rounded-xl border border-white/15 px-5 py-3 font-mono-tech text-xs font-bold uppercase tracking-[0.16em] text-zinc-200 transition-colors hover:border-white/35 hover:bg-white/8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                No
              </button>
              <button
                type="button"
                onClick={confirmCarSwitch}
                className="min-w-24 rounded-xl bg-[#DC1A22] px-5 py-3 font-mono-tech text-xs font-bold uppercase tracking-[0.16em] text-white shadow-[0_0_24px_rgba(220,26,34,0.24)] transition-colors hover:bg-[#B9151C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DC1A22]"
              >
                Yes
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
export default App;

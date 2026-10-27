import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import * as THREE from "three";

const require = createRequire(import.meta.url);

function loadModule(path, dependencyOverrides = {}) {
  const source = fs.readFileSync(path, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const module = { exports: {} };
  vm.runInNewContext(compiled.outputText, {
    module,
    exports: module.exports,
    require: (name) => dependencyOverrides[name] ?? (name === "three" ? THREE : require(name)),
    console,
  });
  return module.exports;
}

const { LiftTimeline, LIFT_TIMING } = loadModule("src/three/liftTimeline.ts");
const { orientCameraGoal, responsiveCameraGoal } = loadModule("src/three/cameraFraming.ts");
const { getNeonPalette } = loadModule("src/three/neonColor.ts");
const raceSessionModule = loadModule("src/three/raceSession.ts");
const raceTrackModule = loadModule("src/three/raceTrack.ts", { "./raceSession": raceSessionModule });
const raceEngineModule = loadModule("src/three/raceEngine.ts", { "./raceTrack": raceTrackModule });
const showroomSource = fs.readFileSync("src/three/Showroom.tsx", "utf8");
const garageGateSource = showroomSource.match(/function GarageGate\([\s\S]*?\n}\n\nfunction ExteriorApron/);
assert(garageGateSource, "The motorized garage gate component must exist");
const gateFrame = garageGateSource[0].match(/useFrame\([\s\S]*?\n\s*},\s*(-?\d+)?\);/);
assert(gateFrame, "The garage gate animation must use a frame callback");
assert(
  gateFrame[1] === undefined || Number(gateFrame[1]) <= 0,
  "The garage gate must not take over R3F's automatic render loop (positive priority blanks the canvas)",
);
assert.equal(getNeonPalette("#CE1318").underglow, "#FF2BD6", "Red paint gets a hot-magenta neon palette");
assert.equal(getNeonPalette("#CE1318").interior, "#B6A3FF", "Red paint gets cool violet cockpit lighting");
assert.equal(getNeonPalette("#EAB60E").underglow, "#FFB52E", "Yellow paint gets an amber neon palette");
assert.equal(getNeonPalette("#0E2D6D").underglow, "#27D8FF", "Blue paint gets an icy cyan neon palette");
assert.equal(getNeonPalette("#F4F4F4").underglow, "#C83DFF", "Neutral paint gets ultraviolet neon");
assert.notEqual(getNeonPalette("#45B879").underglow, "#45B879", "Custom paint gets a contrasting accent");
const vehicleSource = fs.readFileSync("src/three/VehicleModel.tsx", "utf8");
assert.match(vehicleSource, /intensity=\{7\.5\} distance=\{3\.8\}/, "Underglow point lights must be strong enough to read on the floor");
assert.match(vehicleSource, /intensity=\{5\.2\} distance=\{1\.9\}/, "Cockpit lights must illuminate the interior");
assert.match(vehicleSource, /raceDrive\.braking \|\| raceDrive\.handbraking \|\| raceInput\.brake > 0/, "Brake lights must activate for braking, the handbrake, and drift");
assert.match(vehicleSource, /rA\.emissiveIntensity = brakeOrDrift[\s\S]*?: 0;/, "Rear lamps must be dark when not braking or drifting");
assert.doesNotMatch(vehicleSource, /brake \? 5\.5 : on \? 1\.8/, "Rear point glow must not stay on with the headlights");
assert.match(vehicleSource, /position=\{\[0, 0\.014, 0\]\}/, "The underbody glow must sit close to the showroom floor");
assert.match(vehicleSource, /steeringWheelRotation\.setFromAxisAngle\(STEERING_AXIS_Z/, "The steering rim must turn around its steering axis");
assert.match(vehicleSource, /quaternion\.copy\(steeringWheelRotation\)\.multiply\(L\.steeringWheelBaseQuaternion\)/, "The steering rim must retain its authored tilt while steering");
const appSource = fs.readFileSync("src/App.tsx", "utf8");
assert.match(appSource, /React\.useState\("sf90"\)/, "The bundled SF90 must remain the default car");
const gurneyToggle = appSource.match(/const toggleGurney = React\.useCallback\(\(\) => \{([\s\S]*?)\}, \[nA\]\);/);
assert(gurneyToggle, "The gurney toggle must be shared by the garage and technical panels");
assert.match(gurneyToggle[1], /rA\(enabled\)/, "The gurney toggle must update the flap state");
assert.match(gurneyToggle[1], /og\(enabled\)/, "Turning the gurney off must also clear its linked flow lines");
assert.match(showroomSource, /environmentIntensity=\{Q\.envIntensity \* \(lightsOn \? 1 : 0\.16\)\}/, "Garage dark mode must lower environment lighting");
assert.match(showroomSource, /visible=\{garageLightsOn\}/, "Garage dark mode must toggle retained light objects");
assert.match(appSource, /aria-label=\{garageLightsOn \? "Turn garage lights off" : "Turn garage lights on"\}/, "Garage lights need an accessible toggle");
const catalogSource = fs.readFileSync("src/data/catalog.ts", "utf8");
assert.match(catalogSource, /CARS\.find\([\s\S]*?\) \|\| CARS\[0\]/, "Unknown car IDs must fall back to the default model");
assert.doesNotMatch(catalogSource, /id: "overhead"|shortLabel: "Top Plan"/, "The Top Plan camera preset must be removed");
assert.match(appSource, /cA\.key <= "7"/, "Camera shortcuts must match the seven remaining presets");
assert.match(catalogSource, /id: "cockpit",[\s\S]*?position: \[-0\.346, 1\.3, 0\.85\]/, "Cockpit view must pull back behind the steering wheel");
assert.match(appSource, /\[HA, lg\] = React\.useState\(0\)/, "The steering and front wheels must start centered");
assert.match(appSource, /showHotspotPins=\{Wg && !zg && !G\.interior && !raceMode\}/, "Inspection pins must remain available in the remaining camera views");
assert.match(appSource, /Choose a circuit and conditions before starting a race/, "Race should open the circuit and conditions setup first");
const originalTrackLength = raceTrackModule.TRACK_LENGTH;
const originalStart = Array.from(raceTrackModule.samples.slice(0, 3));
assert(raceTrackModule.selectRaceTrack("riviera"), "Riviera race map must be selectable");
assert.equal(raceSessionModule.raceSession.mapId, "riviera");
assert.notEqual(raceTrackModule.TRACK_LENGTH, originalTrackLength, "Riviera must use its own racing line");
assert.notDeepEqual(Array.from(raceTrackModule.samples.slice(0, 3)), originalStart, "Map selection must replace the circuit geometry");
assert(raceTrackModule.selectRaceTrack("alpine"), "Alpine race map must be selectable");
assert.equal(raceSessionModule.raceSession.mapId, "alpine");
assert(raceTrackModule.selectRaceTrack("maranello"), "The default race map must remain selectable");
const raceDirectorSource = fs.readFileSync("src/three/RaceDirector.tsx", "utf8");
const raceEngineSource = fs.readFileSync("src/three/raceEngine.ts", "utf8");
const raceHudSource = fs.readFileSync("src/components/RaceHud.tsx", "utf8");
assert.match(raceDirectorSource, /case "ShiftLeft":[\s\S]*?held\.drift = true/, "Shift must engage the drift handbrake");
assert.match(raceDirectorSource, /case "KeyQ":[\s\S]*?activateTurbo\(\)/, "Q must activate the turbo burst");
assert.match(raceHudSource, /nitroPercentRef[\s\S]*?READY · USE Q/, "The HUD must clearly show turbo charge and when it is ready to use");
assert.match(raceHudSource, /bottom-20 left-3 sm:bottom-24/, "The turbo display must remain visible above the lower control strip");
assert.match(raceHudSource, /scaleY\(\$\{t\.nitro\.toFixed\(3\)\}\)/, "Turbo charge must fill a vertical meter");
assert.match(raceHudSource, /function buildRaceMinimap[\s\S]*?path \+= "Z"/, "The race HUD must draw a closed circuit map from the selected route");
assert.match(raceHudSource, /minimapPlayerRef[\s\S]*?minimapOpponentRefs/, "The minimap must show live player and opponent positions");
assert.doesNotMatch(raceHudSource, /Weather ·|ENVIRONMENTS|setEnvironment|race-recover|Recover car/, "The in-race HUD must not show weather or recovery controls");
assert.match(raceHudSource, /onToggleLights[\s\S]*?aria-pressed=\{lightsOn\}/, "The race HUD must expose an accessible manual headlight switch");
assert.match(raceHudSource, /onToggleBodyGlow[\s\S]*?aria-pressed=\{bodyGlowOn\}/, "The race HUD must expose a separate body-glow switch");
assert.match(raceHudSource, /onToggleInteriorLights[\s\S]*?aria-pressed=\{interiorLightsOn\}/, "The race HUD must expose a separate cabin-light switch");
assert.match(appSource, /const automaticLights = raceSetupEnvironment !== 0/, "Night and Rain/Fog races must start with the vehicle lights on");
assert.match(appSource, /event\.code === "KeyL"[\s\S]*?event\.code === "KeyB"[\s\S]*?event\.code === "KeyI"/, "Race lighting toggles must have matching L, B, and I keyboard shortcuts");
assert.match(appSource, /headlightsOn=\{raceMode \? raceLightsOn : Tg\}/, "Race lights must not change showroom headlight behavior");
assert.match(vehicleSource, /Array\.from\(\{ length: 6 \}/, "Keep all four body and two interior point lights mounted for both modes");
assert.match(vehicleSource, /light\.visible = index < 4 \? bodyEnabled : interiorEnabled/, "The full point-light set must remain independently switchable for body and cabin");
assert.doesNotMatch(vehicleSource, /pooledLightsEnabled/, "Do not suppress the original pooled lights during races");
assert.match(fs.readFileSync("src/three/RaceOpponents.tsx", "utf8"), /raceSession\.carLightsOn/, "AI headlights and taillights must follow the race light setting");
assert.doesNotMatch(raceDirectorSource, /cycleEnvironment|recoverVehicle|KeyE|KeyR/, "Weather cycling and recovery shortcuts must be disabled during a race");
assert.doesNotMatch(raceEngineSource, /export function recoverVehicle/, "The race engine must not expose a recovery action");
assert.match(raceHudSource, /event\.type === "crash"[\s\S]*?triggerCrashImpact/, "Barrier crashes must produce an impact response");
assert.match(raceEngineSource, /const cleanDriving =[\s\S]*?linePrecision > 0 &&[\s\S]*?slipPrecision > 0/, "Turbo charge must reward precise line-holding and controlled slip");
assert.doesNotMatch(raceEngineSource, /nitroCooldown|nitroLocked|crashLock|crashTurboLockout/, "Turbo must recharge through driving, not a timed cooldown");
assert.match(raceEngineSource, /vehicle\.nitro = 0;[\s\S]*?vehicle\.boostTimer = 0;/, "A crash must cancel boost and drain the remaining turbo reserve");
assert.equal(raceEngineModule.CAR.slideDrag, 0.004, "Lateral tyre scrub must not drain speed sharply during normal turns");
for (const steer of [1, -1]) {
  raceEngineModule.startRaceSequence();
  for (let frame = 0; frame < 190; frame++) raceEngineModule.stepRace(1 / 60);
  raceEngineModule.raceInput.throttle = 1;
  raceEngineModule.raceInput.steer = steer;
  for (let frame = 0; frame < 90; frame++) raceEngineModule.stepRace(1 / 60);
  assert(raceEngineModule.raceTelemetry.speedKph > 45, "Left and right steering should retain speed through a clean turn");
  assert(raceEngineModule.raceTelemetry.crashFx === 0, "Normal steering must not trigger a barrier crash on the opening straight");
}
const initialWeather = raceSessionModule.raceSession.envIndex;
const initialMap = raceSessionModule.raceSession.mapId;
assert.deepEqual(
  Array.from(raceSessionModule.ENVIRONMENTS, (environment) => environment.id),
  ["day", "night", "rain"],
  "Automatic race lights must map to Night and Rain/Fog, but not Day",
);
assert.equal(raceSessionModule.raceSession.carLightsOn, false, "Race lights must default off until the selected weather is applied");
raceSessionModule.setRaceLightsEnabled(true);
assert.equal(raceSessionModule.raceSession.carLightsOn, true, "The in-race lights switch must enable car lights");
raceSessionModule.setRaceLightsEnabled(false);
assert.equal(raceSessionModule.raceSession.carLightsOn, false, "The in-race lights switch must disable car lights");
raceSessionModule.setEnvironment(0);
assert.equal(raceSessionModule.raceSession.envIndex, 0, "Weather can be selected before a race begins");
raceSessionModule.lockRaceConditions(true);
raceSessionModule.setEnvironment(2);
raceSessionModule.setRaceMap("alpine");
assert.equal(raceSessionModule.raceSession.envIndex, 0, "Weather must remain locked after race start");
assert.equal(raceSessionModule.raceSession.mapId, initialMap, "The chosen route must remain locked after race start");
raceSessionModule.lockRaceConditions(false);
raceSessionModule.setEnvironment(initialWeather);
raceSessionModule.setRaceMap(initialMap);
raceEngineModule.startRaceSequence();
for (let frame = 0; frame < 190; frame++) raceEngineModule.stepRace(1 / 60);
assert.equal(raceEngineModule.racePhase(), "racing", "The standing countdown must reach the race phase");
raceEngineModule.raceInput.throttle = 0.25;
function steerAlongTrack() {
  const probe = raceTrackModule.projectOnTrackFull(raceEngineModule.raceDrive.x, raceEngineModule.raceDrive.z);
  const target = raceTrackModule.headingAt(probe.index, probe.blend);
  const error = Math.atan2(
    Math.sin(target - raceEngineModule.raceDrive.heading),
    Math.cos(target - raceEngineModule.raceDrive.heading),
  );
  raceEngineModule.raceInput.steer = Math.max(-1, Math.min(1, error * 1.5 - probe.lateral * 0.1));
}
for (let frame = 0; frame < 80; frame++) {
  steerAlongTrack();
  raceEngineModule.stepRace(1 / 60);
}
assert(raceEngineModule.raceTelemetry.speedKph > 10, "The car must be moving before turbo can fire");
assert(raceEngineModule.activateTurbo(), "A charged turbo must fire while driving forward");
assert.equal(raceEngineModule.raceTelemetry.nitro, 0, "Turbo must consume its finite charge");
assert.equal(raceEngineModule.raceTelemetry.turboReady, false, "Turbo must not be unlimited after firing");
assert.equal(raceEngineModule.activateTurbo(), false, "Turbo cannot fire again before its driving-earned charge returns");
for (let frame = 0; frame < 900; frame++) {
  steerAlongTrack();
  raceEngineModule.stepRace(1 / 60);
}
assert.equal(raceEngineModule.raceTelemetry.nitroActive, false, "A turbo burst must expire instead of running forever");
assert(raceEngineModule.raceTelemetry.nitro > 0.99, "Precise clean driving must refill the turbo charge");
assert.equal(raceEngineModule.raceTelemetry.turboReady, true, "A fully recharged turbo must become available again");
assert(raceEngineModule.activateTurbo(), "A recharged turbo must fire again without a timed cooldown");
assert.equal(raceEngineModule.racePhase(), "racing", "Using turbo must leave the race running");
const timeline = new LiftTimeline();
const phases = new Set();
timeline.begin(1);
timeline.markReady(1);
let previousHeight = timeline.y;
let maxYawStep = 0;
let previousYaw = timeline.yaw;
for (let frame = 0; timeline.animating && frame < 9000; frame++) {
  timeline.step(1 / 60);
  phases.add(timeline.phase);
  assert(timeline.y >= previousHeight - 1e-8, "An entrance must only ascend");
  const turn = Math.abs(timeline.yaw - previousYaw);
  maxYawStep = Math.max(maxYawStep, Math.min(turn, Math.abs(turn - Math.PI * 2)));
  previousHeight = timeline.y;
  previousYaw = timeline.yaw;
}
assert.equal(timeline.phase, "done");
assert.equal(timeline.y, 0);
assert.equal(timeline.yaw, 0);
assert(phases.has("ascending") && phases.has("settle") && phases.has("showcase"));
assert(!phases.has("descending"));
assert(maxYawStep * 60 < 0.2, "The automatic turn must remain slow");

timeline.begin(2);
assert.equal(timeline.y, -LIFT_TIMING.depth);
assert.equal(timeline.phase, "arming");
timeline.markReady(1);
timeline.step(0.01);
assert.equal(timeline.phase, "arming", "An old asset must not start the new entrance");
timeline.markReady(2);
while (timeline.phase !== "showcase") timeline.step(1 / 60);
for (let i = 0; i < 300; i++) timeline.step(1 / 60);
const pausedYaw = timeline.yaw;
timeline.pauseShowcase();
for (let i = 0; i < 60; i++) timeline.step(1 / 60);
assert.equal(timeline.yaw, pausedYaw, "Taking control must not unwind or snap the car");
assert.equal(timeline.phase, "done");

const overview = { position: [-4.65, 2.3, -5.15], target: [0, 0.48, 0.05], fov: 40, overview: true };
const distance = (goal) => Math.hypot(...goal.position.map((v, i) => v - goal.target[i]));
assert(distance(overview) > 6.8);
assert.equal(responsiveCameraGoal(overview, 1.8), overview);
const portrait = responsiveCameraGoal(overview, 0.5);
assert(distance(portrait) > distance(overview) * 2);
const turned = orientCameraGoal(overview, Math.PI);
assert(Math.abs(turned.position[0] + overview.position[0]) < 1e-8);
assert(Math.abs(distance(turned) - distance(overview)) < 1e-8);

// Legacy files still have broad type suppressions. Check unresolved names there
// too, so an undefined frame callback can never silently blank the canvas again.
const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
const host = ts.createCompilerHost(parsed.options);
const read = host.readFile;
host.readFile = (file) => {
  const text = read(file);
  return file.includes("/src/") && text ? text.replace(/^\/\/ @ts-nocheck\s*\n/, "") : text;
};
const program = ts.createProgram(parsed.fileNames, parsed.options, host);
const unsafeNames = ts
  .getPreEmitDiagnostics(program)
  .filter((item) => [2304, 2552, 2448].includes(item.code));
assert.equal(
  unsafeNames.length,
  0,
  ts.formatDiagnosticsWithColorAndContext(unsafeNames, {
    getCurrentDirectory: () => process.cwd(),
    getCanonicalFileName: (file) => file,
    getNewLine: () => "\n",
  }),
);

console.log(
  "PASS: showroom and steering regressions, automatic headlights, full body/cabin lights and hotkeys, weather lock, vertical turbo HUD, minimap, drift, and turbo recharging.",
);

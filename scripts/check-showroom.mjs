import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import * as THREE from "three";

const require = createRequire(import.meta.url);

function loadModule(path) {
  const source = fs.readFileSync(path, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const module = { exports: {} };
  vm.runInNewContext(compiled.outputText, {
    module,
    exports: module.exports,
    require: (name) => (name === "three" ? THREE : require(name)),
    console,
  });
  return module.exports;
}

const { LiftTimeline, LIFT_TIMING } = loadModule("src/three/liftTimeline.ts");
const { orientCameraGoal, responsiveCameraGoal } = loadModule("src/three/cameraFraming.ts");
const { getNeonPalette } = loadModule("src/three/neonColor.ts");
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
assert.match(catalogSource, /id: "overhead",[\s\S]*?position: \[0\.02, 10\.5, 0\.45\]/, "Top Plan must frame the full car from above");
assert.match(catalogSource, /id: "cockpit",[\s\S]*?position: \[-0\.346, 1\.3, 0\.85\]/, "Cockpit view must pull back behind the steering wheel");
assert.match(appSource, /\[HA, lg\] = React\.useState\(0\)/, "The steering and front wheels must start centered");
assert.match(appSource, /showHotspotPins=\{Wg && !zg && !G\.interior && !raceMode && U !== "overhead"\}/, "Top Plan must hide floating inspection pins");
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
  "PASS: top-plan and cockpit framing, synchronized steering, garage-light dimmer, gurney-linked flow lines, paint-matched neon, default-car fallback, render-loop safety, lift continuity, and unresolved-name checks.",
);

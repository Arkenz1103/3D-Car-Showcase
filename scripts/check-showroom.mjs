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
  "PASS: ascent-only entrances, full slow rotation, pause/replay, stale-load guards, responsive framing, and unresolved-name checks.",
);

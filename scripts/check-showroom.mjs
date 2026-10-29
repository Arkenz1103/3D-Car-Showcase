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
const automaticLift = new LiftTimeline();
automaticLift.begin(1);
automaticLift.markReady(1);
automaticLift.step(1 / 60);
assert.equal(automaticLift.phase, "hold", "The entrance should prepare after the user starts it and the model is ready");
for (let frame = 0; frame < 20 && automaticLift.phase !== "ascending"; frame++) automaticLift.step(0.1);
assert.equal(automaticLift.phase, "ascending", "The lift timeline must rise after the user authorizes its start");
const driveLift = new LiftTimeline();
driveLift.prepareForDrive();
assert.equal(driveLift.y, 0, "City driving must settle the garage lift to road level");
assert.equal(driveLift.phase, "done", "The garage lift must stop animating during city driving");
const alignmentLift = new LiftTimeline();
assert.equal(alignmentLift.alignForDrive(), true, "Starting Drive must animate the elevator toward the exit-facing orientation");
assert.equal(alignmentLift.phase, "drive-align", "The lift must expose its drive-alignment phase");
const alignmentStartYaw = alignmentLift.yaw;
alignmentLift.step(0.1);
assert.notEqual(alignmentLift.yaw, alignmentStartYaw, "The turntable must rotate gradually during Drive preparation");
assert.notEqual(alignmentLift.yaw, Math.PI, "Drive alignment must not snap directly to its target angle");
for (let frame = 0; frame < 500 && alignmentLift.animating; frame++) alignmentLift.step(1 / 60);
assert.equal(alignmentLift.phase, "done", "Drive may proceed after the turntable finishes aligning");
assert.equal(alignmentLift.y, 0, "The elevator must finish at road height");
assert.equal(alignmentLift.yaw, Math.PI, "The car must finish facing out through the garage gate");
assert.equal(alignmentLift.alignForDrive(), false, "An already aligned lift should not force another turn");
const { orientCameraGoal, responsiveCameraGoal } = loadModule("src/three/cameraFraming.ts");
const { getNeonPalette } = loadModule("src/three/neonColor.ts");
const { isBrakeLightSurface } = loadModule("src/three/brakeLights.ts");
assert(isBrakeLightSurface("Taillight_Brake_Rings", "Taillight_Glass"), "SF90 brake rings must be selected as brake lamps");
assert(isBrakeLightSurface("Object_115", "lamp_rear_emitter"), "Aventador rear emitters must be selected as brake lamps");
assert(isBrakeLightSurface("Object_35", "rear_lights"), "McLaren rear-light mesh must be selected as a brake lamp");
assert(!isBrakeLightSurface("Steering_Shift_LEDs_Manettino", "Taillight_Glass"), "SF90 steering LEDs must not light when braking");
assert(!isBrakeLightSurface("Object_114", "lamp_rear_housing"), "Aventador lamp housings must not be mistaken for brake emitters");
for (const [assetFile, expectedCount] of [["car-2.ts", 3], ["car-3.ts", 1], ["sf90-stradale.ts", 4]]) {
  const source = fs.readFileSync(`src/assets/models/${assetFile}`, "utf8");
  const base64 = source.match(/base64,([A-Za-z0-9+/=]+)/)?.[1];
  assert(base64, `${assetFile} must remain an embedded GLB`);
  const glb = Buffer.from(base64, "base64");
  const jsonLength = glb.readUInt32LE(12);
  const gltf = JSON.parse(glb.subarray(20, 20 + jsonLength).toString().trim());
  const brakeSurfaceCount = gltf.nodes.reduce((count, node) => {
    if (node.mesh === undefined) return count;
    const materials = gltf.meshes[node.mesh].primitives.map((primitive) => gltf.materials[primitive.material]?.name || "");
    return count + materials.filter((materialName) => isBrakeLightSurface(node.name || "", materialName)).length;
  }, 0);
  assert.equal(brakeSurfaceCount, expectedCount, `${assetFile} must map its own designed rear brake-light surfaces`);
}
const raceSessionModule = loadModule("src/three/raceSession.ts");
const raceTrackModule = loadModule("src/three/raceTrack.ts", { "./raceSession": raceSessionModule });
const raceEngineModule = loadModule("src/three/raceEngine.ts", { "./raceTrack": raceTrackModule });
const cityLayoutModule = loadModule("src/three/cityLayout.ts");
assert(cityLayoutModule.CITY_BUILDINGS.length >= 45, "The open city should have a dense, varied block layout");
assert(cityLayoutModule.CITY_SKYLINE.length >= 20, "The city should frame its routes with a distant harbour skyline");
assert(cityLayoutModule.CITY_WINDOWS.length + cityLayoutModule.CITY_WINDOWS_WARM.length >= 8000, "Building facades should have instanced window detail");
assert(cityLayoutModule.CITY_TREE_CANOPIES.length >= cityLayoutModule.CITY_TREE_TRUNKS.length * 2, "Street trees should use layered canopies rather than single low-detail blobs");
assert(cityLayoutModule.CITY_PARKS.length >= 10 && cityLayoutModule.CITY_HILLS.length >= 10, "The city should include landscaped pocket parks and natural hills");
for (const road of cityLayoutModule.CITY_ROADS) {
  for (let segment = 0; segment < road.points.length - 1; segment++) {
    const a = road.points[segment];
    const b = road.points[segment + 1];
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z));
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      assert.equal(cityLayoutModule.isCityBuildingAt(x, z), false, `Buildings must not intrude on the ${road.id} driving centerline`);
    }
  }
}
const cityDriveModule = loadModule("src/three/cityDrive.ts", { "./raceEngine": raceEngineModule, "./cityLayout": cityLayoutModule });
const cityDriveSource = fs.readFileSync("src/three/cityDrive.ts", "utf8");
const cityHudSource = fs.readFileSync("src/components/CityHud.tsx", "utf8");
const cityDirectorSource = fs.readFileSync("src/three/CityDriveDirector.tsx", "utf8");
const raceAudioSource = fs.readFileSync("src/three/raceAudio.ts", "utf8");
const showroomSource = fs.readFileSync("src/three/Showroom.tsx", "utf8");
const appSource = fs.readFileSync("src/App.tsx", "utf8");
const garageGateSource = showroomSource.match(/function GarageGate\([\s\S]*?\n}\n\nfunction ExteriorApron/);
assert(garageGateSource, "The motorized garage gate component must exist");
assert.match(appSource, /onClick=\{enterCityDrive\}[\s\S]*aria-pressed=\{cityMode \|\| driveReady\}/, "The garage view must provide an accessible Drive on/off/armed switch");
assert.match(appSource, /\$\{cityMode \|\| driveReady \? "ON" : "OFF"\}/, "The Drive control must visibly indicate its ready/on state");
assert.match(appSource, /const openGarageForCity[\s\S]*setCityExteriorVisible\(true\)[\s\S]*setGarageGateOpen\(true\)/, "Opening the garage gate must reveal the city outside from the garage view");
assert.match(appSource, /cityDriveMode=\{cityExteriorVisible\}[\s\S]*<OpenCityWorld visible=\{cityExteriorVisible\} driving=\{cityMode\}/, "Opening the gate must reveal the exterior without replacing the garage backdrop");
assert.match(showroomSource, /<color attach="background" args=\{\[Q\.bgHex\]\}/, "The garage background must remain unchanged when the gate opens");
assert.match(showroomSource, /<fog attach="fog" args=\{\[Q\.fogHex, 22, 55\]\}/, "The garage fog must remain unchanged when the gate opens");
const cityWorldSource = fs.readFileSync("src/three/CityWorld.tsx", "utf8");
assert.match(cityWorldSource, /City_Sky_Backdrop[\s\S]*meshBasicMaterial color="#9fc5d9" side=\{BackSide\}[^>]*depthTest=\{false\}[^>]*fog=\{false\}/, "The exterior sky must render behind the garage and city meshes without black holes");
assert.match(cityWorldSource, /City_Ground[\s\S]*planeGeometry args=\{\[470, CITY_GROUND_LENGTH\]\}/, "The city ground must be a flat surface without a blocking vertical box edge");
assert.match(cityWorldSource, /new MeshStandardMaterial\(\{[^}]*fog \}\)/, "City instances must not inherit the garage's dark fog");
assert.match(cityWorldSource, /position=\{\[-42, 72, -48\]\}/, "Daylight must illuminate the city-facing building fronts");
assert.match(cityWorldSource, /const outside = driving && cityDrive\.z > 19/, "City lighting must wait until the camera has cleared the garage doorway");
const mainMenuSource = fs.readFileSync("src/components/MainMenu.tsx", "utf8");
assert.match(appSource, /const \[mainMenuOpen, setMainMenuOpen\] = React\.useState\(true\)/, "The game should open on its main menu");
assert.match(appSource, /!mainMenuOpen && \(startGameLoading \|\| \(o && !I\)\)/, "The loading screen must stay hidden until Start Game is pressed");
assert.match(appSource, /\{gameStarted && \([\s\S]*?<Canvas/, "The showroom scene must not mount until Start Game is pressed");
assert.match(appSource, /const startGame = React\.useCallback\(\(\) => \{[\s\S]*setStartGameLoading\(true\)[\s\S]*l\(true\)[\s\S]*setGameStarted\(true\)[\s\S]*setMainMenuOpen\(false\)/, "Every Start Game action must begin a loading screen before revealing the showroom");
const loadingScreenSource = fs.readFileSync("src/components/LoadingScreen.tsx", "utf8");
assert.match(loadingScreenSource, /useState\(1\)/, "The loading counter must begin at one percent");
assert.match(loadingScreenSource, /LOADING_DURATION_MS = 1800[\s\S]*Math\.min\(100, 1 \+ Math\.floor/, "The loading counter must animate upward and stop at one hundred percent");
assert.match(loadingScreenSource, /Loading \{progress\}%/, "The loading screen must show the live percentage");
assert.match(loadingScreenSource, /if \(!assetReady \|\| progress < 100\) return/, "The loading screen must remain until both assets and 100 percent are ready");
assert.match(appSource, /<MainMenu[\s\S]*onStart=\{startGame\}[\s\S]*onQuit=\{quitGame\}/, "The menu must connect its Start Game and Quit Game actions to the app");
const homeMenuSource = mainMenuSource.slice(mainMenuSource.indexOf('{screen === "home"'), mainMenuSource.indexOf('{screen === "settings"'));
assert.match(homeMenuSource, /onClick=\{beginGame\}[\s\S]*Start Game[\s\S]*Settings[\s\S]*Quit Game/, "The main menu must offer only Start Game, Settings and Quit Game");
assert.doesNotMatch(homeMenuSource, /Current session|Selected vehicle|Quick controls|LOADING|Initializing/, "The main menu must not include loading or garage HUD content");
assert.match(mainMenuSource, /label: "Performance"[\s\S]*label: "Balanced"[\s\S]*label: "High fidelity"/, "Settings must provide performance, balanced and high-fidelity graphics presets");
assert.match(mainMenuSource, /Garage music[\s\S]*Garage lighting[\s\S]*Auto-orbit camera[\s\S]*Controls/, "Settings must expose practical audio, lighting, camera and control options");
assert.match(appSource, /cA\.key === "Escape"[\s\S]*setPauseMenuOpen\(true\)/, "Escape in the garage must open the pause menu");
assert.match(appSource, /!pauseMenuOpen && !pendingCar && \([\s\S]*MainMenu/, "The pause menu and car confirmation must hide garage HUD controls while open");
assert.match(appSource, /mode="pause"[\s\S]*onResume=\{resumeGame\}[\s\S]*onQuitToTitle=\{quitToMainMenu\}/, "The garage pause menu must support resume and quit-to-title actions");
assert.match(mainMenuSource, /if \(mode === "pause"\) onResume\?\.\(\)[\s\S]*mode === "pause" \? "Resume Game" : "Start Game"/, "The pause menu's primary action must resume the showroom");
assert.match(appSource, /shadows=\{!raceMode && graphicsQuality !== "low"\}[\s\S]*dpr=\{raceMode \? 1 : graphicsQuality === "low"/, "Race rendering must use native pixel density and skip the expensive shadow map for stability");
assert.match(showroomSource, /lightsOn=\{garageLightsOn \|\| cityDriveMode\}/, "Garage lights must not dim global environment lighting while city driving is visible");
assert.match(showroomSource, /cityDriveMode \? 0\.36 : garageLightsOn \? 0\.52 : 0\.18/, "Garage light toggles must not darken the open city");
const garageCarDisplaysSource = fs.readFileSync("src/three/GarageCarDisplays.tsx", "utf8");
assert.match(appSource, /<GarageCarDisplays activeCarId=\{Q\} onSelectCar=\{SA\}/, "Other bundled supercars should be staged in the garage and selectable");
assert.match(garageCarDisplaysSource, /await loadVehicleAsset\([\s\S]*?car,/, "Garage display and race models should use the shared bundled-asset cache");
assert.match(garageCarDisplaysSource, /requestIdleCallback[\s\S]*idleId = window\.requestIdleCallback\(loadNext/, "Display-car assets should be scheduled during browser idle time");
assert.match(garageCarDisplaysSource, /if \(!cancelled && index < CARS\.length\) scheduleNext/, "Garage display assets must warm sequentially to avoid competing decode hitches");
assert.match(garageCarDisplaysSource, /CARS\.filter\(\(car\) => car\.id !== activeCarId && assets\[car\.id\]\)/, "The garage displays the other cars without duplicating the selected elevator car");
const carSwitchRequest = appSource.match(/SA = React\.useCallback\(([\s\S]*?)\n\s*\),\n\s*confirmCarSwitch/);
assert(carSwitchRequest, "Clicking a different displayed car must stage a selection request");
assert.match(carSwitchRequest[1], /setPendingCarId\(x\)/, "A clicked car must await confirmation before selection");
assert.doesNotMatch(carSwitchRequest[1], /\bA\(x\)/, "A click must not immediately change the selected car");
assert.match(appSource, /confirmCarSwitch = React\.useCallback\(\(\) => \{[\s\S]*A\(nextCarId\)[\s\S]*P\(null\)[\s\S]*j\(null\)[\s\S]*W\(false\)/, "Confirming a car switch must preserve the existing selection-reset behavior");
assert.match(appSource, /role="alertdialog"[\s\S]*aria-labelledby="switch-car-title"[\s\S]*Switch from[\s\S]*pendingCar\.shortTitle[\s\S]*>\s*No\s*<[\s\S]*onClick=\{confirmCarSwitch\}[\s\S]*>\s*Yes\s*</, "Car switching must show an accessible Yes/No confirmation with the current and requested cars");
assert.match(appSource, /onClick=\{\(\) => setPendingCarId\(null\)\}[\s\S]*>\s*No\s*</, "No must cancel without changing the selected car");
assert.match(appSource, /!pauseMenuOpen && !pendingCar && \(/, "The garage HUD must be hidden while the car confirmation is open");
assert.match(appSource, /style=\{\{ zIndex: 2147483000, isolation: "isolate" \}\}/, "The car confirmation must be layered above every garage control");
assert.match(cityDriveSource,  /topSpeedKph: 340[\s\S]*zeroTo100Kph: 2\.5[\s\S]*gearRedlineKph: \[[^\]]{20,}\]/, "SF90 city performance must use its model-specific acceleration, top speed and 8-speed gearing");
assert.match(cityDriveSource, /topSpeedKph: 350[\s\S]*zeroTo100Kph: 2\.9[\s\S]*gearRedlineKph: \[[^\]]+\]/, "Aventador city performance must use its model-specific acceleration, top speed and 7-speed gearing");
assert.match(cityHudSource, /shiftCityGear\(-1\)[\s\S]*shiftCityGear\(1\)[\s\S]*Drive controls[\s\S]*Downshift[\s\S]*Upshift/, "City HUD must provide manual paddle controls and a visible keyboard legend");
assert.match(cityDirectorSource, /KeyQ[\s\S]*shiftCityGear\(-1\)[\s\S]*KeyE[\s\S]*shiftCityGear\(1\)/, "City driving must support keyboard paddle shifts");
assert.match(cityDirectorSource, /KeyN[\s\S]*selectCityGear\(0\)[\s\S]*KeyR[\s\S]*selectCityGear\(-1\)[\s\S]*KeyI[\s\S]*toggleEngineWithSound/, "City driving must provide neutral, reverse and ignition keyboard controls");
assert.match(cityHudSource, /Start engine[\s\S]*Select neutral[\s\S]*Select reverse/, "The HUD must expose ignition and neutral/reverse gear controls");
assert.match(raceAudioSource, /export function playEngineStartSound[\s\S]*starter[\s\S]*catchFire[\s\S]*stopEngineStartSound/, "The synthesized ignition sound must include starter cranking and engine catch phases");
assert.match(cityHudSource, /handleEngineToggle[\s\S]*playEngineStartSound/, "Starting the engine from the HUD must trigger the ignition sound");
assert.match(raceAudioSource, /export function startGarageTheme[\s\S]*const bpm = 92[\s\S]*export function stopGarageTheme/, "The garage must have an original, procedurally generated looping theme");
assert.match(appSource, /garageMusicOn[\s\S]*toggleGarageMusic[\s\S]*Turn garage theme music off/, "The garage theme must have an accessible on/off control");
assert.match(appSource, /CityDriveDirector carId=\{Q\}/, "Free-drive performance must follow the selected car model");
assert.match(appSource, /setGarageGateOpen\(true\)[\s\S]*setCityMode\(true\)/,  "City mode must only begin after the gate-opening transition");
assert.match(appSource, /liftTimeline\.alignForDrive\(Math\.PI\)/, "Drive ON must start the slow turntable alignment toward the garage gate");
assert.match(appSource, /if \(alignmentNeeded\) playLiftServoSound\(\)/, "The elevator sound must play only while the turntable is rotating");
assert.match(fs.readFileSync("src/three/raceAudio.ts", "utf8"), /export function playLiftServoSound[\s\S]*context\.destination[\s\S]*hissFilter/, "The turntable must use a synthesized servo-and-hydraulic sound without downloaded assets");
const vehicleModelSource = fs.readFileSync("src/three/VehicleModel.tsx", "utf8");
assert.doesNotMatch(vehicleModelSource, /BA\.material\.emissive\.lerp\(/, "Selecting a car component must not tint the clicked car red");
const liftDirectorSource = fs.readFileSync("src/three/LiftDirector.tsx", "utf8");
assert.match(liftDirectorSource, /LIFT_TIMING\.ascend - liftTimeline\.elapsed[\s\S]*playLiftServoSound\(remaining, "ascend"\)[\s\S]*LIFT_TIMING\.showcase - liftTimeline\.elapsed[\s\S]*playLiftServoSound\(remaining, "showcase"\)/, "Lift ascent and showcase rotation must each have phase-synced audio");
assert.match(liftDirectorSource, /!startAllowed/, "The lift director must stay parked until the Lift the Car button is activated");
assert.match(appSource, /fixed inset-0 z-30[\s\S]*onClick=\{replayEntrance\}[\s\S]*Lift the Car/, "A prominent Lift the Car button must be visible before the first ascent");
assert.match(appSource, /Best-effort audio startup[\s\S]*initAudio\(\)/, "The site must attempt lift audio during startup where browser policy permits");
assert.match(appSource, /pointerdown[\s\S]*unlockAudioFromGesture\(\)/, "The first user gesture after refresh must unlock audio when browser policy requires it");
assert.match(appSource, /const replayEntrance = React\.useCallback\((?:async )?\(\) => \{[\s\S]*unlockAudioFromGesture\(\)/, "The lift button must unlock audio before replaying the entrance");
assert.match(appSource, /onClick=\{replayEntrance\}[\s\S]*aria-label="Lift the Car"[\s\S]*Lift the Car/, "The showroom must provide a clearly labeled Lift the Car button");
assert.match(appSource, /Keep the garage view and closed gate unchanged while the turntable aligns/);
const driveToggleSource = appSource.match(/const enterCityDrive = React\.useCallback\((?:async )?\(\) => \{([\s\S]*?)\n  \}, \[cityMode, driveReady/);
assert(driveToggleSource, "The Drive switch must have its own preparation flow");
assert.doesNotMatch(driveToggleSource[1], /openGarageForCity\(\)|setGarageGateOpen\(true\)/, "Turning on Drive must not open the gate automatically");
assert.match(appSource, /if \(!driveReady \|\| !garageGateOpen \|\| openingGate \|\| !cityGateReady \|\| !citySceneReady \|\| cityMode\) return;/, "The car must wait for the user-opened gate and ready city scene before driving");
assert.match(appSource, /const toggleGarageGate = React\.useCallback\(\(\) => \{[\s\S]*openGarageForCity\(\)/, "The user-operated gate button must open the gate independently of Drive preparation");
assert.match(appSource, /<LiftDirector entranceSeq=\{E\} startAllowed=\{liftStartRequested\} onDriveAlignmentComplete=\{onCityDriveAlignmentComplete\}/, "The lift timeline must wait for the Lift the Car button and notify the UI when alignment completes");
assert.match(appSource, /<OpenCityWorld[\s\S]*onReady=\{onCitySceneReady\}[\s\S]*<CityDriveDirector/,  "The city scene must be prewarmed before its driving controller starts");
assert.match(fs.readFileSync("src/three/CityWorld.tsx", "utf8"), /gl\.compileAsync\(scene, camera\)/, "City shaders must be compiled during the gate-opening transition");
assert.match(showroomSource, /visible=\{!cityDriveMode\}[\s\S]*<ExteriorApron cityDriveMode=\{cityDriveMode\}/, "City mode must hide the garage's short exterior backdrop");
assert(cityLayoutModule.CITY_BUILDINGS.length >= 16, "The boulevard must have a bounded set of city buildings");
assert(!cityLayoutModule.isCityBuildingAt(0, 0), "The car must have a clear garage exit");
assert(cityLayoutModule.isCityBuildingAt(cityLayoutModule.CITY_BUILDINGS[0].x, cityLayoutModule.CITY_BUILDINGS[0].z), "Building collision data must match the rendered layout");
const roadIds = new Set(cityLayoutModule.CITY_ROADS.map((road) => road.id));
for (const id of ["boulevard", "west-avenue", "east-avenue", "beach-road", "mountain-road", "bridge-road"]) {
  assert(roadIds.has(id), `The connected city network must include ${id}`);
}
assert(cityLayoutModule.CITY_ROADS.length >= 15, "The city must include a connected grid, not only a themed highway");
assert(cityLayoutModule.CITY_START_Z > 10, "The city boulevard must begin outside the garage gate");
assert(cityLayoutModule.isCityGarageExitAt(0, 5), "The short garage apron must remain driveable before the city road begins");
assert(!cityLayoutModule.CITY_MARKINGS.some((marking) => Math.abs(marking.x) < 1 && marking.z < 10), "Road center markings must not extend into the garage interior");
assert(cityLayoutModule.sampleCityRoad(70, 164).distance < 4, "Beach-route collision sampling must match the rendered road");
assert(cityLayoutModule.sampleCityRoad(-100, 342).y > 20, "The mountain road must carry its elevation into driving data");
assert.equal(cityLayoutModule.sampleCityRoad(160, 364).y, 4, "The bridge deck must be elevated above the boulevard grid");
assert.match(cityWorldSource, /createRoadGeometry\(CITY_ROADS\)/, "Every named road must be rendered from the shared network layout");
assert.match(cityWorldSource, /camera\.far = Math\.max\(originalFar, 800\)/, "The city must remain visible through the open gate before Drive is enabled");
assert.match(cityWorldSource, /City_Ocean[\s\S]*Beach_Sand[\s\S]*CITY_HILLS[\s\S]*CITY_BRIDGE_RAILS/, "The beach, mountain and bridge routes must have distinct scenery");
cityDriveModule.startCityDrive("sf90");
assert.equal(cityDriveModule.cityDrive.topSpeedKph, 340, "SF90 free-drive speed must use its 340 km/h published top speed");
assert.equal(cityDriveModule.cityDrive.gearCount, 8, "SF90 free-drive must model its 8-speed DCT");
assert.equal(cityDriveModule.cityDrive.gear, 0, "The free-drive must start safely in neutral");
assert.equal(cityDriveModule.cityDrive.engineRunning, false, "The free-drive engine must start switched off");
assert.equal(cityDriveModule.toggleCityEngine(), true, "The ignition must start the engine while in neutral");
assert.equal(cityDriveModule.cityDrive.engineRunning, true, "Starting the engine must set the running state");
cityDriveModule.cityInput.forward = true;
cityDriveModule.stepCityDrive(0.05);
assert.equal(cityDriveModule.cityDrive.speed, 0, "Throttle in neutral must rev the engine without moving the car");
assert(cityDriveModule.cityDrive.rpm > cityDriveModule.CITY_DRIVE_PROFILES.sf90.idleRpm, "The engine must rev while stationary in neutral");
cityDriveModule.cityInput.forward = false;
assert.equal(cityDriveModule.shiftCityGear(1), true, "The driver must be able to engage first gear from neutral");
assert.equal(cityDriveModule.cityDrive.gear, 1, "The first upshift from neutral must select first gear");
assert.equal(cityDriveModule.shiftCityGear(1), true, "The driver must be able to upshift manually");
assert.equal(cityDriveModule.cityDrive.gear, 2, "Upshifting must change the active gear");
assert(cityDriveModule.cityDrive.shiftTimer > 0, "A sequential shift must include a brief drivetrain torque interruption");
assert.equal(cityDriveModule.cityDrive.shiftFeedback, "UPSHIFT", "A shift must show driver feedback");
cityDriveModule.startCityDrive("aventador");
assert.equal(cityDriveModule.cityDrive.topSpeedKph, 350, "Aventador free-drive speed must use its 350 km/h published top speed");
assert.equal(cityDriveModule.cityDrive.gearCount, 7, "Aventador free-drive must model its 7-speed ISR gearbox");
cityDriveModule.cityDrive.gear = 3;
cityDriveModule.cityDrive.speed = 35;
assert.equal(cityDriveModule.shiftCityGear(-1), false, "Downshifts that would over-rev the selected model must be blocked");
assert.match(cityDriveModule.cityDrive.shiftFeedback, /DOWNSHIFT BLOCKED/, "The HUD must explain why an unsafe downshift was rejected");
cityDriveModule.startCityDrive("mclaren-vgt");
assert.equal(cityDriveModule.cityDrive.topSpeedKph, 391, "The virtual VGT must use its concept-simulation top-speed target");
assert.equal(cityDriveModule.cityDrive.concept, true, "The virtual VGT figures must be marked as concept simulation values");
assert(Object.values(cityDriveModule.CITY_DRIVE_PROFILES).every((profile) => profile.gearRedlineKph.length <= 8), "No car profile should exceed eight forward gears");
cityDriveModule.startCityDrive("sf90");
cityDriveModule.cityDrive.speed = 30;
cityDriveModule.cityInput.brake = true;
cityDriveModule.stepCityDrive(0.05);
assert(cityDriveModule.cityDrive.speed <= 28.61, "The service brake must apply hard deceleration of at least 28 m/s²");
assert(cityDriveModule.cityDrive.speed > 0, "Service braking must decelerate rather than abruptly teleporting the speed to zero");
cityDriveModule.stopCityDrive();
cityDriveModule.startCityDrive("sf90");
cityDriveModule.toggleCityEngine();
cityDriveModule.shiftCityGear(1);
cityDriveModule.cityInput.forward = true;
for (let frame = 0; frame < 10; frame++) cityDriveModule.stepCityDrive(1 / 60);
assert(cityDriveModule.cityDrive.z > 0, "After the short shift interruption the car must drive through the positive-Z garage opening");
for (let frame = 0; frame < 120; frame++) cityDriveModule.stepCityDrive(1 / 60);
assert(cityDriveModule.cityDrive.z > 5, "Holding throttle must take the car outside the garage");
assert(cityDriveModule.cityDrive.speed * 3.6 <= cityDriveModule.CITY_DRIVE_PROFILES.sf90.gearRedlineKph[0] + 0.1, "Manual gear one must stay below its model-specific redline speed");
cityDriveModule.stopCityDrive();
cityDriveModule.startCityDrive("sf90");
Object.assign(cityDriveModule.cityDrive, { x: 15, y: 0.02, z: 30, speed: 18, heading: Math.PI, lastSafeX: 0, lastSafeY: 0.02, lastSafeZ: 30 });
cityDriveModule.cityInput.forward = true;
cityDriveModule.stepCityDrive(1 / 60);
assert(cityDriveModule.cityDrive.speed > 0 && cityDriveModule.cityDrive.speed < 18, "A collision must reduce speed according to impact rather than snapping directly to zero");
assert.equal(cityDriveModule.cityInput.forward, false, "A collision must release held throttle to prevent continued pushing");
cityDriveModule.stopCityDrive();
for (const turn of [
  { z: 110, input: "left", direction: 1, branch: "beach" },
  { z: 204, input: "right", direction: -1, branch: "mountain" }
]) {
  cityDriveModule.startCityDrive();
  Object.assign(cityDriveModule.cityDrive, { x: 0, y: 0.02, z: turn.z, speed: 8, heading: Math.PI, gear: 1, engineRunning: true, shiftTimer: 0, lastSafeX: 0, lastSafeY: 0.02, lastSafeZ: turn.z });
  cityDriveModule.cityInput.forward = true;
  cityDriveModule.cityInput[turn.input] = true;
  for (let frame = 0; frame < 25; frame++) cityDriveModule.stepCityDrive(1 / 60);
  cityDriveModule.cityInput[turn.input] = false;
  for (let frame = 0; frame < 120; frame++) cityDriveModule.stepCityDrive(1 / 60);
  const branchRoad = cityLayoutModule.sampleCityRoad(cityDriveModule.cityDrive.x, cityDriveModule.cityDrive.z);
  assert(turn.direction * cityDriveModule.cityDrive.x > 7, `Steering must let the car turn off the boulevard onto the ${turn.branch} route`);
  assert(branchRoad.distance < branchRoad.width / 2, `The car must remain on the connected ${turn.branch} road`);
  cityDriveModule.stopCityDrive();
}
cityDriveModule.startCityDrive();
Object.assign(cityDriveModule.cityDrive, { x: 150, y: 0, z: 364, speed: 3, heading: Math.PI * 1.5, lastSafeX: 150, lastSafeY: 0, lastSafeZ: 364 });
cityDriveModule.cityInput.forward = true;
cityDriveModule.stepCityDrive(1 / 60);
assert(cityDriveModule.cityDrive.y >= 4, "The vehicle rig must follow the elevated bridge surface");
cityDriveModule.stopCityDrive();
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
assert.match(vehicleSource, /DOOR_B_CLOSED = new Quaternion\(0, Math\.sin\(-0\.465 \/ 2\), 0, Math\.cos\(-0\.465 \/ 2\)\)/, "Aventador right-door closure must retain its local Y correction");
assert.match(vehicleSource, /case "doors_hinge":[\s\S]*case "door_a_hinge":[\s\S]*return DOOR_CLOSED;[\s\S]*case "door_b_hinge":[\s\S]*return DOOR_B_CLOSED/, "Both Aventador doors must use their distinct closed-pose targets");
assert.match(vehicleSource, /doorOpenQuaternions\.push\(Wg\.quaternion\.clone\(\)\)/, "Authored showroom door poses must be preserved");
assert.match(vehicleSource, /racing && racePose \? racePose : L\.doorOpenQuaternions\[index\]/, "Race mode must close the doors and restore showroom poses afterward");
assert.match(vehicleSource, /L\.root\.updateMatrixWorld\(true\)/, "Door pose changes must refresh the model world matrices");
assert.match(vehicleSource, /BODY_UNDERGLOW_INTENSITY = 7\.5[\s\S]*CABIN_AMBIENCE_INTENSITY = 5\.2[\s\S]*length: 6/, "Keep all four body lights and both garage interior lights at their original brightness");
assert.match(vehicleSource, /light\.visible = true;[\s\S]*light\.intensity =/, "Body toggles must update intensity without changing the active-light shader layout");
assert.match(vehicleSource, /intensity=\{0\} distance=\{3\.8\}/, "Underglow lights must mount at zero intensity and be driven by uniforms");
assert.match(vehicleSource, /raceDrive\.braking \|\| raceDrive\.handbraking \|\| raceInput\.brake > 0 \|\| raceInput\.handbrake/, "Brake lights must respond directly to braking and drift inputs");
assert.match(vehicleSource, /racing && L\.taillightEmissiveMats\.length/, "Race braking must light the model's taillight meshes");
assert.match(vehicleSource, /if \(isBrakeLightSurface\(yg\.name, mg\?\.name \|\| ""\)\)[\s\S]*Tg\.push\(eg\)/, "Custom GLB rear lamp surfaces must be registered directly for race braking");
assert.match(vehicleSource, /eg\.toneMapped = false/, "Custom brake lamps must remain vivid under race tone mapping");
assert.match(vehicleSource, /\? 5\.5[\s\S]*: 9\.5/, "Brake-light intensity must remain visible from race camera distance");
assert.match(vehicleSource, /BA\.baseEmissiveIntensity = V \? \(MA \? 1\.85 : 3\.8\) : 0/, "Headlights alone must not illuminate the brake lamps");
assert.doesNotMatch(vehicleSource, /brakeGlow|position=\{\[0, 0\.74, 2\.32\]\}/, "Brake lights must not use a single center-mounted red point light");
assert.match(vehicleSource, /wA = \(BA\) => \{\s*if \(!I\) return;/, "Car clicks must be ignored when race mode disables component selection");
assert.match(vehicleSource, /rA\.emissiveIntensity = brakeOrDrift[\s\S]*?: 0;/, "Rear lamps must be dark when not braking or drifting");
assert.doesNotMatch(vehicleSource, /brake \? 5\.5 : on \? 1\.8/, "Rear point glow must not stay on with the headlights");
assert.match(vehicleSource, /position=\{\[0, 0\.014, 0\]\}/, "The underbody glow must sit close to the showroom floor");
assert.match(vehicleSource, /steeringWheelRotation\.setFromAxisAngle\(STEERING_AXIS_Z/, "The steering rim must turn around its steering axis");
assert.match(vehicleSource, /quaternion\.copy\(steeringWheelRotation\)\.multiply\(L\.steeringWheelBaseQuaternion\)/, "The steering rim must retain its authored tilt while steering");
assert.match(appSource, /selectedComponent=\{raceMode \? null : V\}/, "Race mode must not retain selected-part color highlighting");
assert.match(appSource, /onSelectComponent=\{raceMode \? null : Eg\}/, "Race mode must disable click-to-highlight on the car");
assert.match(appSource, /React\.useState\("sf90"\)/, "The bundled SF90 must remain the default car");
const gurneyToggle = appSource.match(/const toggleGurney = React\.useCallback\(\(\) => \{([\s\S]*?)\}, \[nA\]\);/);
assert(gurneyToggle, "The gurney toggle must be shared by the garage and technical panels");
assert.match(gurneyToggle[1], /rA\(enabled\)/, "The gurney toggle must update the flap state");
assert.match(gurneyToggle[1], /og\(enabled\)/, "Turning the gurney off must also clear its linked flow lines");
assert.match(showroomSource, /environmentIntensity=\{Q\.envIntensity \* \(lightsOn \? 1 : 0\.16\)\}/, "Garage dark mode must lower environment lighting");
assert.match(showroomSource, /intensity=\{garageLightsOn \|\| cityDriveMode \? \(e \? 2\.15 : 2\.55\) : 0\}/, "Garage key lights must not dim the open city when the switch changes");
assert.match(showroomSource, /intensity=\{garageLightsOn \|\| cityDriveMode \? 1\.25 : 0\}/, "Garage fill lights must not dim the open city when the switch changes");
assert.doesNotMatch(showroomSource, /visible=\{garageLightsOn\}/, "Garage light switches must not change active-light shader variants");
assert.match(appSource, /aria-label=\{garageLightsOn \? "Turn garage lights off" : "Turn garage lights on"\}/, "Garage lights need an accessible toggle");
const catalogSource = fs.readFileSync("src/data/catalog.ts", "utf8");
assert.match(catalogSource, /CARS\.find\([\s\S]*?\) \|\| CARS\[0\]/, "Unknown car IDs must fall back to the default model");
assert.doesNotMatch(catalogSource, /id: "overhead"|shortLabel: "Top Plan"/, "The Top Plan camera preset must be removed");
assert.match(appSource, /cA\.key <= "7"/, "Camera shortcuts must match the seven remaining presets");
assert.match(catalogSource, /id: "cockpit",[\s\S]*?position: \[-0\.346, 1\.3, 0\.85\]/, "Cockpit view must pull back behind the steering wheel");
assert.match(appSource, /\[HA, lg\] = React\.useState\(0\)/, "The steering and front wheels must start centered");
assert.match(appSource, /showHotspotPins=\{Wg && !zg && !G\.interior && !raceMode && !cityMode\}/, "Inspection pins must remain available in the remaining camera views");
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
assert.match(raceDirectorSource, /RACE_FRAME_INTERVAL = 1000 \/ 40[\s\S]*setTimeout\(\(\) => \{[\s\S]*state\.invalidate\(\)/, "Demand rendering must cap race updates to 40 fps rather than saturating the browser main thread");
const raceSceneReadySource = raceDirectorSource.slice(raceDirectorSource.indexOf("export const RaceSceneReady"), raceDirectorSource.indexOf("export const RaceVehicleRig"));
assert.match(raceSceneReadySource, /}, 0\);/, "RaceSceneReady must not take over R3F's render loop and leave a stale garage frame on screen");
const raceEngineSource = fs.readFileSync("src/three/raceEngine.ts", "utf8");
const raceHudSource = fs.readFileSync("src/components/RaceHud.tsx", "utf8");
assert.match(raceDirectorSource, /case "ShiftLeft":[\s\S]*?held\.drift = true/, "Shift must engage the drift handbrake");
assert.match(raceDirectorSource, /case "KeyQ":[\s\S]*?activateTurbo\(\)/, "Q must activate the turbo burst");
assert.match(raceHudSource, /nitroPercentRef[\s\S]*?READY · USE Q/, "The HUD must clearly show turbo charge and when it is ready to use");
assert.match(raceHudSource, /bottom-20 left-3 sm:bottom-24/, "The turbo display must remain visible above the lower control strip");
assert.match(raceHudSource, /scaleY\(\$\{t\.nitro\.toFixed\(3\)\}\)/, "Turbo charge must fill a vertical meter");
assert.match(raceHudSource, /function buildRaceMinimap[\s\S]*?path \+= "Z"/, "The race HUD must draw a closed circuit map from the selected route");
assert.match(raceHudSource, /minimapPlayerRef[\s\S]*?minimapOpponentRefs/, "The minimap must show live player and opponent positions");
assert.match(raceHudSource, /now - lastUpdate < 1000 \/ 30/, "Race HUD DOM updates should be capped at 30 Hz to reduce main-thread pressure");
assert.doesNotMatch(raceHudSource, /Weather ·|ENVIRONMENTS|setEnvironment|race-recover|Recover car/, "The in-race HUD must not show weather or recovery controls");
assert.match(raceHudSource, /onToggleLights[\s\S]*?aria-pressed=\{lightsOn\}/, "The race HUD must expose an accessible manual headlight switch");
assert.match(raceHudSource, /onToggleBodyGlow[\s\S]*?aria-pressed=\{bodyGlowOn\}/, "The race HUD must expose a separate body-glow switch");
assert.doesNotMatch(raceHudSource, /onToggleInteriorLights|interiorLightsOn|Cabin ambience/, "The race HUD must not include a cabin-light control");
assert.match(appSource, /const automaticLights = raceSetupEnvironment !== 0/, "Night and Rain/Fog races must start with the vehicle lights on");
assert.match(appSource, /event\.code === "KeyL"[\s\S]*?event\.code === "KeyB"/, "Race lighting toggles must retain L and B keyboard shortcuts");
assert.doesNotMatch(appSource, /KeyI|raceInteriorLights/, "The removed cabin light must not leave a dead keyboard toggle");
assert.match(appSource, /headlightsOn=\{cityMode \? cityHeadlightsOn : raceMode \? raceLightsOn : Tg\}/, "Race lights must not change showroom headlight behavior");
assert.match(vehicleSource, /Array\.from\(\{ length: 6 \}/, "Keep all four body and two garage interior point lights mounted");
assert.match(vehicleSource, /light\.visible = true;[\s\S]*light\.intensity =/, "Keep all point lights mounted and avoid shader-layout changes when toggling them");
assert.match(vehicleSource, /interiorEnabled[\s\S]*CABIN_AMBIENCE_INTENSITY/, "Garage ambience must still power the cabin lights");
assert.match(appSource, /interiorLightsOn=\{!raceMode && !cityMode && neonLightsOn\}/, "Cabin ambience must remain in the garage and stay off in races");
assert.doesNotMatch(vehicleSource, /pooledLightsEnabled/, "Do not suppress the original pooled lights during races");
const raceOpponentsSource = fs.readFileSync("src/three/RaceOpponents.tsx", "utf8");
assert.match(raceOpponentsSource, /raceSession\.carLightsOn/, "AI headlights and taillights must follow the race light setting");
assert.match(raceOpponentsSource, /RACE_OPPONENT_CARS\.slice\(0, AI_COUNT\)/, "Race mode must load the dedicated Porsche and Bugatti opponent models");
assert.match(raceOpponentsSource, /loadVehicleAsset\(null, null, car, \{ accelerateRaycast: false \}\)/, "Non-interactive race models must skip unnecessary raycast BVH work");
assert.match(raceOpponentsSource, /930_lights[\s\S]*headlight_emit[\s\S]*taillight_emit/, "Opponent lights must use the models' actual headlamp and rear lamp geometry");
assert.match(raceOpponentsSource, /raceAi\.braking\[slot\][\s\S]*tailIntensity = braking \? 5\.8/, "AI rear emitters must brighten only when that opponent brakes");
assert.match(raceOpponentsSource, /raceSession\.carLightsOn[\s\S]*material\.emissiveIntensity = headlightsOn \? 3\.2 : 0/, "Night and Rain/Fog should visibly switch on the opponent headlamp emitters");
assert.match(raceOpponentsSource, /function makeOpponentHeadlightRig[\s\S]*target\.position\.set[\s\S]*spot\.target = target[\s\S]*rig\.add\(target, spot\)/, "Opponent headlights must project real spot beams from scene-attached targets");
assert.match(raceOpponentsSource, /beam\.intensity = headlightsOn \? HEADLIGHT_LOW_BEAM : 0[\s\S]*headlightRig/, "Opponent spot beams and emitters must switch together with race lights");
assert.match(appSource, /<RaceOpponents \/>[\s\S]*<RaceSceneReady onReady=\{onRaceSceneReady\} \/>/, "The race must wait for the mounted scene to warm before dismissing the loading screen");
assert.match(appSource, /setRaceLoading\(true\)[\s\S]*setRaceMode\(true\)/, "Start Race must show a loading overlay before mounting the circuit");
assert.match(appSource, /\{raceLoading && <RaceLoadingScreen sceneReady=\{raceSceneReady\} onComplete=\{onRaceLoadingComplete\} \/>\}/, "A visible loading screen must cover the first expensive race frames until ready and complete");
const raceLoadingScreenSource = fs.readFileSync("src/components/RaceLoadingScreen.tsx", "utf8");
assert.match(raceLoadingScreenSource, /useState\(1\)[\s\S]*next = 1 \+ Math\.floor[\s\S]*next = 92 \+ Math\.floor\(finish \* 8\)[\s\S]*setProgress/, "Race loading must animate the percentage from 1 through 100");
assert.match(raceLoadingScreenSource, /backgroundImage: `linear-gradient[\s\S]*RACE_LOADING_IMAGE[\s\S]*backgroundSize: "cover"/, "Race loading must use a full-screen race image background");
assert.match(raceLoadingScreenSource, /aria-valuemin=\{1\}[\s\S]*aria-valuemax=\{100\}[\s\S]*aria-valuenow=\{progress\}/, "The animated loading bar must expose accessible 1-to-100 progress");
assert.match(raceDirectorSource, /export const RaceSceneReady[\s\S]*setTimeout\(onReady, 900\)/, "The loading screen must remain until the race scene has had time to render and warm");
const raceOpponentCarsSource = fs.readFileSync("src/data/raceOpponentCars.ts", "utf8");
assert.match(raceOpponentCarsSource, /id: "porsche-911-turbo-930"[\s\S]*id: "bugatti-chiron"/, "Both requested supercar models must be in the race-only opponent roster");
assert.match(appSource, /warmRaceCircuit\(raceSetupMap\)[\s\S]*await opponentAssets[\s\S]*setRaceSetupReady\(true\)[\s\S]*requestIdleCallback/, "Race geometry and opponent models must prepare before the Start Race button is enabled");
assert.match(appSource, /disabled=\{!raceSetupReady \|\| o \|\| !I/, "Start Race must wait for track and car preloading to finish");
assert.match(fs.readFileSync("src/three/RaceCircuit.tsx", "utf8"), /export function warmRaceCircuit[\s\S]*circuitData\(\)[\s\S]*selectRaceTrack\(previousMapId\)/, "Race track geometry must be cached while the setup screen is open");
assert.match(raceEngineSource, /braking: new Uint8Array\(AI_COUNT\)[\s\S]*raceAi\.braking\[car\] = speedError < -0\.08/, "AI braking telemetry must drive opponent brake lights without React state");
for (const model of ["porsche-911-turbo-1975.glb", "bugatti-chiron.glb"]) {
  const bytes = fs.readFileSync(`public/models/race/${model}`);
  assert.equal(bytes.toString("ascii", 0, 4), "glTF", `${model} must be a valid bundled GLB`);
  assert(bytes.byteLength < 4_000_000, `${model} must remain compact for race loading`);
}
assert.match(fs.readFileSync("src/lib/gltf.ts", "utf8"), /setMeshoptDecoder\(MeshoptDecoder\)/, "The shared GLTF loader must decode the optimized Porsche meshopt model");
assert.match(raceOpponentsSource, /node\.matrixAutoUpdate = false[\s\S]*node\.castShadow = false[\s\S]*node\.receiveShadow = false[\s\S]*node\.raycast = \(\) => null/, "Static AI models must skip per-part transforms, shadow passes and picking for race performance");
assert.doesNotMatch(raceOpponentsSource, /scale=\{\[1\.9, 0\.5, 4\.3\]\}/, "Race opponents must no longer use blocky box-car bodies");
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
  "PASS: showroom, city gate entry and free-drive, steering, lights, race controls, minimap, drift, and turbo regressions.",
);

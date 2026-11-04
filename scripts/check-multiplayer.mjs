import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/multiplayer.ts", import.meta.url), "utf8");
const profileSource = await readFile(new URL("../src/lib/playerProfile.ts", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const remoteCarsSource = await readFile(new URL("../src/three/MultiplayerRacePlayers.tsx", import.meta.url), "utf8");
const raceModeSource = await readFile(new URL("../src/components/RaceMode.tsx", import.meta.url), "utf8");
const vehicleThumbnailSource = await readFile(new URL("../src/lib/vehicleThumbnails.ts", import.meta.url), "utf8");
const countdownSource = await readFile(new URL("../src/components/OnlineRaceCountdown.tsx", import.meta.url), "utf8");
const raceEngineSource = await readFile(new URL("../src/three/raceEngine.ts", import.meta.url), "utf8");
const raceDirectorSource = await readFile(new URL("../src/three/RaceDirector.tsx", import.meta.url), "utf8");
const raceHudSource = await readFile(new URL("../src/components/RaceHud.tsx", import.meta.url), "utf8");
const javascript = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 });
const profileJavascript = ts.transpile(profileSource, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 });
const channels = new Map();
const storage = new Map();
let idSequence = 0;
let clock = 50;

class MockBroadcastChannel {
  constructor(name) {
    this.name = name;
    this.closed = false;
    if (!channels.has(name)) channels.set(name, new Set());
    channels.get(name).add(this);
  }
  postMessage(data) {
    for (const peer of channels.get(this.name) ?? []) {
      if (peer !== this && !peer.closed) queueMicrotask(() => peer.onmessage?.({ data }));
    }
  }
  close() {
    this.closed = true;
    channels.get(this.name)?.delete(this);
  }
}

function createClient() {
  const module = { exports: {} };
  const context = {
    module,
    exports: module.exports,
    BroadcastChannel: MockBroadcastChannel,
    WebSocket: { OPEN: 1, CLOSING: 2 },
    crypto: {
      randomUUID: () => `mock-player-${++idSequence}`,
      getRandomValues: (bytes) => { bytes.fill(idSequence); return bytes; },
    },
    window: {
      localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, String(value)),
        removeItem: (key) => storage.delete(key),
      },
      setInterval: () => 1,
      clearInterval: () => {},
    },
    performance: { now: () => (clock += 50) },
    Date,
    Math,
    Uint8Array,
    JSON,
    console,
    require: (name) => { throw new Error(`Unexpected runtime import: ${name}`); },
  };
  vm.runInNewContext(javascript, context, { filename: "multiplayer.ts" });
  return module.exports;
}

const host = createClient();
const guest = createClient();
const profile = (displayName) => ({ displayName, level: 1, rank: "ROOKIE" });
const initialSettings = { mapId: "manila", environment: 0, playerIds: [] };
const code = host.createRaceRoom(profile("Host Racer"), "sf90", "", initialSettings);
assert.equal(code.length, 6, "Room codes should be six characters");
assert.equal(host.getMultiplayerSnapshot().roomCode, code, "Creating a room should initialize its active room code");
assert.equal(host.getMultiplayerSnapshot().isHost, true, "The creator should be initialized as room host");
assert.equal(host.getMultiplayerSnapshot().players[0].isHost, true, "The creator roster entry should have host privileges");
const hostId = host.getMultiplayerSnapshot().localPlayerId;
const guestId = guest.getMultiplayerSnapshot().localPlayerId;
assert.notEqual(hostId, guestId, "Each tab must generate a unique in-memory player ID");
const roomStorageKey = `city-speedrunners-room-${code}`;
const hostRoomRecord = storage.get(roomStorageKey);
assert.equal(guest.joinRaceRoom(code.toLowerCase(), profile("Guest Racer"), "gt3"), true, "Preview guest should join the live room");
assert.equal(storage.get(roomStorageKey), hostRoomRecord, "A joining tab must not overwrite the active host room registry entry");
assert.equal(guest.getMultiplayerSnapshot().isHost, false, "A player entering an existing code must be explicitly assigned the guest role");
assert.equal(guest.getMultiplayerSnapshot().players.find((player) => player.id === guestId)?.isHost, false, "The guest's local roster profile must not claim host privileges");
await new Promise((resolve) => setTimeout(resolve, 0));

assert.equal(host.getMultiplayerSnapshot().players.length, 2, "Host should receive the joining player");
assert.equal(guest.getMultiplayerSnapshot().players.length, 2, "Guest should receive the host presence");
assert.equal(host.getMultiplayerSnapshot().players.find((player) => player.id === guestId)?.username, "Guest Racer", "The joining profile should be added to the host's connected driver list");
assert.equal(host.getMultiplayerSnapshot().players.find((player) => player.id === guestId)?.carId, "gt3", "The host driver list should receive the guest's selected car");
assert.equal(host.getMultiplayerSnapshot().players.find((player) => player.id === guestId)?.isHost, false, "The host roster must classify joining players as guests");
assert.equal(guest.getMultiplayerSnapshot().settings?.mapId, "manila", "Room creation settings should be shared with joining players");
const updatedSettings = { mapId: "tokyo", environment: 2, playerIds: [] };
assert.equal(guest.updateLobbySettings(updatedSettings), false, "Guests must not be able to overwrite host match settings");
assert.equal(host.updateLobbySettings(updatedSettings), true, "The host should update lobby settings");
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(guest.getMultiplayerSnapshot().settings?.mapId, "tokyo", "Host edits should synchronize to the lobby");

host.setLocalReady(true);
guest.setLocalReady(true);
await new Promise((resolve) => setTimeout(resolve, 0));
assert.ok(host.getMultiplayerSnapshot().players.every((player) => player.ready), "Ready changes should relay to all peers");
guest.updateLocalPlayer(profile("Guest Racer"), "sf90");
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(host.getMultiplayerSnapshot().players.find((player) => player.id === guest.getMultiplayerSnapshot().localPlayerId)?.ready, false, "Changing car should clear that driver's ready flag");
guest.setLocalReady(true);
await new Promise((resolve) => setTimeout(resolve, 0));

const pose = { x: 12, y: 1, z: -5, pitch: 0.01, heading: 1.2, roll: 0, speed: 28 };
host.publishRacePose(pose);
await new Promise((resolve) => setTimeout(resolve, 0));
assert.deepEqual(JSON.parse(JSON.stringify(guest.getMultiplayerSnapshot().players[0].pose)), pose, "Remote position, rotation and speed should synchronize");

let receivedStart = null;
guest.subscribeMultiplayerEvents((event) => { receivedStart = event; });
const settings = { mapId: "tokyo", environment: 2, playerIds: [host.getMultiplayerSnapshot().localPlayerId, guest.getMultiplayerSnapshot().localPlayerId] };
const countdownDelayMs = 1_500;
assert.equal(host.startOnlineRace(settings, countdownDelayMs), true, "Room host should start the race");
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(receivedStart?.type, "start", "Race start should reach the guest");
assert.equal(receivedStart?.settings?.playerIds.length, 2, "Race start should include deterministic grid order");
assert.equal(receivedStart?.countdownDelayMs, countdownDelayMs, "All peers should receive the same countdown delay");
assert.ok(Number.isFinite(receivedStart?.countdownStartAt), "Host should publish a shared lobby countdown timestamp");
assert.equal(host.getMultiplayerSnapshot().settings?.playerIds.join(","), settings.playerIds.join(","), "The randomized host grid order should be shared in room settings");
let hostRaceCountdown = null;
let guestRaceCountdown = null;
host.subscribeMultiplayerEvents((event) => { if (event.type === "raceCountdown") hostRaceCountdown = event; });
guest.subscribeMultiplayerEvents((event) => { if (event.type === "raceCountdown") guestRaceCountdown = event; });
host.markLocalRaceGridReady();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(hostRaceCountdown, null, "Host should wait until every participating client has loaded its grid");
guest.markLocalRaceGridReady();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(hostRaceCountdown?.type, "raceCountdown", "Host should broadcast the shared traffic-light start after all players are ready");
assert.equal(guestRaceCountdown?.type, "raceCountdown", "The race start signal should reach each participating client");
assert.ok(hostRaceCountdown.raceStartAt >= Date.now() + 6_000, "Host timestamp should leave room for the synchronized five-light countdown");
assert.ok(Math.abs(hostRaceCountdown.raceStartAt - guestRaceCountdown.raceStartAt) < 100, "All clients should use the same synchronized green-light timestamp");

host.disconnectRaceRoom();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(guest.getMultiplayerSnapshot().players.length, 1, "Leaving should remove the peer from the lobby");
guest.disconnectRaceRoom();

const profileModule = { exports: {} };
vm.runInNewContext(profileJavascript, {
  module: profileModule,
  exports: profileModule.exports,
  window: {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
  },
  Date,
  Math,
  JSON,
});
const profiles = profileModule.exports;
assert.equal(profiles.loadPlayerProfile().displayName, "Guest Racer", "Unauthenticated profile should default to Guest Racer");
assert.equal(profiles.savePlayerProfile({ displayName: "  Ada   Racer  " }).displayName, "Ada Racer", "Editable profile names should be normalized and persisted");
assert.equal(profiles.getAvatarInitials("Ada Racer"), "AR", "Profile avatars should use display-name initials");
assert.match(appSource, /<UserProfileBadge profile=\{playerProfile\}/, "The editable profile badge should be mounted in the garage navigation");
assert.match(appSource, /<RaceMode[\s\S]*onCreateRoom=\{createOnlineRoom\}[\s\S]*onJoinRoom=\{joinOnlineRoom\}/, "Race setup should expose online create/join actions");
assert.match(raceModeSource, /CONFIRM & CREATE ROOM[\s\S]*Match Settings[\s\S]*Edit Match Settings/, "Room creation and host-only lobby settings should use the requested steps");
assert.match(raceModeSource, /Circuit[\s\S]*selectedMap\?\.name[\s\S]*Weather[\s\S]*selectedEnvironment\?\.label/, "Room creation confirmation should summarize circuit and weather in badge-based cards");
assert.match(raceModeSource, /CANCEL[\s\S]*CONFIRM & CREATE ROOM/, "Create confirmation actions should have clear uppercase hierarchy and spacing");
assert.match(raceModeSource, /EXIT LOBBY/, "The active lobby should include an Exit Lobby action");
assert.match(raceModeSource, /Leave room <span[\s\S]*\{roomCode\}[\s\S]*STAY IN LOBBY[\s\S]*LEAVE LOBBY/, "Leaving should require a room-code confirmation with stay and red leave actions");
assert.match(raceModeSource, /event\.key !== "Escape"[\s\S]*closeOrConfirmExit/, "Escape should close a dialog or request exit confirmation from the lobby");
assert.match(raceModeSource, /event\.target === event\.currentTarget\) closeOrConfirmExit\(\)/, "Clicking the setup backdrop should close dialogs or request lobby exit");
assert.match(raceModeSource, /event\.target === event\.currentTarget\) onStay\(\)/, "Clicking the leave-confirmation backdrop should stay in the lobby");
assert.match(appSource, /onLeaveRoom=\{leaveOnlineRoom\}/, "Confirming lobby exit should disconnect the room without closing race setup");
assert.doesNotMatch(raceModeSource, /03 · Difficulty|Rival pace|DIFFICULTY/, "Multiplayer room settings should not expose difficulty controls");
assert.match(raceModeSource, /return createPortal\([\s\S]*document\.body/, "The room settings dialog should render in a clean top-level overlay");
assert.match(raceModeSource, /fixed inset-0 z-50 h-screen min-h-screen w-screen overflow-y-auto overscroll-y-contain scroll-smooth bg-neutral-950\/95 backdrop-blur-md/, "Race Mode should own a full-screen overlay with one primary scrolling surface");
assert.doesNotMatch(appSource, /max-w-5xl max-h-\[94vh\] overflow-y-auto rounded-3xl border/, "The App should not wrap Race Mode in its former constrained floating dialog");
assert.match(appSource, /raceModeType !== "online" && <section aria-labelledby="race-difficulty-heading"/, "Difficulty controls should remain available only for single-player setup");
assert.equal((appSource.match(/<Plus className="h-3\.5 w-3\.5" \/> Create Room/g) ?? []).length, 1, "The main multiplayer flow should expose exactly one Create Room action");
assert.match(raceModeSource, /VehicleThumbnail[\s\S]*Top speed[\s\S]*0–100[\s\S]*Handling[\s\S]*Select Car/, "Car selection should use visual cards and performance badges");
assert.match(raceModeSource, /renderVehicleThumbnails[\s\S]*imageUrl=\{vehicleThumbnails\[car\.id\]\}/, "Online lobby cards should display the generated model snapshots");
assert.doesNotMatch(raceModeSource, /function VehicleThumbnail[\s\S]*?<svg/, "Lobby car cards should no longer use hand-drawn side-profile vectors");
assert.match(vehicleThumbnailSource, /loadVehicleAsset\(null, null, car, \{ accelerateRaycast: false \}\)/, "Lobby thumbnails should use the actual showroom-normalized car models");
assert.match(vehicleThumbnailSource, /new WebGLRenderer[\s\S]*renderer\.render\(scene, camera\)[\s\S]*toDataURL/, "Lobby thumbnails should be rasterized once as high-resolution images");
assert.match(vehicleThumbnailSource, /RoomEnvironment[\s\S]*fromScene\(room/, "Lobby thumbnails should use a reflective studio environment");
assert.match(vehicleThumbnailSource, /renderer\.toneMapping = ACESFilmicToneMapping/, "Lobby thumbnail lighting should use filmic showroom tonemapping");
assert.match(raceModeSource, /READY[\s\S]*NOT READY/, "Every lobby player should have an explicit ready status");
assert.match(appSource, /raceModeType === "online" && !multiplayerSnapshot\.isHost \?/, "Non-host online players should only see the room-leader waiting state");
assert.match(appSource, /raceModeType === "online" && !multiplayerSnapshot\.roomCode \?/, "The initial online setup should put Create Room in the bottom action row");
assert.match(appSource, /!\(raceModeType === "online" && multiplayerSnapshot\.roomCode\) && <>/, "Inline setup selectors should be hidden only on the Online Multiplayer tab when a room is active");
assert.match(appSource, /const \[multiplayerSnapshot, setMultiplayerSnapshot\] = React\.useState\(getMultiplayerSnapshot\(\)\)/, "The parent App should own the active room snapshot across tab changes");
assert.match(appSource, /const chooseRaceMode = React\.useCallback\(\(mode\) => \{[\s\S]*?setRaceModeType\(mode\);\n  \}, \[\]\)/, "Switching race-mode tabs should preserve an established room for when the player returns online");
assert.match(raceModeSource, /if \(room\.roomCode && settingsKind === "create"\) setSettingsKind\(null\)/, "An active room must dismiss any stale room-creation dialog");
assert.match(raceModeSource, /!room\.roomCode \? <form[\s\S]*room\.roomCode\}/, "The online tab should render the active room lobby when a room code exists");
assert.match(raceModeSource, /handledCreateRequest = useRef\(0\)/, "Create-room requests should be consumed once instead of reopening on tab changes");
assert.match(appSource, /setCreateSettingsRequest\(\(request\) => request \+ 1\)/, "The bottom Create Room action should open the match setup modal");
assert.match(appSource, /const roomCode = createRaceRoom[\s\S]*const createdRoom = getMultiplayerSnapshot\(\)[\s\S]*setMultiplayerSnapshot\(createdRoom\)[\s\S]*createdRoom\.isHost/, "Confirming creation should generate a code, initialize the host snapshot, and transition into the lobby");
assert.match(countdownSource, /THE RACE IS STARTING IN 3\.\.\. 2\.\.\. 1\.\.\./, "The online countdown should display the explicit race-start message");
assert.match(countdownSource, /activeNumber = elapsed < 1000 \? 3 : elapsed < 2000 \? 2 : 1/, "Each player should animate the same 3-2-1 message sequence");
assert.doesNotMatch(countdownSource, /GO!|All racers · launch/, "The countdown should end at 1 and transition directly into the race");
assert.match(appSource, /countdownStartAt \+ 3000/, "The race transition should begin as the synchronized 3-2-1 sequence ends");
assert.match(appSource, /setRaceGridSlot\(roomStart\?\.fromRoom \? roomStart\.gridSlot : null\)/, "Online players should use their shared lobby grid slots");
assert.match(appSource, /for \(let index = playerIds\.length - 1; index > 0; index--\)/, "The host should shuffle human starting slots on every online launch");
assert.match(appSource, /setRaceAiEnabled\(!roomStart\?\.fromRoom/, "Online races should disable AI simulation while single-player keeps rivals");
assert.match(appSource, /raceModeType !== "online" && <RaceOpponents \/>/, "Online races should not mount or render AI opponent vehicles");
assert.match(raceEngineSource, /multiplayerRow = multiplayerGridSlot === null \? 0 : Math\.floor\(multiplayerGridSlot \/ 2\)/, "Online grid assignments should fill staggered two-car rows from the front");
assert.match(raceEngineSource, /phase === "racing" && aiRivalsEnabled/, "AI motion and collisions should only run when offline rivals are enabled");
assert.match(raceEngineSource, /countdownStartAtMs === null[\s\S]*Date\.now\(\) - race\.countdownStartAtMs/, "Online countdown progress should follow the shared host timestamp");
assert.match(raceDirectorSource, /markLocalRaceGridReady\(\)/, "Clients should confirm their race grid is staged before lights are scheduled");
assert.match(raceDirectorSource, /event\.raceStartAt - 5_000/, "The synchronized race timestamp should drive the five-second lights sequence");
assert.match(raceDirectorSource, /racePhase\(\) !== "racing"/, "Vehicle keyboard controls should stay locked until countdown zero");
assert.match(raceHudSource, /if \(onlineMode\)[\s\S]*multiplayerPlayers\.map/, "Online lineup should list human room members instead of offline AI rivals");
assert.match(remoteCarsSource, /publishRacePose\([\s\S]*heading: raceDrive\.heading[\s\S]*speed: raceDrive\.speed/, "Race scene should publish position, rotation and speed telemetry");
assert.match(remoteCarsSource, /<Html[\s\S]*player\.username/, "Remote cars should have floating username tags");

console.log("PASS: guest profiles, preview room create/join, readiness, pose telemetry, synchronized race start, remote tags, and leave handling.");

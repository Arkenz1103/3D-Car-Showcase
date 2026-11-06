import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/multiplayer.ts", import.meta.url), "utf8");
const profileSource = await readFile(new URL("../src/lib/playerProfile.ts", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const remoteCarsSource = await readFile(new URL("../src/three/MultiplayerRacePlayers.tsx", import.meta.url), "utf8");
const raceModeSource = await readFile(new URL("../src/components/RaceMode.tsx", import.meta.url), "utf8");
const publicRoomDirectorySource = await readFile(new URL("../src/lib/publicRoomDirectory.ts", import.meta.url), "utf8");
const circuitTrackArtworkSource = await readFile(new URL("../src/components/CircuitTrackArtwork.tsx", import.meta.url), "utf8");
const supabaseConfigSource = await readFile(new URL("../src/lib/supabase.ts", import.meta.url), "utf8");
const viteEnvSource = await readFile(new URL("../src/vite-env.d.ts", import.meta.url), "utf8");
const publicRoomMigration = await readFile(new URL("../supabase/migrations/20261106011422_public_room_directory.sql", import.meta.url), "utf8");
const vehicleThumbnailSource = await readFile(new URL("../src/lib/vehicleThumbnails.ts", import.meta.url), "utf8");
const countdownSource = await readFile(new URL("../src/components/OnlineRaceCountdown.tsx", import.meta.url), "utf8");
const raceEngineSource = await readFile(new URL("../src/three/raceEngine.ts", import.meta.url), "utf8");
const raceDirectorSource = await readFile(new URL("../src/three/RaceDirector.tsx", import.meta.url), "utf8");
const raceHudSource = await readFile(new URL("../src/components/RaceHud.tsx", import.meta.url), "utf8");
const javascript = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 });
const profileJavascript = ts.transpile(profileSource, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 });
const channels = new Map();
const realtimeChannels = new Map();
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

class MockRealtimeChannel {
  constructor(topic) {
    this.topic = topic;
    this.state = "closed";
    this.listener = null;
  }
  on(type, filter, listener) {
    assert.equal(type, "broadcast");
    assert.equal(filter.event, "room-message");
    this.listener = listener;
    return this;
  }
  subscribe(callback) {
    this.state = "joined";
    if (!realtimeChannels.has(this.topic)) realtimeChannels.set(this.topic, new Set());
    realtimeChannels.get(this.topic).add(this);
    queueMicrotask(() => callback("SUBSCRIBED"));
    return this;
  }
  send(message) {
    for (const peer of realtimeChannels.get(this.topic) ?? []) {
      if (peer !== this && peer.state === "joined") queueMicrotask(() => peer.listener?.(message.payload));
    }
    return Promise.resolve("ok");
  }
  unsubscribe() {
    this.state = "closed";
    realtimeChannels.get(this.topic)?.delete(this);
    return Promise.resolve("ok");
  }
}

const mockSupabase = { channel: (topic) => new MockRealtimeChannel(topic) };

function createClient({ useSupabaseRealtime = false } = {}) {
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
        get length() { return storage.size; },
        key: (index) => [...storage.keys()][index] ?? null,
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
    require: (name) => {
      if (name === "@/lib/supabase") return {
        supabase: useSupabaseRealtime ? mockSupabase : null,
        supabaseConfigured: useSupabaseRealtime,
      };
      throw new Error(`Unexpected runtime import: ${name}`);
    },
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
assert.match(source, /supabase\.channel\(`city-speedrunners-room:\$\{roomCode\}`[\s\S]*\.on\("broadcast", \{ event: "room-message" \}/, "Room messages should use a shared Supabase Realtime Broadcast channel by default");
assert.match(source, /realtimeChannel\.send\(\{ type: "broadcast", event: "room-message", payload: message \}\)/, "Room state and vehicle poses should be broadcast to remote room peers");
const realtimeHost = createClient({ useSupabaseRealtime: true });
const realtimeGuest = createClient({ useSupabaseRealtime: true });
const realtimeCode = realtimeHost.createRaceRoom(profile("Realtime Host"), "sf90", "", initialSettings, "RTM123");
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(realtimeHost.getMultiplayerSnapshot().transport, "supabase", "Configured Supabase should replace the local-only transport");
assert.equal(realtimeGuest.joinRaceRoom(realtimeCode, profile("Mobile Driver"), "gt3"), true, "A remote client should connect to the shared Realtime room topic");
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(realtimeHost.getMultiplayerSnapshot().players.length, 2, "Supabase Realtime should add a remote driver to the host roster");
assert.equal(realtimeGuest.getMultiplayerSnapshot().players.length, 2, "Supabase Realtime should send host presence to a joining driver");
realtimeGuest.setLocalReady(true);
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(realtimeHost.getMultiplayerSnapshot().players.find((player) => player.id === realtimeGuest.getMultiplayerSnapshot().localPlayerId)?.ready, true, "Readiness should sync across Supabase Realtime peers");
const realtimePose = { x: 4, y: 1, z: 8, pitch: 0, heading: 0.7, roll: 0, speed: 15 };
realtimeGuest.publishRacePose(realtimePose);
await new Promise((resolve) => setTimeout(resolve, 0));
assert.deepEqual(JSON.parse(JSON.stringify(realtimeHost.getMultiplayerSnapshot().players.find((player) => player.id === realtimeGuest.getMultiplayerSnapshot().localPlayerId)?.pose)), realtimePose, "Vehicle pose telemetry should sync across Supabase Realtime peers");
let realtimeStart = null;
let realtimeHostCountdown = null;
let realtimeGuestCountdown = null;
realtimeGuest.subscribeMultiplayerEvents((event) => { if (event.type === "start") realtimeStart = event; });
realtimeHost.subscribeMultiplayerEvents((event) => { if (event.type === "raceCountdown") realtimeHostCountdown = event; });
realtimeGuest.subscribeMultiplayerEvents((event) => { if (event.type === "raceCountdown") realtimeGuestCountdown = event; });
const realtimeGrid = {
  mapId: "tokyo",
  environment: 1,
  playerIds: [realtimeHost.getMultiplayerSnapshot().localPlayerId, realtimeGuest.getMultiplayerSnapshot().localPlayerId],
};
assert.equal(realtimeHost.startOnlineRace(realtimeGrid, 1500), true, "The host should start a race over Supabase Realtime");
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(realtimeStart?.type, "start", "The synchronized race start should reach the remote device");
realtimeHost.markLocalRaceGridReady();
await new Promise((resolve) => setTimeout(resolve, 0));
realtimeGuest.markLocalRaceGridReady();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(realtimeHostCountdown?.type, "raceCountdown", "The host should synchronize the green-light countdown across devices");
assert.equal(realtimeGuestCountdown?.type, "raceCountdown", "Remote drivers should receive the same countdown signal");
realtimeHost.disconnectRaceRoom();
realtimeGuest.disconnectRaceRoom();

assert.match(supabaseConfigSource, /VITE_SUPABASE_URL[\s\S]*VITE_SUPABASE_PUBLISHABLE_KEY[\s\S]*VITE_SUPABASE_ANON_KEY[\s\S]*createClient\(supabaseUrl, supabasePublicKey/, "Supabase should initialize from the configured URL and accept either publishable or legacy anon client keys");
assert.match(supabaseConfigSource, /new URL\(supabaseUrl\)[\s\S]*valid HTTP\(S\) Supabase project URL/, "Invalid Supabase environment values should fail gracefully rather than crash app startup");
assert.match(viteEnvSource, /VITE_SUPABASE_PUBLISHABLE_KEY\?: string[\s\S]*VITE_SUPABASE_ANON_KEY\?: string/, "Vite types should recognize the preferred and legacy Supabase public keys");
assert.match(publicRoomDirectorySource, /\.from\("rooms"\)[\s\S]*\.select\("room_code,host_id,host_name,map,weather,player_count,max_players,expires_at,is_public"\)[\s\S]*\.eq\("is_public", true\)[\s\S]*\.gt\("expires_at"/, "Lobby discovery should query active public rows from the shared Supabase table");
assert.match(publicRoomDirectorySource, /rpc\("create_public_room"[\s\S]*p_room_code[\s\S]*p_host_name[\s\S]*p_map[\s\S]*p_weather[\s\S]*p_host_token/, "Room creation should publish its code, host, track and weather to the backend");
assert.match(publicRoomDirectorySource, /rpc\("join_room_by_code"[\s\S]*p_room_code[\s\S]*p_player_id/, "Joining should reserve the active room through a backend lookup rather than local storage");
assert.match(publicRoomMigration, /create table if not exists public\.rooms[\s\S]*room_code text primary key[\s\S]*host_name text[\s\S]*map text[\s\S]*weather smallint[\s\S]*player_count integer[\s\S]*expires_at timestamptz/, "The shared lobby table should include the required room directory fields and expiry");
assert.match(publicRoomMigration, /alter table public\.rooms enable row level security[\s\S]*create policy "Active public rooms are visible to everyone"/, "Public room reads should be protected by an active-room RLS policy");
assert.match(publicRoomMigration, /function public\.join_room_by_code[\s\S]*r\.room_code = normalized_code and r\.expires_at > now\(\)[\s\S]*not already_joined and current_count >= room\.max_players/, "Invite-code joins should validate live database state and enforce room capacity");
assert.doesNotMatch(source, /window\.localStorage\.(?:getItem|setItem|removeItem)\([^\n]*(?:room|lobby)/i, "Cross-device room discovery must not rely on browser-local room records");
assert.match(source, /function publishHostLobby\([\s\S]*?type: "publishLobby" \| "unpublishLobby"[\s\S]*?isPublic: true[\s\S]*?socket\.send\(JSON\.stringify\(\{ type, roomCode: snapshot\.roomCode, from: localPlayerId, lobby \}\)\)/, "WebSocket hosts should publish complete public-lobby metadata to the relay");
assert.match(source, /socket\.onopen = \(\) => \{[\s\S]*?publishHostLobby\(\);/, "A WebSocket host should publish its listing after connecting");
assert.match(source, /heartbeatTimer = window\.setInterval\(\(\) => \{[\s\S]*?publishHostLobby\(\);[\s\S]*?\}, HEARTBEAT_MS\)/, "The host should renew its listing with the heartbeat");
assert.match(source, /publishHostLobby\("unpublishLobby"\);[\s\S]*?socket\.close\(\)/, "The host should withdraw the listing before closing the WebSocket");
const hostId = host.getMultiplayerSnapshot().localPlayerId;
const guestId = guest.getMultiplayerSnapshot().localPlayerId;
assert.notEqual(hostId, guestId, "Each tab must generate a unique in-memory player ID");
assert.equal(guest.joinRaceRoom(code.toLowerCase(), profile("Guest Racer"), "gt3"), true, "After the backend confirms the code, preview transport should join the live room");
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
assert.match(publicRoomDirectorySource, /rpc\("leave_public_room"[\s\S]*roomCode[\s\S]*playerId[\s\S]*hostToken/, "Leaving a lobby should update the centralized room registry");
assert.equal(guest.getMultiplayerSnapshot().players.length, 1, "Leaving should remove the peer from the lobby");
guest.disconnectRaceRoom();

const profileModule = { exports: {} };
vm.runInNewContext(profileJavascript, {
  module: profileModule,
  exports: profileModule.exports,
  window: {
    sessionStorage: {
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
assert.equal(profiles.loadPlayerProfile().displayName, "Ada Racer", "Guest profile changes should persist in sessionStorage");
assert.match(profiles.createGuestProfile().displayName, /^Guest Racer #[0-9]{4}$/, "New guest sessions should receive a four-digit racer ID");
assert.equal(profiles.getAvatarInitials("Ada Racer"), "AR", "Profile avatars should use display-name initials");
assert.match(appSource, /<UserProfileBadge[\s\S]*profile=\{playerProfile\}[\s\S]*onAuthenticated=\{finishLinkingAccount\}/, "The editable profile badge should support guest account linking in the garage navigation");
assert.match(appSource, /<RaceMode[\s\S]*onCreateRoom=\{createOnlineRoom\}[\s\S]*onJoinRoom=\{joinOnlineRoom\}/, "Race setup should expose online create/join actions");
assert.match(raceModeSource, /CONFIRM & CREATE ROOM[\s\S]*Match Settings[\s\S]*Edit Match Settings/, "Room creation and host-only lobby settings should use the requested steps");
assert.match(raceModeSource, /kind === "create" \? "Configure your lobby"[\s\S]*01 · Circuit[\s\S]*02 · Time &amp; weather[\s\S]*CONFIRM & CREATE ROOM/, "The create flow should let drivers select a circuit and time/weather before confirming publication");
assert.match(appSource, /CircuitTrackArtwork map=\{map\} selected=\{selected\}/, "Single-player circuit cards should render the shared track artwork component");
assert.match(raceModeSource, /CircuitTrackArtwork map=\{map\} selected=\{selected\}/, "Lobby circuit cards should render the same shared track artwork component");
assert.match(circuitTrackArtworkSource, /manila:[\s\S]*tokyo:[\s\S]*"new-york":[\s\S]*routeShape[\s\S]*stroke=\{selected \? "#F5C518" : "#FFFFFF"\}/, "Each circuit should have its matching SVG route, with the selected route highlighted");
assert.match(raceModeSource, /aria-pressed=\{selected\}[\s\S]*selected \? "border-\[#F5C518\] bg-\[#F5C518\]\/\[0\.07\][\s\S]*Selected circuit[\s\S]*Choose circuit/, "The selected lobby circuit should update its card state and selected track badge");
assert.match(raceModeSource, /CANCEL[\s\S]*CONFIRM & CREATE ROOM/, "Create confirmation actions should have clear uppercase hierarchy and spacing");
assert.match(raceModeSource, /onClick=\{\(\) => setOnlineView\("browser"\)\}[^>]*>← Browse Lobbies[\s\S]*Exit Lobby/, "Browse Lobbies should switch views without exiting; only the explicit Exit Lobby action requests confirmation");
assert.match(raceModeSource, /Leave room <span[\s\S]*\{roomCode\}[\s\S]*STAY IN LOBBY[\s\S]*LEAVE LOBBY/, "Leaving should require a room-code confirmation with stay and red leave actions");
assert.match(raceModeSource, /event\.key !== "Escape"[\s\S]*closeOrConfirmExit/, "Escape should close an open dialog or close the race setup");
assert.match(raceModeSource, /if \(room\.roomCode\) return;\s*onCloseSetup\(\)/, "Escape and backdrop clicks must not initiate lobby exit confirmation while a room is active");
assert.match(raceModeSource, /onClick=\{\(\) => setLeaveLobbyConfirmation\(true\)\}[^>]*>.*?Exit Lobby/, "Only the explicit Exit Lobby action should initiate the leave confirmation");
assert.match(raceModeSource, /event\.target === event\.currentTarget\) closeOrConfirmExit\(\)/, "Clicking the setup backdrop should close dialogs or request lobby exit");
assert.match(raceModeSource, /event\.target === event\.currentTarget\) onStay\(\)/, "Clicking the leave-confirmation backdrop should stay in the lobby");
assert.match(appSource, /onLeaveRoom=\{leaveOnlineRoom\}/, "Confirming lobby exit should disconnect the room without closing race setup");
assert.doesNotMatch(raceModeSource, /03 · Difficulty|Rival pace|DIFFICULTY/, "Multiplayer room settings should not expose difficulty controls");
assert.match(raceModeSource, /return createPortal\([\s\S]*document\.body/, "The room settings dialog should render in a clean top-level overlay");
assert.match(raceModeSource, /compactLayout \? "h-\[100dvh\] overflow-y-auto xl:overflow-hidden"/, "Desktop race setup should fit the viewport without a page scrollbar while smaller screens and active lobbies remain scrollable");
assert.match(raceModeSource, /xl:grid-cols-2 xl:grid-rows-\[minmax\(0,1fr\)_auto\]/, "Desktop race setup should arrange route, conditions, and difficulty in a compact responsive grid");
assert.doesNotMatch(appSource, /max-w-5xl max-h-\[94vh\] overflow-y-auto rounded-3xl border/, "The App should not wrap Race Mode in its former constrained floating dialog");
assert.match(appSource, /raceModeType !== "online" && <section aria-labelledby="race-difficulty-heading"/, "Difficulty controls should remain available only for single-player setup");
assert.match(raceModeSource, /onClick=\{\(\) => openSettings\("create"\)\}[\s\S]*CREATE CUSTOM LOBBY/, "The public directory should have a prominent Create Custom Lobby action that opens its configuration flow");
assert.doesNotMatch(raceModeSource, /Customize your lobby|ROOM SETUP · CUSTOMIZE/, "Lobby creation should reuse the map and weather selected on the multiplayer setup screen");
assert.match(raceModeSource, /Refresh[\s\S]*Room Code \/ Host Name[\s\S]*Description \/ Track Settings[\s\S]*Players[\s\S]*Map \/ Circuit[\s\S]*Region[\s\S]*Action/, "The public lobby directory should use the requested refreshable table columns");
assert.match(raceModeSource, /Search lobbies by room code or host name[\s\S]*Find Private Lobby/, "The directory should support live search and invite-code joining");
assert.match(raceModeSource, /setInterval\(\(\) => \{ void refreshPublicLobbies\(\); \}, 5_000\)/, "The lobby directory should poll the backend every five seconds");
assert.match(appSource, /await createPublicRoom\([\s\S]*hostName: playerProfile\.displayName[\s\S]*weather: settings\.environment[\s\S]*createRaceRoom\([\s\S]*published\.room\.roomCode/, "The app should publish the database row before opening the host lobby");
assert.match(appSource, /await joinPublicRoom\(code, playerId\)[\s\S]*joinRaceRoom\(activeRoom\.roomCode/, "A room join must query and reserve the active backend room before connecting");
assert.match(appSource, /heartbeatPublicRoom\([\s\S]*setInterval\(\(\) => \{ void heartbeat\(\); \}, 5_000\)/, "Active rooms should keep their server-side leases alive with five-second heartbeats");
assert.match(raceModeSource, /VehicleThumbnail[\s\S]*Top speed[\s\S]*0–100[\s\S]*Handling[\s\S]*Select Car/, "Car selection should use visual cards and performance badges");
assert.match(raceModeSource, /renderVehicleThumbnails[\s\S]*imageUrl=\{vehicleThumbnails\[car\.id\]\}/, "Online lobby cards should display the generated model snapshots");
assert.doesNotMatch(raceModeSource, /function VehicleThumbnail[\s\S]*?<svg/, "Lobby car cards should no longer use hand-drawn side-profile vectors");
assert.match(vehicleThumbnailSource, /loadVehicleAsset\(null, null, car, \{ accelerateRaycast: false \}\)/, "Lobby thumbnails should use the actual showroom-normalized car models");
assert.match(vehicleThumbnailSource, /new WebGLRenderer[\s\S]*renderer\.render\(scene, camera\)[\s\S]*toDataURL/, "Lobby thumbnails should be rasterized once as high-resolution images");
assert.match(vehicleThumbnailSource, /RoomEnvironment[\s\S]*fromScene\(room/, "Lobby thumbnails should use a reflective studio environment");
assert.match(vehicleThumbnailSource, /renderer\.toneMapping = ACESFilmicToneMapping/, "Lobby thumbnail lighting should use filmic showroom tonemapping");
assert.match(raceModeSource, /READY[\s\S]*NOT READY/, "Every lobby player should have an explicit ready status");
assert.match(appSource, /raceModeType === "online" && !multiplayerSnapshot\.isHost \?/, "Non-host online players should only see the room-leader waiting state");
assert.match(appSource, /footer=\{\(\{ onCreateLobby, onlineView \}\) => \([\s\S]*>Cancel<\/button>[\s\S]*onClick=\{onCreateLobby\}[\s\S]*Create Custom Lobby/, "The footer should retain Create Custom Lobby beside Cancel while a matching action sits with the directory");
assert.match(appSource, /!\(raceModeType === "online" && multiplayerSnapshot\.roomCode\) && <>/, "Inline setup selectors should be hidden only on the Online Multiplayer tab when a room is active");
assert.match(appSource, /const \[multiplayerSnapshot, setMultiplayerSnapshot\] = React\.useState\(getMultiplayerSnapshot\(\)\)/, "The parent App should own the active room snapshot across tab changes");
assert.match(appSource, /const chooseRaceMode = React\.useCallback\(\(mode\) => \{[\s\S]*?setRaceModeType\(mode\);\n  \}, \[\]\)/, "Switching race-mode tabs should preserve an established room for when the player returns online");
assert.match(raceModeSource, /if \(room\.roomCode && settingsKind && settingsKind !== "edit"\) setSettingsKind\(null\)/, "An active room must dismiss any stale room-creation dialog");
assert.doesNotMatch(raceModeSource, /kind === "configure"|Customize your lobby|REVIEW LOBBY/, "Room creation should not add a redundant second review step after circuit and conditions are selected");
assert.match(raceModeSource, /CONFIRM & CREATE ROOM/, "Publishing the configured lobby should require explicit confirmation");
assert.match(raceModeSource, /onlineView === "browser" && <PublicLobbyBrowser[\s\S]*onlineView === "room" && room\.roomCode \?/, "Browser and active-room dashboards should be mutually exclusive views");
assert.match(raceModeSource, /if \(room\.roomCode && room\.roomCode !== previousRoomCode\.current\) setOnlineView\("room"\);[\s\S]*else if \(!room\.roomCode && previousRoomCode\.current\) setOnlineView\("browser"\)/, "A newly created or joined room should open the active-room dashboard, and leaving should return to browsing");
assert.match(raceModeSource, /setOnlineView\("browser"\);\s*onLeaveRoom\(\)/, "Confirmed lobby exit should return the user to the browser view");
assert.match(raceModeSource, /compactLayout \? "grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-\[minmax\(0,1\.55fr\)_minmax\(320px,\.75fr\)\] xl:grid-rows-\[minmax\(0,1fr\)_auto\]"[\s\S]*<PublicLobbyBrowser/, "Online multiplayer should fit the room directory and race controls into a responsive desktop layout");
assert.match(raceModeSource, /activeRoomCode\) \{[\s\S]*current room is still active[\s\S]*disabled=\{full \|\| Boolean\(joiningCode\) \|\| Boolean\(activeRoomCode\)\}/, "Browsing while hosting should preserve the session and prevent accidental joins to another room");
assert.match(appSource, /const roomCode = createRaceRoom[\s\S]*const createdRoom = getMultiplayerSnapshot\(\)[\s\S]*createdRoom\.isHost[\s\S]*setMultiplayerSnapshot\(createdRoom\)/, "Confirming creation should initialize the multiplayer host after the server reservation");
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

console.log("PASS: preview and Supabase Realtime room messaging, remote readiness/pose/race countdown, shared room registry, and existing multiplayer regressions.");

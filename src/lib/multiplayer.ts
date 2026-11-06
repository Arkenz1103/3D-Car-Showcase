import type { PlayerProfile } from "@/lib/playerProfile";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type RacePose = {
  x: number;
  y: number;
  z: number;
  pitch: number;
  heading: number;
  roll: number;
  speed: number;
};

export type RoomPlayer = {
  id: string;
  username: string;
  level: number;
  rank: string;
  carId: string;
  ready: boolean;
  isHost: boolean;
  joinedAt: number;
  lastSeen: number;
  pose?: RacePose;
};

export type MultiplayerSnapshot = {
  roomCode: string | null;
  localPlayerId: string;
  connected: boolean;
  connecting: boolean;
  isHost: boolean;
  transport: "none" | "preview" | "websocket" | "supabase";
  players: RoomPlayer[];
  settings: OnlineRaceSettings | null;
  error: string | null;
};

export type OnlineRaceSettings = {
  mapId: string;
  environment: number;
  playerIds: string[];
};

export type PublicLobby = {
  roomCode: string;
  hostId: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  mapId: string;
  environment: number;
  expiresAt: number;
  source: "supabase";
};

type RoomMessage = {
  type: string;
  roomCode: string;
  from?: string;
  playerId?: string;
  player?: RoomPlayer;
  players?: RoomPlayer[];
  ready?: boolean;
  pose?: RacePose;
  settings?: OnlineRaceSettings;
  countdownDelayMs?: number;
  countdownStartAt?: number;
  raceStartAt?: number;
  hostNow?: number;
};

export type MultiplayerEvent = {
  type: string;
  settings?: OnlineRaceSettings;
  countdownDelayMs?: number;
  countdownStartAt?: number;
  raceStartAt?: number;
};

const LOCAL_CHANNEL_PREFIX = "city-speedrunners-room-";
const PEER_STALE_MS = 12_000;
const HEARTBEAT_MS = 2_000;
const POSE_SEND_INTERVAL_MS = 50;
/** Generated once in this tab's JS context; never read from shared localStorage. */
function getId() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  if (cryptoApi?.getRandomValues) cryptoApi.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256);
  return `racer-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
const localPlayerId = getId();

let snapshot: MultiplayerSnapshot = {
  roomCode: null,
  localPlayerId,
  connected: false,
  connecting: false,
  isHost: false,
  transport: "none",
  players: [],
  settings: null,
  error: null,
};
let localPlayer: RoomPlayer | null = null;
let channel: BroadcastChannel | null = null;
let realtimeChannel: RealtimeChannel | null = null;
let socket: WebSocket | null = null;
let heartbeatTimer = 0;
let lastPoseSentAt = 0;
const stateListeners = new Set<(state: MultiplayerSnapshot) => void>();
const eventListeners = new Set<(event: MultiplayerEvent) => void>();
let raceStartParticipants = new Set<string>();
let raceGridReadyPlayers = new Set<string>();
let raceCountdownBroadcasted = false;
let hostClockOffsetMs = 0;

function notify() {
  for (const listener of stateListeners) listener(snapshot);
}

function sortedPlayers(players: RoomPlayer[]) {
  return players.slice().sort((a, b) => Number(b.isHost) - Number(a.isHost) || a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
}

function setPlayers(players: RoomPlayer[], notifyListeners = true) {
  snapshot = { ...snapshot, players: sortedPlayers(players) };
  if (notifyListeners) notify();
}

function upsertPlayer(player: RoomPlayer, notifyListeners = true) {
  if (!player?.id || player.id === localPlayerId) return;
  const normalized = { ...player, lastSeen: Date.now() };
  const next = snapshot.players.slice();
  const index = next.findIndex((entry) => entry.id === normalized.id);
  if (index < 0) next.push(normalized);
  else next[index] = { ...next[index], ...normalized, pose: normalized.pose ?? next[index].pose };
  setPlayers(next, notifyListeners);
}

function updatePeer(playerId: string, patch: Partial<RoomPlayer>, notifyListeners = true) {
  if (!playerId || playerId === localPlayerId) return;
  const current = snapshot.players.find((player) => player.id === playerId);
  if (!current) return;
  const next = snapshot.players.slice();
  const index = next.findIndex((player) => player.id === playerId);
  next[index] = { ...current, ...patch, lastSeen: Date.now() };
  setPlayers(next, notifyListeners);
}

function removePeer(playerId: string) {
  setPlayers(snapshot.players.filter((player) => player.id !== playerId));
}

function send(type: string, payload: Record<string, unknown> = {}) {
  if (!snapshot.roomCode || !localPlayer) return;
  const message: RoomMessage = {
    type,
    roomCode: snapshot.roomCode,
    from: localPlayerId,
    ...payload,
  };
  if (channel) channel.postMessage(message);
  if (realtimeChannel && snapshot.connected) {
    void realtimeChannel.send({ type: "broadcast", event: "room-message", payload: message }).catch((error) => {
      if (snapshot.roomCode !== message.roomCode) return;
      snapshot = { ...snapshot, error: error instanceof Error ? error.message : "Supabase Realtime could not send a room update." };
      notify();
    });
  }
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function sendPresence() {
  if (!localPlayer) return;
  send("presence", { players: sortedPlayers([localPlayer, ...snapshot.players]), settings: snapshot.settings ?? undefined });
}

function publishHostLobby(type: "publishLobby" | "unpublishLobby" = "publishLobby") {
  if (!snapshot.roomCode || !snapshot.isHost || snapshot.transport !== "websocket" || !socket || socket.readyState !== WebSocket.OPEN) return;
  const lobby = {
    roomCode: snapshot.roomCode,
    hostId: localPlayerId,
    hostName: localPlayer?.username || "Room Host",
    playerCount: Math.max(1, snapshot.players.length),
    maxPlayers: 4,
    mapId: snapshot.settings?.mapId ?? "manila",
    environment: snapshot.settings?.environment ?? 0,
    expiresAt: Date.now() + PEER_STALE_MS,
    isPublic: true,
  };
  socket.send(JSON.stringify({ type, roomCode: snapshot.roomCode, from: localPlayerId, lobby }));
}

function maybeBroadcastRaceCountdown() {
  if (!snapshot.isHost || raceCountdownBroadcasted || raceStartParticipants.size === 0) return;
  for (const playerId of [...raceStartParticipants]) {
    if (playerId !== localPlayerId && !snapshot.players.some((player) => player.id === playerId)) {
      raceStartParticipants.delete(playerId);
    }
  }
  if (![...raceStartParticipants].every((playerId) => raceGridReadyPlayers.has(playerId))) return;
  raceCountdownBroadcasted = true;
  const hostNow = Date.now();
  const raceStartAt = hostNow + 7000;
  send("raceCountdown", { raceStartAt, hostNow });
  for (const listener of eventListeners) {
    listener({ type: "raceCountdown", settings: snapshot.settings ?? undefined, raceStartAt });
  }
}

function receive(event: MessageEvent | RoomMessage) {
  let message: RoomMessage;
  try {
    const raw = "data" in event ? event.data : event;
    message = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return;
  }
  if (!message || message.roomCode !== snapshot.roomCode) return;
  const senderId = message.from || message.playerId || message.player?.id || "";
  if (senderId === localPlayerId) return;

  switch (message.type) {
    case "join":
      if (message.player && message.player.id === senderId) {
        // Room membership is the only source of host privilege; joining peers are always guests.
        upsertPlayer({ ...message.player, isHost: false });
      }
      sendPresence();
      break;
    case "player":
      if (message.player && message.player.id === senderId) {
        const knownHost = snapshot.players.some((player) => player.id === senderId && player.isHost);
        upsertPlayer({ ...message.player, isHost: knownHost });
      }
      break;
    case "presence":
      if (Array.isArray(message.players)) {
        for (const player of message.players) upsertPlayer(player, false);
        if (message.settings) snapshot = { ...snapshot, settings: message.settings };
        notify();
      }
      break;
    case "settings":
      if (message.settings) {
        snapshot = { ...snapshot, settings: message.settings };
        notify();
      }
      break;
    case "ready":
      updatePeer(senderId, { ready: Boolean(message.ready) });
      break;
    case "pose":
      if (message.pose) updatePeer(senderId, { pose: message.pose }, false);
      break;
    case "heartbeat":
      if (message.player) upsertPlayer(message.player, false);
      else updatePeer(senderId, {} , false);
      break;
    case "leave":
      removePeer(senderId);
      raceStartParticipants.delete(senderId);
      raceGridReadyPlayers.delete(senderId);
      maybeBroadcastRaceCountdown();
      break;
    case "start": {
      const senderIsHost = snapshot.players.some((player) => player.id === senderId && player.isHost);
      if (snapshot.isHost || !senderIsHost || !message.settings) break;
      snapshot = { ...snapshot, settings: message.settings };
      if (Number.isFinite(message.hostNow)) hostClockOffsetMs = Date.now() - message.hostNow!;
      raceStartParticipants = new Set(message.settings.playerIds);
      raceGridReadyPlayers = new Set();
      raceCountdownBroadcasted = false;
      notify();
      for (const listener of eventListeners) listener({
        type: "start",
        settings: message.settings,
        countdownDelayMs: message.countdownDelayMs,
        countdownStartAt: Number.isFinite(message.countdownStartAt)
          ? message.countdownStartAt! + hostClockOffsetMs
          : undefined,
      });
      break;
    }
    case "gridReady":
      if (snapshot.isHost && raceStartParticipants.has(senderId)) {
        raceGridReadyPlayers.add(senderId);
        maybeBroadcastRaceCountdown();
      }
      break;
    case "raceCountdown": {
      const senderIsHost = snapshot.players.some((player) => player.id === senderId && player.isHost);
      if (!snapshot.isHost && senderIsHost && Number.isFinite(message.raceStartAt)) {
        for (const listener of eventListeners) listener({
          type: "raceCountdown",
          settings: snapshot.settings ?? undefined,
          raceStartAt: message.raceStartAt! + hostClockOffsetMs,
        });
      }
      break;
    }
  }
}

function disconnectTransport() {
  if (heartbeatTimer) window.clearInterval(heartbeatTimer);
  heartbeatTimer = 0;
  publishHostLobby("unpublishLobby");
  if (realtimeChannel) {
    const closingChannel = realtimeChannel;
    realtimeChannel = null;
    if (snapshot.roomCode && localPlayer) {
      const leaveMessage: RoomMessage = { type: "leave", roomCode: snapshot.roomCode, from: localPlayerId };
      void closingChannel.send({ type: "broadcast", event: "room-message", payload: leaveMessage })
        .then(() => closingChannel.unsubscribe(), () => closingChannel.unsubscribe());
    } else {
      void closingChannel.unsubscribe();
    }
  } else {
    send("leave");
  }
  channel?.close();
  channel = null;
  if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
  socket = null;
  localPlayer = null;
  lastPoseSentAt = 0;
  raceStartParticipants = new Set();
  raceGridReadyPlayers = new Set();
  raceCountdownBroadcasted = false;
  hostClockOffsetMs = 0;
  snapshot = {
    roomCode: null,
    localPlayerId,
    connected: false,
    connecting: false,
    isHost: false,
    transport: "none",
    players: [],
    settings: null,
    error: null,
  };
  notify();
}

function connect(options: {
  roomCode: string;
  profile: PlayerProfile;
  carId: string;
  isHost: boolean;
  websocketUrl?: string;
  settings?: OnlineRaceSettings | null;
}) {
  disconnectTransport();
  const roomCode = options.roomCode.toUpperCase();
  const transport = options.websocketUrl ? "websocket" : supabaseConfigured && supabase ? "supabase" : "preview";
  const now = Date.now();
  localPlayer = {
    id: localPlayerId,
    username: options.profile.displayName,
    level: options.profile.level,
    rank: options.profile.rank,
    carId: options.carId,
    ready: false,
    isHost: options.isHost,
    joinedAt: now,
    lastSeen: now,
  };
  snapshot = {
    roomCode,
    localPlayerId,
    connected: false,
    connecting: true,
    isHost: options.isHost,
    transport,
    players: [localPlayer],
    settings: options.settings ?? null,
    error: null,
  };
  notify();

  if (transport === "supabase" && supabase) {
    try {
      const currentChannel = supabase.channel(`city-speedrunners-room:${roomCode}`, {
        config: { broadcast: { self: false, ack: false } },
      });
      realtimeChannel = currentChannel;
      currentChannel.on("broadcast", { event: "room-message" }, (packet) => {
        const payload = packet && typeof packet === "object" && "payload" in packet
          ? (packet as { payload?: unknown }).payload
          : packet;
        if (payload) receive(payload as RoomMessage);
      });
      currentChannel.subscribe((status, error) => {
        if (snapshot.roomCode !== roomCode || realtimeChannel !== currentChannel) return;
        if (status === "SUBSCRIBED") {
          snapshot = { ...snapshot, connected: true, connecting: false, error: null };
          notify();
          send("join", { player: localPlayer });
          sendPresence();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          snapshot = {
            ...snapshot,
            connected: false,
            connecting: false,
            error: error?.message || `Supabase Realtime channel ${status.toLowerCase()}. Check the project Realtime service and try again.`,
          };
          notify();
        }
      });
    } catch (error) {
      realtimeChannel = null;
      snapshot = {
        ...snapshot,
        connected: false,
        connecting: false,
        error: error instanceof Error ? error.message : "Could not open the Supabase Realtime room channel.",
      };
      notify();
    }
  } else if (transport === "preview" && typeof BroadcastChannel !== "undefined") {
    try {
      channel = new BroadcastChannel(`${LOCAL_CHANNEL_PREFIX}${roomCode}`);
      channel.onmessage = receive;
      snapshot = { ...snapshot, connected: true, connecting: false };
      notify();
      send("join", { player: localPlayer });
      sendPresence();
    } catch {
      channel = null;
    }
  } else if (transport === "websocket" && typeof WebSocket !== "undefined") {
    try {
      socket = new WebSocket(options.websocketUrl!);
      socket.onopen = () => {
        if (snapshot.roomCode !== roomCode) return;
        snapshot = { ...snapshot, connected: true, connecting: false };
        notify();
        send("join", { player: localPlayer });
        sendPresence();
        publishHostLobby();
      };
      socket.onmessage = receive;
      socket.onerror = () => {
        snapshot = { ...snapshot, connected: false, connecting: false, error: "WebSocket connection failed. Check the multiplayer server and try again." };
        notify();
      };
      socket.onclose = () => {
        if (snapshot.roomCode !== roomCode) return;
        snapshot = { ...snapshot, connected: false, connecting: false, error: "Connection lost. Rejoin the room to continue." };
        notify();
      };
    } catch {
      snapshot = { ...snapshot, connected: false, connecting: false, error: "Could not open the multiplayer WebSocket." };
      notify();
    }
  } else {
    const error = transport === "supabase"
      ? "Supabase Realtime is not available; check the project connection and refresh."
      : "Room preview needs BroadcastChannel support or a configured realtime service.";
    snapshot = { ...snapshot, connected: false, connecting: false, error };
    notify();
  }

  if (snapshot.transport === "preview" && channel) {
    heartbeatTimer = window.setInterval(() => {
      if (!localPlayer) return;
      localPlayer.lastSeen = Date.now();
      send("heartbeat", { player: localPlayer });
      const now = Date.now();
      const fresh = snapshot.players.filter((player) => player.id === localPlayerId || now - player.lastSeen <= PEER_STALE_MS);
      if (fresh.length !== snapshot.players.length) setPlayers(fresh);
    }, HEARTBEAT_MS);
  } else if ((snapshot.transport === "websocket" && socket) || (snapshot.transport === "supabase" && realtimeChannel)) {
    heartbeatTimer = window.setInterval(() => {
      if (localPlayer) send("heartbeat", { player: { ...localPlayer, lastSeen: Date.now() } });
      publishHostLobby();
    }, HEARTBEAT_MS);
  }
}

export function generateRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint8Array(6);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(values);
  else for (let index = 0; index < values.length; index++) values[index] = Math.random() * 256;
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}

export function createRaceRoom(profile: PlayerProfile, carId: string, websocketUrl = "", settings: OnlineRaceSettings | null = null, reservedRoomCode = generateRoomCode()) {
  const roomCode = reservedRoomCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (roomCode.length !== 6) {
    snapshot = { ...snapshot, error: "Could not reserve a valid room code. Please try again." };
    notify();
    return "";
  }
  connect({ roomCode, profile, carId, isHost: true, websocketUrl, settings });
  return roomCode;
}

/** The caller must validate and reserve the room through the server before connecting. */
export function joinRaceRoom(rawCode: string, profile: PlayerProfile, carId: string, websocketUrl = "") {
  const roomCode = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (roomCode.length !== 6) {
    snapshot = { ...snapshot, error: "Enter the six-character room code." };
    notify();
    return false;
  }
  connect({ roomCode, profile, carId, isHost: false, websocketUrl });
  return true;
}

export function updateLocalPlayer(profile: PlayerProfile, carId: string) {
  if (!localPlayer) return;
  const carChanged = localPlayer.carId !== carId;
  localPlayer = {
    ...localPlayer,
    username: profile.displayName,
    level: profile.level,
    rank: profile.rank,
    carId,
    ready: carChanged ? false : localPlayer.ready,
    lastSeen: Date.now(),
  };
  const next = snapshot.players.map((player) => player.id === localPlayerId ? localPlayer as RoomPlayer : player);
  setPlayers(next);
  send("player", { player: localPlayer });
}

export function setLocalReady(ready: boolean) {
  if (!localPlayer) return;
  localPlayer = { ...localPlayer, ready: Boolean(ready), lastSeen: Date.now() };
  setPlayers(snapshot.players.map((player) => player.id === localPlayerId ? localPlayer as RoomPlayer : player));
  send("ready", { ready: localPlayer.ready, player: localPlayer });
}

export function updateLobbySettings(settings: OnlineRaceSettings) {
  if (!snapshot.connected || !snapshot.isHost) return false;
  const next = { ...settings, playerIds: snapshot.settings?.playerIds ?? [] };
  snapshot = { ...snapshot, settings: next };
  notify();
  send("settings", { settings: next });
  return true;
}

export function startOnlineRace(
  settings: OnlineRaceSettings,
  countdownDelayMs = 1_500,
  countdownStartAt = Date.now() + countdownDelayMs,
) {
  if (!snapshot.connected || !snapshot.isHost) return false;
  snapshot = { ...snapshot, settings };
  raceStartParticipants = new Set(settings.playerIds);
  raceGridReadyPlayers = new Set();
  raceCountdownBroadcasted = false;
  notify();
  send("start", { settings, countdownDelayMs, countdownStartAt, hostNow: Date.now() });
  return true;
}

/** Call once the local player has loaded the online race grid and camera. */
export function markLocalRaceGridReady() {
  if (!snapshot.connected || !localPlayer || !raceStartParticipants.has(localPlayerId)) return false;
  raceGridReadyPlayers.add(localPlayerId);
  send("gridReady");
  maybeBroadcastRaceCountdown();
  return true;
}

export function publishRacePose(pose: RacePose) {
  if (!snapshot.connected || !localPlayer) return;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (now - lastPoseSentAt < POSE_SEND_INTERVAL_MS) return;
  lastPoseSentAt = now;
  localPlayer = { ...localPlayer, pose, lastSeen: Date.now() };
  setPlayers(snapshot.players.map((player) => player.id === localPlayerId ? localPlayer as RoomPlayer : player), false);
  send("pose", { pose });
}

export function getMultiplayerSnapshot() {
  return snapshot;
}

export function subscribeMultiplayerState(listener: (state: MultiplayerSnapshot) => void) {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

export function subscribeMultiplayerEvents(listener: (event: MultiplayerEvent) => void) {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
}

export function disconnectRaceRoom() {
  disconnectTransport();
}

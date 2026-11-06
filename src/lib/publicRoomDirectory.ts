import { generateRoomCode, type PublicLobby } from "@/lib/multiplayer";
import { supabase, supabaseConfigured } from "@/lib/supabase";

type RoomRow = {
  room_code: string;
  host_id: string;
  host_name: string;
  map: string;
  weather: number;
  player_count: number;
  max_players: number;
  expires_at: string;
  is_public: boolean;
};

type CreatePublicRoomOptions = {
  hostId: string;
  hostName: string;
  mapId: string;
  weather: number;
};

function requireDatabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Cross-device lobbies need Supabase configured. Add the project URL and anon key, then apply the rooms migration.");
  }
  return supabase;
}

function mapRoomRow(row: RoomRow): PublicLobby {
  const expiresAt = Date.parse(row.expires_at);
  return {
    roomCode: row.room_code,
    hostId: row.host_id,
    hostName: row.host_name,
    playerCount: row.player_count,
    maxPlayers: row.max_players,
    mapId: row.map,
    environment: row.weather,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0,
    source: "supabase",
  };
}

function firstRow(data: RoomRow[] | RoomRow | null): RoomRow | null {
  return Array.isArray(data) ? data[0] ?? null : data;
}

function makeHostToken() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return `${cryptoApi.randomUUID()}${cryptoApi.randomUUID()}`;
  if (!cryptoApi?.getRandomValues) throw new Error("Secure random generation is required to create a public room.");
  const bytes = new Uint8Array(48);
  cryptoApi.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Fetches the cross-device public directory from Supabase, never browser storage. */
export async function discoverPublicLobbies(): Promise<PublicLobby[]> {
  const client = requireDatabase();
  const { data, error } = await client
    .from("rooms")
    .select("room_code,host_id,host_name,map,weather,player_count,max_players,expires_at,is_public")
    .eq("is_public", true)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message || "Could not load the public room directory.");
  return ((data ?? []) as RoomRow[]).map(mapRoomRow).filter((room) => room.expiresAt > Date.now());
}

/** Creates the shared database row and returns the private host capability for lifecycle RPCs. */
export async function createPublicRoom(options: CreatePublicRoomOptions) {
  const client = requireDatabase();
  const hostToken = makeHostToken();
  for (let attempt = 0; attempt < 8; attempt++) {
    const roomCode = generateRoomCode();
    const { data, error } = await client.rpc("create_public_room", {
      p_room_code: roomCode,
      p_host_id: options.hostId,
      p_host_name: options.hostName,
      p_map: options.mapId,
      p_weather: options.weather,
      p_host_token: hostToken,
    });
    if (!error) {
      const row = firstRow(data as RoomRow[] | RoomRow | null);
      if (!row) throw new Error("The room was created but the database returned no room details.");
      return { room: mapRoomRow(row), hostToken };
    }
    if (/duplicate key|unique constraint|already exists/i.test(error.message)) continue;
    throw new Error(error.message || "Could not publish the room to Supabase.");
  }
  throw new Error("Could not reserve a unique room code. Please try again.");
}

/** Atomically verifies an active room and records this player before they connect. */
export async function joinPublicRoom(roomCode: string, playerId: string) {
  const client = requireDatabase();
  const { data, error } = await client.rpc("join_room_by_code", {
    p_room_code: roomCode.toUpperCase(),
    p_player_id: playerId,
  });
  if (error) throw new Error(error.message || "That room is no longer active or has reached its player limit.");
  const row = firstRow(data as RoomRow[] | RoomRow | null);
  if (!row) throw new Error("That room is no longer active or has reached its player limit.");
  return mapRoomRow(row);
}

export async function heartbeatPublicRoom(
  roomCode: string,
  playerId: string,
  hostToken: string | null,
  metadata?: { hostName?: string; mapId?: string; weather?: number },
) {
  const client = requireDatabase();
  const { error } = await client.rpc("heartbeat_public_room", {
    p_room_code: roomCode,
    p_player_id: playerId,
    p_host_token: hostToken,
    p_host_name: metadata?.hostName ?? null,
    p_map: metadata?.mapId ?? null,
    p_weather: metadata?.weather ?? null,
  });
  if (error) throw new Error(error.message || "Could not keep the room active.");
}

export async function leavePublicRoom(roomCode: string, playerId: string, hostToken: string | null) {
  const client = requireDatabase();
  const { error } = await client.rpc("leave_public_room", {
    p_room_code: roomCode,
    p_player_id: playerId,
    p_host_token: hostToken,
  });
  if (error) throw new Error(error.message || "Could not update the room directory after leaving.");
}

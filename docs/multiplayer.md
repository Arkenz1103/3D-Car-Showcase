# Multiplayer rooms and cross-device racing

The race lobby includes a guest profile and a transport adapter. With Supabase configured, the public room directory is shared across devices from `public.rooms`; the browser polls the database every five seconds. Room gameplay messages use Supabase Realtime Broadcast channels by default, so players on separate PCs or phones can exchange readiness, race-start, and vehicle-pose updates without a separately hosted relay. `BroadcastChannel` remains only as the no-Supabase, same-browser preview fallback.

An external WebSocket relay can optionally override Supabase Realtime by setting `VITE_MULTIPLAYER_WS_URL` to a hosted `ws://` or `wss://` server and rebuilding/restarting the app. Such a server should accept JSON messages and broadcast each message to the other connected clients in the same `roomCode` (do not echo a sender's own message). The optional client protocol is (including host lobby-setting changes and a shared countdown delay to avoid relying on synchronized device clocks; remaining start skew is bounded by message transit time):

```json
{"type":"join","roomCode":"A7K4Q2","from":"player-id","player":{"id":"player-id","username":"Guest Racer","level":1,"rank":"ROOKIE","carId":"sf90","ready":false,"isHost":true}}
{"type":"presence","roomCode":"A7K4Q2","from":"player-id","players":[]}
{"type":"player","roomCode":"A7K4Q2","from":"player-id","player":{}}
{"type":"ready","roomCode":"A7K4Q2","from":"player-id","ready":true}
{"type":"pose","roomCode":"A7K4Q2","from":"player-id","pose":{"x":0,"y":0,"z":0,"pitch":0,"heading":0,"roll":0,"speed":0}}
{"type":"settings","roomCode":"A7K4Q2","from":"player-id","settings":{"mapId":"manila","environment":0,"playerIds":[]}}
{"type":"start","roomCode":"A7K4Q2","from":"player-id","settings":{"mapId":"manila","environment":0,"playerIds":["player-id"]},"countdownDelayMs":1500}
{"type":"heartbeat","roomCode":"A7K4Q2","from":"player-id","player":{}}
{"type":"leave","roomCode":"A7K4Q2","from":"player-id"}
```

## Shared Supabase room directory

Add the project URL and browser-safe anon/publishable key as described in [authentication setup](authentication.md), then run this migration in the Supabase SQL Editor or with `supabase db push`:

`supabase/migrations/20261106011422_public_room_directory.sql`

The migration creates `public.rooms` with room code, host name, map, weather, player count, visibility, and an expiring lease. Hosts create rows through `create_public_room`; clients use `join_room_by_code` to check that the room is still active and atomically claim a player slot. Host/guest heartbeats renew room membership, and leaving removes the member or closes the host room. The UI polls this shared table every five seconds, so changes appear on different PCs and networks. Private entries are excluded from the public list but can still be looked up by invite code.

Direct writes and reads of host capabilities are denied by row-level security. The browser uses narrowly scoped RPCs and an unguessable host token; stale rows expire automatically after a host stops heartbeating. No service-role key is used in the browser. Supabase must be configured for public create/join to work; the directory intentionally does not fall back to localStorage.

The `public.rooms` table is the cross-device directory and authoritative join/slot check. Supabase Realtime Broadcast is the default live room transport for driver presence, readiness, host settings, synchronized race starts, and car poses. No separate WebSocket server is required when Supabase is configured. Setting `VITE_MULTIPLAYER_WS_URL` opts into the external relay protocol instead.

The relay should only route room messages and enforce room membership/size; it must not trust client readiness or race results as secure competitive data. Guests remain supported, while optional Supabase accounts and cloud saves are documented in [authentication setup](authentication.md). Server-authoritative physics and ranked matchmaking are not included.

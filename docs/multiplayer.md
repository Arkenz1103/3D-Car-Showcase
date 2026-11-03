# Multiplayer preview and WebSocket relay

The race lobby includes a guest profile and a transport adapter. Without configuration, rooms use the browser `BroadcastChannel` API and synchronize across tabs opened at the same preview origin. This is a local preview transport, not public internet matchmaking.

To relay rooms over the internet, set `VITE_MULTIPLAYER_WS_URL` to a hosted `ws://` or `wss://` server and rebuild/restart the app. The server should accept JSON messages and broadcast each message to the other connected clients in the same `roomCode` (do not echo a sender's own message). The client protocol is (including host lobby-setting changes and a shared countdown delay to avoid relying on synchronized device clocks; remaining start skew is bounded by message transit time):

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

The relay should only route room messages and enforce room membership/size; it must not trust client readiness or race results as secure competitive data. The current profile is browser-local (`Guest Racer` by default); authentication, server-side identity, authoritative physics, and ranked matchmaking are not included.

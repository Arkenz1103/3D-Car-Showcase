import { Check, Clipboard, Cpu, Crown, Globe2, Link2, Pencil, Radio } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MultiplayerSnapshot, OnlineRaceSettings, RoomPlayer } from "@/lib/multiplayer";
import { renderVehicleThumbnails } from "@/lib/vehicleThumbnails";

type MatchSelection = Pick<OnlineRaceSettings, "mapId" | "environment">;
type RaceModeProps = {
  mode: "single" | "online";
  onModeChange: (mode: "single" | "online") => void;
  room: MultiplayerSnapshot;
  cars: { id: string; brand: string; model: string; shortTitle: string; accentHex: string }[];
  maps: { id: string; name: string; region: string; description: string }[];
  environments: { id: string; label: string; subtitle: string }[];
  initialSettings: MatchSelection;
  createSettingsRequest: number;
  selectedCarId: string;
  onCarChange: (carId: string) => void;
  onCreateRoom: (settings: MatchSelection) => boolean;
  onJoinRoom: (code: string) => void;
  onUpdateSettings: (settings: MatchSelection) => void;
  onToggleReady: () => void;
};

const CAR_SPECS: Record<string, { topSpeed: string; acceleration: string; handling: string }> = {
  sf90: { topSpeed: "340", acceleration: "2.5s", handling: "9.3" },
  aventador: { topSpeed: "350", acceleration: "2.9s", handling: "8.6" },
  "mclaren-vgt": { topSpeed: "391*", acceleration: "2.5s*", handling: "9.8" },
};

function Avatar({ player }: { player: RoomPlayer }) {
  const initials = player.username.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "R";
  return <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#F5C518]/35 bg-gradient-to-br from-[#DC1A22]/65 to-[#28243f] font-mono-tech text-[11px] font-bold text-white">{initials}</span>;
}

function VehicleThumbnail({ car, imageUrl, failed }: { car: RaceModeProps["cars"][number]; imageUrl?: string; failed: boolean }) {
  return (
    <div className="relative h-24 w-full overflow-hidden rounded-lg bg-[radial-gradient(ellipse_at_50%_75%,rgba(75,91,111,.22),transparent_68%),linear-gradient(145deg,#0c1119,#080b10)]">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`${car.brand} ${car.model} 3D showroom preview`}
          className="h-full w-full object-contain"
          loading="eager"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          {failed ? <span className="font-mono-tech text-[8px] uppercase tracking-wider text-zinc-600">3D preview unavailable</span> : <span className="h-4 w-4 animate-spin rounded-full border border-white/15 border-t-sky-200/80" aria-label="Preparing 3D showroom preview" />}
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-2 top-2 flex items-center justify-between font-mono-tech text-[7px] uppercase tracking-[.16em]">
        <span className="text-zinc-500">Showroom · 3D</span>
        <span style={{ color: car.accentHex }}>{car.brand}</span>
      </div>
    </div>
  );
}

function SettingsDialog({
  kind,
  value,
  onChange,
  maps,
  environments,
  onConfirm,
  onClose,
  errorMessage,
}: {
  kind: "create" | "edit";
  value: MatchSelection;
  onChange: (value: MatchSelection) => void;
  maps: RaceModeProps["maps"];
  environments: RaceModeProps["environments"];
  onConfirm: () => void;
  onClose: () => void;
  errorMessage: string;
}) {
  const selectedMap = maps.find((map) => map.id === value.mapId);
  const selectedEnvironment = environments[value.environment];
  return createPortal(
    <div className="fixed inset-0 z-[2147483001] grid place-items-center bg-[#020408]/88 p-3 backdrop-blur-md" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="room-settings-title" className="atelier-panel max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/12 p-5 shadow-[0_30px_120px_rgba(0,0,0,.75)] sm:p-7" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono-tech text-[9px] uppercase tracking-[.2em] text-sky-200">{kind === "create" ? "Room setup · confirmation" : "Room setup · match rules"}</div>
            <h3 id="room-settings-title" className="mt-1 font-display text-xl font-bold text-white">{kind === "create" ? "Create this room?" : "Edit match settings"}</h3>
            {kind === "edit" && <p className="mt-1 text-xs text-zinc-500">Choose the circuit and time/weather conditions for everyone in this lobby.</p>}
          </div>
          {kind === "edit" && <button type="button" onClick={onClose} aria-label="Close match settings" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-xl text-zinc-400 hover:bg-white/5 hover:text-white">×</button>}
        </div>

        {kind === "edit" ? (
          <div className="mt-5 space-y-5">
            <fieldset>
              <legend className="mb-2 font-mono-tech text-[9px] uppercase tracking-[.18em] text-zinc-400">01 · Map</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {maps.map((map) => <button type="button" key={map.id} aria-pressed={value.mapId === map.id} onClick={() => onChange({ ...value, mapId: map.id })} className={`rounded-xl border p-3 text-left transition-colors ${value.mapId === map.id ? "border-[#F5C518]/55 bg-[#F5C518]/[.08]" : "border-white/8 bg-black/20 hover:border-white/20"}`}>
                  <span className="block font-display text-sm font-semibold text-white">{map.name}</span><span className="mt-1 block font-mono-tech text-[8px] uppercase tracking-wider text-zinc-500">{map.region}</span><span className="mt-2 block line-clamp-2 text-[10px] leading-relaxed text-zinc-500">{map.description}</span>
                </button>)}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 font-mono-tech text-[9px] uppercase tracking-[.18em] text-zinc-400">02 · Time &amp; weather</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {environments.map((environment, index) => <button type="button" key={environment.id} aria-pressed={value.environment === index} onClick={() => onChange({ ...value, environment: index })} className={`rounded-xl border px-3 py-3 text-left transition-colors ${value.environment === index ? "border-sky-300/50 bg-sky-300/[.07]" : "border-white/8 bg-black/20 hover:border-white/20"}`}>
                  <span className="block font-display text-sm font-semibold text-white">{environment.label}</span><span className="mt-1 block text-[10px] text-zinc-500">{environment.subtitle}</span>
                </button>)}
              </div>
            </fieldset>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-white/8 bg-black/20 px-4 py-3 text-xs leading-relaxed text-zinc-400">
            Create a room for <span className="font-semibold text-white">{selectedMap?.name ?? "the selected circuit"}</span> with <span className="font-semibold text-white">{selectedEnvironment?.label ?? "the selected conditions"}</span>. You’ll become the Room Leader and receive a shareable room code.
          </p>
        )}
        {errorMessage && <div role="alert" className="mt-4 rounded-lg border border-red-400/25 bg-red-400/[.06] px-3 py-2 text-xs text-red-200">{errorMessage}</div>}
        <div className="mt-6 flex justify-end gap-2 border-t border-white/10 pt-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2.5 font-mono-tech text-[9px] uppercase tracking-wider text-zinc-300 hover:bg-white/5">Cancel</button>
          <button type="button" onClick={onConfirm} className="rounded-xl border border-sky-300/35 bg-sky-300/15 px-4 py-2.5 font-mono-tech text-[9px] font-bold uppercase tracking-wider text-sky-100 hover:bg-sky-300/25">{kind === "create" ? "CONFIRM & CREATE ROOM" : "Save Match Settings"}</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function RaceMode({
  mode,
  onModeChange,
  room,
  cars,
  maps,
  environments,
  initialSettings,
  createSettingsRequest,
  selectedCarId,
  onCarChange,
  onCreateRoom,
  onJoinRoom,
  onUpdateSettings,
  onToggleReady,
}: RaceModeProps) {
  const [joinCode, setJoinCode] = useState("");
  const [settingsKind, setSettingsKind] = useState<"create" | "edit" | null>(null);
  const [creationError, setCreationError] = useState("");
  const [draftSettings, setDraftSettings] = useState<MatchSelection>(initialSettings);
  const [vehicleThumbnails, setVehicleThumbnails] = useState<Record<string, string>>({});
  const [thumbnailRenderFailed, setThumbnailRenderFailed] = useState(false);
  const handledCreateRequest = useRef(0);
  const localPlayer = room.players.find((player) => player.id === room.localPlayerId);
  const connectedPlayersReady = room.players.length > 0 && room.players.every((player) => player.ready);
  const copyRoomCode = async () => {
    if (!room.roomCode) return;
    try {
      await navigator.clipboard.writeText(room.roomCode);
    } catch {
      const temporary = document.createElement("textarea");
      temporary.value = room.roomCode;
      temporary.style.position = "fixed";
      temporary.style.opacity = "0";
      document.body.appendChild(temporary);
      temporary.select();
      document.execCommand("copy");
      temporary.remove();
    }
  };
  const openSettings = (kind: "create" | "edit") => {
    setCreationError("");
    setDraftSettings(kind === "edit" && room.settings ? {
      mapId: room.settings.mapId,
      environment: room.settings.environment,
    } : initialSettings);
    setSettingsKind(kind);
  };
  useEffect(() => {
    // Room state is parent-owned and remains authoritative across mode-tab changes.
    // Never leave or open the create dialog once a room has become active.
    if (room.roomCode && settingsKind === "create") setSettingsKind(null);
    if (createSettingsRequest <= handledCreateRequest.current) return;
    handledCreateRequest.current = createSettingsRequest;
    if (mode === "online" && !room.roomCode) openSettings("create");
  }, [createSettingsRequest, mode, room.roomCode, settingsKind]);
  useEffect(() => {
    if (mode !== "online" || !room.roomCode) return;
    let cancelled = false;
    setThumbnailRenderFailed(false);
    void renderVehicleThumbnails(() => cancelled, (carId, dataUrl) => {
      if (!cancelled) setVehicleThumbnails((current) => ({ ...current, [carId]: dataUrl }));
    }).catch(() => {
      // The lobby remains usable if this browser cannot create a thumbnail WebGL context.
      if (!cancelled) setThumbnailRenderFailed(true);
    });
    return () => { cancelled = true; };
  }, [mode, room.roomCode]);
  const confirmSettings = () => {
    if (settingsKind === "create") {
      if (!onCreateRoom(draftSettings)) {
        setCreationError("Room could not be initialized. Please try again.");
        return;
      }
    } else {
      onUpdateSettings(draftSettings);
    }
    setSettingsKind(null);
  };
  const settingMap = maps.find((map) => map.id === room.settings?.mapId);
  const settingWeather = environments[room.settings?.environment ?? -1];

  return (
    <section aria-labelledby="race-mode-heading" className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><div className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-zinc-500">00 · Race mode</div><h3 id="race-mode-heading" className="mt-1 font-display text-lg font-semibold text-white">Choose how to race</h3></div>
        <div role="group" aria-label="Race mode" className="flex rounded-xl border border-white/10 bg-black/30 p-1">
          <button type="button" aria-pressed={mode === "single"} onClick={() => onModeChange("single")} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 font-mono-tech text-[9px] uppercase tracking-wider transition-colors ${mode === "single" ? "bg-[#DC1A22]/25 text-white" : "text-zinc-400 hover:text-white"}`}><Cpu className="h-3.5 w-3.5" /><span>Single Player vs AI</span></button>
          <button type="button" aria-pressed={mode === "online"} onClick={() => onModeChange("online")} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 font-mono-tech text-[9px] uppercase tracking-wider transition-colors ${mode === "online" ? "bg-sky-300/15 text-sky-100" : "text-zinc-400 hover:text-white"}`}><Globe2 className="h-3.5 w-3.5" /><span>Online Multiplayer</span></button>
        </div>
      </div>

      {mode === "single" ? <p className="mt-3 text-xs leading-relaxed text-zinc-400">Race the local Porsche and Bugatti AI rivals. Your selected garage car will start on the grid.</p> : (
        <div className="mt-4 space-y-4">
          {!room.roomCode ? <form className="rounded-xl border border-white/8 bg-black/20 p-3" onSubmit={(event) => { event.preventDefault(); onJoinRoom(joinCode); }}>
            <label htmlFor="join-race-room" className="font-mono-tech text-[9px] font-bold uppercase tracking-[.18em] text-zinc-400">Enter Room Code</label>
            <div className="mt-2 flex gap-2"><input id="join-race-room" value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} maxLength={6} placeholder="A7K4Q2" aria-label="Six-character room code" className="min-w-0 flex-1 rounded-lg border border-white/12 bg-black/40 px-3 py-2.5 font-mono-tech text-xs uppercase tracking-[0.22em] text-white outline-none focus:border-sky-300/60" /><button type="submit" disabled={joinCode.length !== 6} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2.5 font-mono-tech text-[9px] font-bold uppercase tracking-wider text-white hover:bg-white/15 disabled:opacity-40"><Link2 className="h-3.5 w-3.5" /> Join</button></div>
          </form> : <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-300/20 bg-sky-300/[0.06] p-3">
              <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-300/10 text-sky-200"><Radio className="h-4 w-4" /></span><div><div className="font-mono-tech text-[9px] uppercase tracking-[0.18em] text-sky-200">Room code</div><div className="mt-0.5 font-mono-tech text-xl font-bold tracking-[0.24em] text-white">{room.roomCode}</div></div></div>
              <button type="button" onClick={copyRoomCode} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 font-mono-tech text-[9px] uppercase tracking-wider text-zinc-200 hover:bg-white/8"><Clipboard className="h-3.5 w-3.5" /> Copy code</button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-300/20 bg-gradient-to-r from-sky-300/[.07] to-transparent p-3">
              <div className="min-w-0 flex-1">
                <div className="font-mono-tech text-[8px] font-bold uppercase tracking-[.18em] text-sky-200">Match Settings</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    ["MAP", settingMap?.name ?? "Waiting for host"],
                    ["TIME / WEATHER", settingWeather?.label ?? "—"],
                  ].map(([label, value]) => <span key={label} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/8 bg-black/25 px-2.5 py-1.5"><span className="font-mono-tech text-[7px] uppercase tracking-wider text-zinc-500">{label}</span><span className="max-w-44 truncate font-display text-[9px] font-semibold text-zinc-100">{value}</span></span>)}
                </div>
              </div>
              {room.isHost && <button type="button" disabled={!room.connected} onClick={() => openSettings("edit")} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-sky-300/25 bg-sky-300/[.08] px-3 py-2 font-mono-tech text-[8px] font-bold uppercase tracking-wider text-sky-100 hover:border-sky-300/45 hover:bg-sky-300/[.14] disabled:cursor-not-allowed disabled:opacity-45"><Pencil className="h-3 w-3" /> Edit Match Settings</button>}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-mono-tech text-[9px] uppercase tracking-[0.18em] text-zinc-500">Driver lobby · {room.players.length} connected</div><div className="mt-1 font-display text-sm font-semibold text-white">{connectedPlayersReady ? "Everyone is ready" : "Ready up before the host launches"}</div></div><div className="flex items-center gap-2 rounded-full border border-white/8 bg-black/20 px-2.5 py-1.5 font-mono-tech text-[8px] uppercase tracking-wider text-zinc-400"><span className={`h-1.5 w-1.5 rounded-full ${room.connected ? "bg-emerald-400" : "bg-amber-400"}`} />{room.transport === "websocket" ? "WebSocket" : "Local preview · same-browser tabs"}</div></div>

            <div className="grid gap-2 sm:grid-cols-2">{room.players.map((player) => {
              const vehicle = cars.find((car) => car.id === player.carId);
              const you = player.id === room.localPlayerId;
              return <div key={player.id} className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 ${you ? "border-[#F5C518]/25 bg-[#F5C518]/[0.04]" : "border-white/8 bg-black/20"}`}>
                <Avatar player={player} /><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><span className="truncate font-display text-xs font-semibold text-white">{player.username}</span>{you && <span className="font-mono-tech text-[8px] text-[#F5C518]">YOU</span>}{player.isHost && <Crown className="h-3 w-3 shrink-0 text-amber-300" aria-label="Room host" />}</div><div className="mt-1 truncate font-mono-tech text-[9px] text-zinc-400">Selected car · {vehicle ? `${vehicle.brand} ${vehicle.model}` : player.carId}</div><div className={`mt-1 flex items-center gap-1 font-mono-tech text-[8px] font-bold uppercase tracking-wider ${player.ready ? "text-emerald-300" : "text-zinc-500"}`}>{player.ready ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />}{player.ready ? "READY" : "NOT READY"}</div></div>
              </div>;
            })}</div>

            <div className="border-t border-white/8 pt-3"><div className="mb-2 font-mono-tech text-[9px] uppercase tracking-wider text-zinc-400">Choose your car</div><div className="grid gap-3 md:grid-cols-3">{cars.map((car) => {
              const specs = CAR_SPECS[car.id] ?? { topSpeed: "—", acceleration: "—", handling: "—" };
              const selected = selectedCarId === car.id;
              return <article key={car.id} className={`overflow-hidden rounded-xl border transition-colors ${selected ? "border-sky-300/45 bg-sky-300/[.04]" : "border-white/8 bg-black/20"}`}>
                <div className="border-b border-white/6 p-1"><VehicleThumbnail car={car} imageUrl={vehicleThumbnails[car.id]} failed={thumbnailRenderFailed} /></div><div className="p-3"><div className="font-mono-tech text-[8px] uppercase tracking-[.16em] text-zinc-500">{car.brand}</div><div className="mt-0.5 min-h-10 font-display text-xs font-semibold leading-snug text-white">{car.model}</div><div className="mt-2 grid grid-cols-3 gap-1"><span className="rounded-md bg-black/25 px-1.5 py-1"><b className="block font-mono-tech text-[7px] uppercase text-zinc-600">Top speed</b><b className="mt-0.5 block font-mono-tech text-[9px] text-zinc-200">{specs.topSpeed} km/h</b></span><span className="rounded-md bg-black/25 px-1.5 py-1"><b className="block font-mono-tech text-[7px] uppercase text-zinc-600">0–100</b><b className="mt-0.5 block font-mono-tech text-[9px] text-zinc-200">{specs.acceleration}</b></span><span className="rounded-md bg-black/25 px-1.5 py-1"><b className="block font-mono-tech text-[7px] uppercase text-zinc-600">Handling</b><b className="mt-0.5 block font-mono-tech text-[9px] text-zinc-200">{specs.handling}/10</b></span></div><button type="button" disabled={selected} aria-pressed={selected} onClick={() => onCarChange(car.id)} className={`mt-3 w-full rounded-lg border px-3 py-2 font-mono-tech text-[8px] font-bold uppercase tracking-wider transition-colors ${selected ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200" : "border-white/10 bg-white/[.04] text-zinc-200 hover:border-sky-300/35 hover:text-sky-100"}`}>{selected ? "Selected Car" : "Select Car"}</button></div>
              </article>;
            })}</div><p className="mt-2 text-[9px] text-zinc-600">*McLaren Vision GT performance figures are in-game estimates for this race setup.</p></div>

            <div className="flex flex-col gap-3 border-t border-white/8 pt-3 sm:flex-row sm:items-center sm:justify-between"><div className="text-[10px] text-zinc-500">{room.transport === "preview" ? "Preview rooms sync between open tabs on this browser origin. Cross-device play needs VITE_MULTIPLAYER_WS_URL." : "Room state and car telemetry are relayed through the configured WebSocket server."}</div><button type="button" onClick={onToggleReady} disabled={!room.connected} aria-pressed={Boolean(localPlayer?.ready)} className={`flex shrink-0 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 font-mono-tech text-[9px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${localPlayer?.ready ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100" : "border-sky-300/35 bg-sky-300/10 text-sky-100 hover:bg-sky-300/20"}`}><Check className="h-3.5 w-3.5" />{localPlayer?.ready ? "Ready · click to undo" : "I'm ready"}</button></div>
          </>}
          {room.error && <div role="alert" className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-[11px] text-red-200">{room.error}</div>}
        </div>
      )}
      {settingsKind && <SettingsDialog kind={settingsKind} value={draftSettings} onChange={setDraftSettings} maps={maps} environments={environments} onConfirm={confirmSettings} onClose={() => setSettingsKind(null)} errorMessage={settingsKind === "create" ? creationError : ""} />}
    </section>
  );
}

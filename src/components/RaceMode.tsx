import { Check, Clipboard, Cpu, Crown, Globe2, Link2, LockKeyhole, LogOut, MapPin, Pencil, Plus, Radio, RefreshCw, Search, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { type MultiplayerSnapshot, type OnlineRaceSettings, type PublicLobby, type RoomPlayer } from "@/lib/multiplayer";
import { discoverPublicLobbies } from "@/lib/publicRoomDirectory";
import { renderVehicleThumbnails } from "@/lib/vehicleThumbnails";
import { CircuitTrackArtwork } from "@/components/CircuitTrackArtwork";

type MatchSelection = Pick<OnlineRaceSettings, "mapId" | "environment">;
type RaceModeProps = {
  mode: "single" | "online";
  onModeChange: (mode: "single" | "online") => void;
  onCloseSetup: () => void;
  children?: ReactNode;
  footer?: (actions: { onCreateLobby: () => void; onlineView: "browser" | "room" }) => ReactNode;
  room: MultiplayerSnapshot;
  cars: { id: string; brand: string; model: string; shortTitle: string; accentHex: string }[];
  maps: { id: string; name: string; region: string; description: string }[];
  environments: { id: string; label: string; subtitle: string }[];
  initialSettings: MatchSelection;
  selectedCarId: string;
  onCarChange: (carId: string) => void;
  onCreateRoom: (settings: MatchSelection) => Promise<boolean>;
  onJoinRoom: (code: string) => Promise<boolean>;
  onUpdateSettings: (settings: MatchSelection) => void;
  onToggleReady: () => void;
  onLeaveRoom: () => void;
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
  confirming,
}: {
  kind: "create" | "edit";
  value: MatchSelection;
  onChange: (value: MatchSelection) => void;
  maps: RaceModeProps["maps"];
  environments: RaceModeProps["environments"];
  onConfirm: () => void;
  onClose: () => void;
  errorMessage: string;
  confirming: boolean;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[2147483001] overflow-y-auto bg-[#020408]/88 px-3 py-5 backdrop-blur-md" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="room-settings-title" className="atelier-panel mx-auto my-2 w-full max-w-3xl rounded-3xl border border-white/12 p-5 shadow-[0_30px_120px_rgba(0,0,0,.75)] sm:p-7" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono-tech text-[9px] uppercase tracking-[.2em] text-sky-200">{kind === "create" ? "New public lobby · configuration" : "Room setup · match rules"}</div>
            <h3 id="room-settings-title" className="mt-1 font-display text-xl font-bold text-white">{kind === "create" ? "Configure your lobby" : "Edit match settings"}</h3>
            <p className="mt-1 text-xs text-zinc-500">Choose the circuit and time/weather conditions for this lobby.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close match settings" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-xl text-zinc-400 hover:bg-white/5 hover:text-white">×</button>
        </div>

        <div className="mt-5 grid gap-5">
          <fieldset>
            <legend className="mb-2 font-mono-tech text-[9px] uppercase tracking-[.18em] text-zinc-400">01 · Circuit</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {maps.map((map) => {
                const selected = value.mapId === map.id;
                return (
                  <button
                    type="button"
                    key={map.id}
                    aria-pressed={selected}
                    onClick={() => onChange({ ...value, mapId: map.id })}
                    className={`overflow-hidden rounded-2xl border text-left transition-all ${selected ? "border-[#F5C518] bg-[#F5C518]/[0.07] shadow-[0_0_26px_rgba(245,197,24,0.1)]" : "border-white/10 bg-black/25 hover:border-white/30"}`}
                  >
                    <CircuitTrackArtwork map={map} selected={selected} />
                    <div className="p-3">
                      <div className="font-display text-sm font-semibold text-white">{map.name}</div>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-zinc-400">{map.description}</p>
                      <div className={`mt-2 font-mono-tech text-[9px] uppercase tracking-[0.18em] ${selected ? "text-[#F5C518]" : "text-zinc-600"}`}>
                        {selected ? "Selected circuit" : "Choose circuit"}
                      </div>
                    </div>
                  </button>
                );
              })}
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
        {errorMessage && <div role="alert" className="mt-4 rounded-lg border border-red-400/25 bg-red-400/[.06] px-3 py-2 text-xs text-red-200">{errorMessage}</div>}
        <div className="mt-6 flex flex-col-reverse gap-2.5 border-t border-white/10 pt-5 sm:flex-row sm:justify-end sm:gap-3">
          <button type="button" onClick={onClose} disabled={confirming} className="min-h-11 rounded-xl border border-white/12 bg-white/[.03] px-5 py-3 font-mono-tech text-[10px] font-bold uppercase tracking-[.16em] text-zinc-300 transition-colors hover:bg-white/[.08] hover:text-white disabled:opacity-50">CANCEL</button>
          <button type="button" onClick={onConfirm} disabled={confirming} className="min-h-11 rounded-xl border border-sky-200/35 bg-sky-300/15 px-5 py-3 font-mono-tech text-[10px] font-bold uppercase tracking-[.12em] text-sky-50 transition-colors hover:bg-sky-300/25 disabled:cursor-wait disabled:opacity-60">{confirming ? "PUBLISHING ROOM…" : kind === "create" ? "CONFIRM & CREATE ROOM" : "SAVE MATCH SETTINGS"}</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function LeaveLobbyDialog({
  roomCode,
  onStay,
  onLeave,
}: {
  roomCode: string;
  onStay: () => void;
  onLeave: () => void;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[2147483002] grid place-items-center overflow-y-auto bg-[#020408]/88 px-4 py-6 backdrop-blur-md"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onStay(); }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="leave-lobby-title"
        aria-describedby="leave-lobby-description"
        className="atelier-panel w-full max-w-md rounded-3xl border border-red-300/20 p-6 shadow-[0_30px_120px_rgba(0,0,0,.75)] sm:p-7"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-red-300/25 bg-red-400/10 text-red-200">
          <LogOut className="h-5 w-5" />
        </div>
        <div className="mt-4 text-center">
          <div className="font-mono-tech text-[9px] font-bold uppercase tracking-[.2em] text-red-200/75">Leave multiplayer lobby</div>
          <h3 id="leave-lobby-title" className="mt-2 font-display text-xl font-bold text-white">Leave room <span className="text-red-100">{roomCode}</span>?</h3>
          <p id="leave-lobby-description" className="mt-2 text-sm leading-relaxed text-zinc-400">You’ll be disconnected from this lobby. You can join again with the room code.</p>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-center sm:gap-3">
          <button type="button" onClick={onStay} className="min-h-11 rounded-xl border border-white/12 bg-white/[.03] px-5 py-3 font-mono-tech text-[10px] font-bold uppercase tracking-[.13em] text-zinc-200 transition-colors hover:bg-white/[.08] hover:text-white">STAY IN LOBBY</button>
          <button type="button" onClick={onLeave} className="min-h-11 rounded-xl border border-red-300/40 bg-red-500/85 px-5 py-3 font-mono-tech text-[10px] font-bold uppercase tracking-[.13em] text-white shadow-[0_0_22px_rgba(239,68,68,.18)] transition-colors hover:bg-red-500">LEAVE LOBBY</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function PrivateLobbyDialog({
  onClose,
  onJoin,
}: {
  onClose: () => void;
  onJoin: (code: string) => Promise<boolean>;
}) {
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (code.length !== 6 || joining) return;
    setJoining(true);
    setError("");
    try {
      if (await onJoin(code)) onClose();
      else setError("That room is no longer active or could not be joined.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not look up that room code.");
    } finally {
      setJoining(false);
    }
  };
  return createPortal(
    <div className="fixed inset-0 z-[2147483001] grid place-items-center bg-[#020408]/88 px-4 py-6 backdrop-blur-md" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="private-lobby-title" className="atelier-panel w-full max-w-md rounded-3xl border border-white/12 p-6 shadow-[0_30px_120px_rgba(0,0,0,.75)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sky-300/20 bg-sky-300/10 text-sky-100"><LockKeyhole className="h-4 w-4" /></span>
          <div><div className="font-mono-tech text-[9px] uppercase tracking-[.2em] text-sky-200">Private room access</div><h3 id="private-lobby-title" className="mt-1 font-display text-xl font-bold text-white">Find Private Lobby</h3><p className="mt-1 text-xs leading-relaxed text-zinc-400">Enter the six-character invite code provided by the host.</p></div>
        </div>
        <form className="mt-5" onSubmit={submit}>
          <label htmlFor="private-lobby-code" className="font-mono-tech text-[9px] uppercase tracking-[.16em] text-zinc-400">Room code</label>
          <input id="private-lobby-code" autoFocus required minLength={6} maxLength={6} value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="A7K4Q2" className="mt-1.5 w-full rounded-xl border border-white/12 bg-black/40 px-3 py-3 font-mono-tech text-lg uppercase tracking-[.28em] text-white outline-none focus:border-sky-300/60" />
          {error && <div role="alert" className="mt-3 rounded-lg border border-red-400/25 bg-red-400/[.06] px-3 py-2 text-xs text-red-200">{error}</div>}
          <div className="mt-5 flex justify-end gap-2 border-t border-white/10 pt-4">
            <button type="button" onClick={onClose} disabled={joining} className="rounded-xl border border-white/12 px-4 py-2.5 font-mono-tech text-[9px] font-bold uppercase tracking-wider text-zinc-300 hover:bg-white/[.06] disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={code.length !== 6 || joining} className="flex items-center gap-2 rounded-xl border border-sky-300/35 bg-sky-300/15 px-4 py-2.5 font-mono-tech text-[9px] font-bold uppercase tracking-wider text-sky-100 hover:bg-sky-300/25 disabled:cursor-wait disabled:opacity-40"><Link2 className="h-3.5 w-3.5" /> {joining ? "Checking…" : "Join Lobby"}</button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}

type PublicLobbyBrowserProps = {
  maps: RaceModeProps["maps"];
  environments: RaceModeProps["environments"];
  error: string | null;
  activeRoomCode: string | null;
  privateLobbyOpen: boolean;
  onOpenPrivateLobby: () => void;
  onClosePrivateLobby: () => void;
  onJoinRoom: (code: string) => Promise<boolean>;
};

function PublicLobbyBrowser({
  maps,
  environments,
  error,
  activeRoomCode,
  privateLobbyOpen,
  onOpenPrivateLobby,
  onClosePrivateLobby,
  onJoinRoom,
}: PublicLobbyBrowserProps) {
  const [publicLobbies, setPublicLobbies] = useState<PublicLobby[]>([]);
  const [lobbySearch, setLobbySearch] = useState("");
  const [refreshingDirectory, setRefreshingDirectory] = useState(false);
  const [lastDirectoryRefresh, setLastDirectoryRefresh] = useState(0);
  const [directoryError, setDirectoryError] = useState("");
  const [joiningCode, setJoiningCode] = useState("");
  const directoryRequest = useRef(0);
  const refreshPublicLobbies = useCallback(async () => {
    const request = ++directoryRequest.current;
    setRefreshingDirectory(true);
    try {
      const discovered = await discoverPublicLobbies();
      if (request === directoryRequest.current) {
        setPublicLobbies(discovered);
        setDirectoryError("");
        setLastDirectoryRefresh(Date.now());
      }
    } catch (reason) {
      if (request === directoryRequest.current) {
        // Keep the last successful directory response visible during a temporary
        // Supabase outage; joining still revalidates the code with the backend.
        setDirectoryError(reason instanceof Error ? reason.message : "Could not connect to the lobby database.");
      }
    } finally {
      if (request === directoryRequest.current) setRefreshingDirectory(false);
    }
  }, []);
  const joinRoom = async (code: string) => {
    if (joiningCode) return false;
    if (activeRoomCode) {
      setDirectoryError("Your current room is still active. Return to My Active Room and exit it before joining a different lobby.");
      return false;
    }
    setJoiningCode(code);
    setDirectoryError("");
    try {
      const joined = await onJoinRoom(code);
      if (!joined) setDirectoryError("That room is no longer active or could not be joined.");
      return joined;
    } catch (reason) {
      setDirectoryError(reason instanceof Error ? reason.message : "Could not look up that room code.");
      return false;
    } finally {
      setJoiningCode("");
      void refreshPublicLobbies();
    }
  };
  const filteredPublicLobbies = publicLobbies.filter((lobby) => {
    const query = lobbySearch.trim().toLowerCase();
    return !query || lobby.roomCode.toLowerCase().includes(query) || lobby.hostName.toLowerCase().includes(query);
  });
  useEffect(() => {
    void refreshPublicLobbies();
    const interval = window.setInterval(() => { void refreshPublicLobbies(); }, 5_000);
    return () => {
      window.clearInterval(interval);
      directoryRequest.current++;
    };
  }, [refreshPublicLobbies, activeRoomCode]);
  return (
    <>
      <section aria-labelledby="public-lobbies-title" className="min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-[#080a0e]/85 shadow-[0_18px_70px_rgba(0,0,0,.3)]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 bg-white/[.025] px-4 py-4 sm:px-5">
                  <div>
                    <div className="font-mono-tech text-[9px] font-bold uppercase tracking-[.2em] text-sky-200">Online Multiplayer · Public Directory</div>
                    <h3 id="public-lobbies-title" className="mt-1 font-display text-lg font-semibold text-white">Available lobbies <span className="ml-1 font-mono-tech text-xs text-zinc-500">{publicLobbies.length}</span></h3>
                    <p className="mt-1 text-[10px] text-zinc-500">Browse active rooms across devices. Private invite-code rooms stay out of this public list.</p>
                  </div>
                  <button type="button" onClick={() => void refreshPublicLobbies()} disabled={refreshingDirectory} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/12 bg-white/[.04] px-3.5 font-mono-tech text-[9px] font-bold uppercase tracking-[.13em] text-zinc-200 transition-colors hover:border-sky-300/35 hover:bg-sky-300/[.07] hover:text-sky-100 disabled:cursor-wait disabled:opacity-60" aria-label="Refresh public lobby list">
                    <RefreshCw className={`h-3.5 w-3.5 ${refreshingDirectory ? "animate-spin" : ""}`} /> Refresh
                  </button>
                </div>

                <div className="overflow-x-auto" role="region" aria-label="Public multiplayer lobbies" tabIndex={0}>
                  <table className="w-full min-w-[900px] border-collapse text-left">
                    <thead className="bg-black/25">
                      <tr className="border-b border-white/8 font-mono-tech text-[8px] uppercase tracking-[.16em] text-zinc-500">
                        <th scope="col" className="px-4 py-3 font-semibold sm:px-5">Room Code / Host Name</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Description / Track Settings</th>
                        <th scope="col" className="px-4 py-3 text-center font-semibold">Players</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Map / Circuit</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Region</th>
                        <th scope="col" className="px-4 py-3 text-right font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[.055]">
                      {filteredPublicLobbies.map((lobby) => {
                        const map = maps.find((candidate) => candidate.id === lobby.mapId);
                        const environment = environments[lobby.environment];
                        const full = lobby.playerCount >= lobby.maxPlayers;
                        return (
                          <tr key={lobby.roomCode} className="group transition-colors hover:bg-sky-300/[.035]">
                            <td className="px-4 py-3.5 sm:px-5">
                              <div className="font-mono-tech text-xs font-bold tracking-[.17em] text-white">{lobby.roomCode}</div>
                              <div className="mt-1 max-w-40 truncate font-display text-[11px] text-zinc-400">{lobby.hostName}</div>
                            </td>
                            <td className="max-w-[290px] px-4 py-3.5">
                              <div className="line-clamp-1 text-[11px] text-zinc-200">{map?.description ?? "Custom circuit session"}</div>
                              <div className="mt-1 truncate font-mono-tech text-[8px] uppercase tracking-wider text-zinc-500">{environment?.label ?? "Standard conditions"} · {environment?.subtitle ?? "Track settings"}</div>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-black/25 px-2.5 py-1.5 font-mono-tech text-[9px] font-bold text-zinc-200"><Users className="h-3 w-3 text-sky-200" />{lobby.playerCount}/{lobby.maxPlayers}</span>
                            </td>
                            <td className="px-4 py-3.5"><span className="block max-w-48 truncate font-display text-[11px] font-medium text-zinc-100">{map?.name ?? lobby.mapId}</span></td>
                            <td className="px-4 py-3.5"><span className="inline-flex max-w-40 items-center gap-1.5 truncate font-mono-tech text-[9px] text-zinc-400"><MapPin className="h-3 w-3 shrink-0 text-zinc-600" />{map?.region ?? "Unlisted"}</span></td>
                            <td className="px-4 py-3.5 text-right">
                              <button type="button" onClick={() => void joinRoom(lobby.roomCode)} disabled={full || Boolean(joiningCode) || Boolean(activeRoomCode)} aria-label={activeRoomCode ? "Exit your active room before joining another" : `Join room ${lobby.roomCode}`} className="min-w-20 rounded-lg border border-sky-300/25 bg-sky-300/[.08] px-3 py-2 font-mono-tech text-[8px] font-bold uppercase tracking-[.12em] text-sky-100 transition-colors hover:border-sky-300/45 hover:bg-sky-300/[.16] disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/[.025] disabled:text-zinc-600">{activeRoomCode ? lobby.roomCode === activeRoomCode ? "Your room" : "In room" : full ? "Full" : joiningCode === lobby.roomCode ? "Joining…" : "Join"}</button>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredPublicLobbies.length === 0 && (
                        <tr><td colSpan={6} className="px-5 py-12 text-center">
                          {refreshingDirectory ? <div className="inline-flex items-center gap-2 font-mono-tech text-[9px] uppercase tracking-wider text-zinc-500"><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Scanning active rooms…</div> : <><div className="font-display text-sm font-semibold text-zinc-300">{lobbySearch.trim() ? "No matching lobbies" : "No public lobbies found"}</div><div className="mt-1 text-[10px] text-zinc-600">{lobbySearch.trim() ? "Try another room code or host name." : "Create a public lobby or enter a private room code to get on the grid."}</div></>}
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-3 border-t border-white/8 bg-black/20 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                  <form className="relative min-w-0 flex-1 sm:max-w-md" role="search" onSubmit={(event) => event.preventDefault()}>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                    <input type="search" value={lobbySearch} onChange={(event) => setLobbySearch(event.target.value)} placeholder="Search lobbies by code or host name…" aria-label="Search lobbies by room code or host name" className="h-10 w-full rounded-lg border border-white/10 bg-black/35 pl-9 pr-3 font-display text-[11px] text-white outline-none placeholder:text-zinc-600 focus:border-sky-300/40" />
                  </form>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={onOpenPrivateLobby} disabled={Boolean(activeRoomCode)} title={activeRoomCode ? "Exit your active room before joining another lobby" : undefined} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/[.035] px-3.5 font-mono-tech text-[8px] font-bold uppercase tracking-[.1em] text-zinc-200 transition-colors hover:border-white/25 hover:bg-white/[.07] disabled:cursor-not-allowed disabled:opacity-45"><LockKeyhole className="h-3.5 w-3.5 text-zinc-400" /> Find Private Lobby</button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 font-mono-tech text-[8px] uppercase tracking-wider text-zinc-600 sm:px-5">
                  <span>Supabase room registry · auto-refresh every 5 seconds · private rooms require an invite code</span>
                  <span aria-live="polite">{lastDirectoryRefresh ? `Updated ${new Date(lastDirectoryRefresh).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Waiting for directory"}</span>
                </div>
                {(error || directoryError) && <div role="alert" className="mx-4 mb-4 rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-[11px] text-red-200 sm:mx-5">{directoryError || error}</div>}
              </section>
      {privateLobbyOpen && <PrivateLobbyDialog onClose={onClosePrivateLobby} onJoin={joinRoom} />}
    </>
  );
}

export function RaceMode({
  mode,
  onModeChange,
  onCloseSetup,
  children,
  footer,
  room,
  cars,
  maps,
  environments,
  initialSettings,
  selectedCarId,
  onCarChange,
  onCreateRoom,
  onJoinRoom,
  onUpdateSettings,
  onToggleReady,
  onLeaveRoom,
}: RaceModeProps) {
  const [privateLobbyOpen, setPrivateLobbyOpen] = useState(false);
  const [onlineView, setOnlineView] = useState<"browser" | "room">("browser");
  const [settingsKind, setSettingsKind] = useState<"create" | "edit" | null>(null);
  const [leaveLobbyConfirmation, setLeaveLobbyConfirmation] = useState(false);
  const [creationError, setCreationError] = useState("");
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [draftSettings, setDraftSettings] = useState<MatchSelection>(initialSettings);
  const [vehicleThumbnails, setVehicleThumbnails] = useState<Record<string, string>>({});
  const [thumbnailRenderFailed, setThumbnailRenderFailed] = useState(false);
  const localPlayer = room.players.find((player) => player.id === room.localPlayerId);
  const connectedPlayersReady = room.players.length > 0 && room.players.every((player) => player.ready);
  const previousRoomCode = useRef(room.roomCode);
  const previousMode = useRef(mode);
  useEffect(() => {
    if (room.roomCode && room.roomCode !== previousRoomCode.current) setOnlineView("room");
    else if (!room.roomCode && previousRoomCode.current) setOnlineView("browser");
    previousRoomCode.current = room.roomCode;
  }, [room.roomCode]);
  useEffect(() => {
    if (mode === "online" && previousMode.current !== "online") setOnlineView("browser");
    previousMode.current = mode;
  }, [mode]);
  const closeOrConfirmExit = useCallback(() => {
    if (privateLobbyOpen) {
      setPrivateLobbyOpen(false);
      return;
    }
    if (settingsKind) {
      setSettingsKind(null);
      return;
    }
    if (leaveLobbyConfirmation) {
      setLeaveLobbyConfirmation(false);
      return;
    }
    if (room.roomCode) return;
    onCloseSetup();
  }, [privateLobbyOpen, settingsKind, leaveLobbyConfirmation, room.roomCode, onCloseSetup]);
  const confirmLeaveRoom = useCallback(() => {
    setLeaveLobbyConfirmation(false);
    setOnlineView("browser");
    onLeaveRoom();
  }, [onLeaveRoom]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeOrConfirmExit();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeOrConfirmExit]);
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
    // Never leave a stale create dialog open once a room has become active.
    if (room.roomCode && settingsKind && settingsKind !== "edit") setSettingsKind(null);
  }, [room.roomCode, settingsKind]);
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
  const confirmSettings = async () => {
    if (settingsKind === "create") {
      setCreatingRoom(true);
      try {
        if (!(await onCreateRoom(draftSettings))) {
          setCreationError("Room could not be published. Check the connection and try again.");
          return;
        }
      } catch (reason) {
        setCreationError(reason instanceof Error ? reason.message : "Room could not be published. Check the connection and try again.");
        return;
      } finally {
        setCreatingRoom(false);
      }
    } else if (settingsKind === "edit") {
      onUpdateSettings(draftSettings);
    }
    setSettingsKind(null);
  };
  const settingMap = maps.find((map) => map.id === room.settings?.mapId);
  const settingWeather = environments[room.settings?.environment ?? -1];
  const compactLayout = mode === "single" || (mode === "online" && onlineView === "browser");

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="race-setup-title"
      className={`fixed inset-0 z-50 w-screen overscroll-y-contain bg-neutral-950/95 backdrop-blur-md ${compactLayout ? "h-[100dvh] overflow-y-auto xl:overflow-hidden" : "h-screen min-h-screen overflow-y-auto scroll-smooth"}`}
    >
      <div
        className={`mx-auto flex w-full max-w-[1680px] flex-col px-4 sm:px-8 lg:px-10 ${compactLayout ? "min-h-full py-3 xl:h-full xl:min-h-0 xl:py-4" : "min-h-full py-5 sm:py-7 lg:px-12"}`}
        onMouseDown={(event) => { if (event.target === event.currentTarget) closeOrConfirmExit(); }}
      >
        <header className={`flex w-full shrink-0 items-start justify-between gap-4 border-b border-white/10 ${compactLayout ? "mb-3 pb-3 xl:mb-2 xl:pb-2" : "mb-7 pb-5"}`}>
          <div>
            <div className="flex items-center gap-2 font-mono-tech text-[10px] uppercase tracking-[0.24em] text-[#F5C518]">
              <Radio className="h-3.5 w-3.5" /> Race Control · Grid Setup
            </div>
            <h2 id="race-setup-title" className={`mt-1 font-display font-bold uppercase tracking-wide text-white ${compactLayout ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"}`}>Choose your race</h2>
            <p className="mt-1 text-sm text-zinc-400">Pick a circuit and conditions before the garage gate opens.</p>
          </div>
          <button type="button" onClick={onCloseSetup} aria-label="Close race setup" className="atelier-pill grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 hover:text-white">
            <span className="text-xl leading-none">×</span>
          </button>
        </header>
        <div className={`w-full ${compactLayout ? "flex min-h-0 flex-1 flex-col gap-3" : "flex-1 space-y-7"}`}>
          <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
            <div><div className="font-mono-tech text-[9px] uppercase tracking-[0.2em] text-zinc-500">00 · Race mode</div><h3 id="race-mode-heading" className="mt-0.5 font-display text-base font-semibold text-white sm:text-lg">Choose how to race</h3></div>
            <div role="group" aria-label="Race mode" className="flex rounded-xl border border-white/10 bg-black/30 p-0.5">
              <button type="button" aria-pressed={mode === "single"} onClick={() => onModeChange("single")} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 font-mono-tech text-[9px] uppercase tracking-wider transition-colors ${mode === "single" ? "bg-[#DC1A22]/25 text-white" : "text-zinc-400 hover:text-white"}`}><Cpu className="h-3.5 w-3.5" /><span>Single Player vs AI</span></button>
              <button type="button" aria-pressed={mode === "online"} onClick={() => onModeChange("online")} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 font-mono-tech text-[9px] uppercase tracking-wider transition-colors ${mode === "online" ? "bg-sky-300/15 text-sky-100" : "text-zinc-400 hover:text-white"}`}><Globe2 className="h-3.5 w-3.5" /><span>Online Multiplayer</span></button>
            </div>
          </div>

          {mode === "online" && (
            <nav aria-label="Online multiplayer views" className="flex shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
              <button type="button" aria-current={onlineView === "browser" ? "page" : undefined} onClick={() => setOnlineView("browser")} className={`rounded-lg px-3 py-2 font-mono-tech text-[9px] font-bold uppercase tracking-[.12em] transition-colors ${onlineView === "browser" ? "bg-sky-300/15 text-sky-100" : "text-zinc-400 hover:bg-white/[.05] hover:text-white"}`}>Browse Lobbies</button>
              <button type="button" disabled={!room.roomCode} aria-current={onlineView === "room" ? "page" : undefined} onClick={() => setOnlineView("room")} className={`rounded-lg px-3 py-2 font-mono-tech text-[9px] font-bold uppercase tracking-[.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${onlineView === "room" ? "bg-emerald-300/10 text-emerald-100" : "text-zinc-400 hover:bg-white/[.05] hover:text-white"}`}>My Active Room{room.roomCode ? ` · ${room.roomCode}` : ""}</button>
            </nav>
          )}

          {mode === "single" ? <p className="text-[11px] leading-snug text-zinc-500 xl:hidden">Race the local Porsche and Bugatti AI rivals. Your selected garage car will start on the grid.</p> : (
          <div className={onlineView === "browser" && compactLayout ? "grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.75fr)] xl:grid-rows-[minmax(0,1fr)_auto]" : "mt-4 space-y-4"}>
            <div className={onlineView === "room" ? "min-w-0" : compactLayout ? "contents" : "mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,.65fr)]"}>
              {onlineView === "browser" && <PublicLobbyBrowser
                maps={maps}
                environments={environments}
                error={room.error}
                activeRoomCode={room.roomCode}
                privateLobbyOpen={privateLobbyOpen}
                onOpenPrivateLobby={() => setPrivateLobbyOpen(true)}
                onClosePrivateLobby={() => setPrivateLobbyOpen(false)}
                onJoinRoom={onJoinRoom}
              />}
              {onlineView === "room" && room.roomCode ? (
                <div className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={() => setOnlineView("browser")} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[.035] px-3.5 py-2.5 font-mono-tech text-[9px] font-bold uppercase tracking-[.12em] text-zinc-200 transition-colors hover:border-sky-300/35 hover:bg-sky-300/[.07] hover:text-sky-100">← Browse Lobbies</button>
                <span className="font-mono-tech text-[9px] uppercase tracking-[.18em] text-sky-200">Active room · {room.roomCode}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-300/20 bg-sky-300/[0.06] p-3">
                <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-300/10 text-sky-200"><Radio className="h-4 w-4" /></span><div><div className="font-mono-tech text-[9px] uppercase tracking-[0.18em] text-sky-200">Room code</div><div className="mt-0.5 font-mono-tech text-xl font-bold tracking-[0.24em] text-white">{room.roomCode}</div></div></div>
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" onClick={copyRoomCode} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 font-mono-tech text-[9px] uppercase tracking-wider text-zinc-200 transition-colors hover:bg-white/8"><Clipboard className="h-3.5 w-3.5" /> Copy code</button>
                  <button type="button" onClick={() => setLeaveLobbyConfirmation(true)} className="flex items-center gap-1.5 rounded-lg border border-red-300/25 bg-red-400/[.06] px-3 py-2 font-mono-tech text-[9px] font-bold uppercase tracking-wider text-red-200 transition-colors hover:border-red-300/45 hover:bg-red-400/[.14] hover:text-white"><LogOut className="h-3.5 w-3.5" /> Exit Lobby</button>
                </div>
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

              <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-mono-tech text-[9px] uppercase tracking-[0.18em] text-zinc-500">Driver lobby · {room.players.length} connected</div><div className="mt-1 font-display text-sm font-semibold text-white">{connectedPlayersReady ? "Everyone is ready" : "Ready up before the host launches"}</div></div><div className="flex items-center gap-2 rounded-full border border-white/8 bg-black/20 px-2.5 py-1.5 font-mono-tech text-[8px] uppercase tracking-wider text-zinc-400"><span className={`h-1.5 w-1.5 rounded-full ${room.connected ? "bg-emerald-400" : "bg-amber-400"}`} />{room.transport === "websocket" ? "WebSocket" : room.transport === "supabase" ? "Supabase Realtime" : "Local preview · same-browser tabs"}</div></div>

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

              <div className="flex flex-col gap-3 border-t border-white/8 pt-3 sm:flex-row sm:items-center sm:justify-between"><div className="text-[10px] text-zinc-500">{room.transport === "preview" ? "Preview rooms sync only between tabs on this browser. Configure Supabase or VITE_MULTIPLAYER_WS_URL for cross-device races." : room.transport === "supabase" ? "Player state, readiness, race start and car telemetry sync through Supabase Realtime across devices." : "Room state and car telemetry are relayed through the configured WebSocket server."}</div><button type="button" onClick={onToggleReady} disabled={!room.connected} aria-pressed={Boolean(localPlayer?.ready)} className={`flex shrink-0 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 font-mono-tech text-[9px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${localPlayer?.ready ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100" : "border-sky-300/35 bg-sky-300/10 text-sky-100 hover:bg-sky-300/20"}`}><Check className="h-3.5 w-3.5" />{localPlayer?.ready ? "Ready · click to undo" : "I'm ready"}</button></div>

                </div>
              ) : onlineView === "browser" ? (
                <aside aria-labelledby="create-public-lobby-title" className="relative overflow-hidden rounded-2xl border border-sky-300/20 bg-[radial-gradient(ellipse_at_top_right,rgba(56,189,248,.12),transparent_55%),linear-gradient(145deg,#0d121a,#080a0e)] p-4 shadow-[0_18px_70px_rgba(0,0,0,.25)] sm:p-5">
                  <div className="font-mono-tech text-[9px] font-bold uppercase tracking-[.2em] text-sky-200">{room.roomCode ? "Hosted session" : "Host a public session"}</div>
                  <h3 id="create-public-lobby-title" className="mt-1 font-display text-lg font-bold text-white">{room.roomCode ? "Your room is live" : "Build your grid"}</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{room.roomCode ? "Your room stays open while you browse. Switch back at any time to see drivers and readiness." : "Choose a circuit and conditions, then publish a room for drivers across devices."}</p>
                  <div className="mt-3 grid gap-2 rounded-xl border border-white/8 bg-black/25 p-3">
                    <div className="flex items-center justify-between gap-3 text-[10px]"><span className="font-mono-tech uppercase tracking-wider text-zinc-500">Circuit</span><span className="truncate font-display text-zinc-200">{maps.find((map) => map.id === initialSettings.mapId)?.name ?? "Choose below"}</span></div>
                    <div className="flex items-center justify-between gap-3 text-[10px]"><span className="font-mono-tech uppercase tracking-wider text-zinc-500">Conditions</span><span className="truncate font-display text-zinc-200">{environments[initialSettings.environment]?.label ?? "Choose below"}</span></div>
                    <div className="flex items-center justify-between gap-3 text-[10px]"><span className="font-mono-tech uppercase tracking-wider text-zinc-500">Visibility</span><span className="font-mono-tech text-emerald-200">PUBLIC DIRECTORY</span></div>
                  </div>
                  {room.roomCode ? (
                    <button type="button" onClick={() => setOnlineView("room")} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200/30 bg-emerald-300/10 px-4 py-2.5 font-mono-tech text-[9px] font-bold uppercase tracking-[.13em] text-emerald-100 transition-colors hover:bg-emerald-300/15">My Active Room · {room.roomCode}</button>
                  ) : (
                    <button type="button" onClick={() => openSettings("create")} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-sky-200/40 bg-sky-300/20 px-4 py-3 font-mono-tech text-[10px] font-black uppercase tracking-[.14em] text-sky-50 shadow-[0_0_28px_rgba(56,189,248,.14)] transition-all hover:border-sky-100/60 hover:bg-sky-300/30 hover:shadow-[0_0_36px_rgba(56,189,248,.2)]"><Plus className="h-4 w-4" /> CREATE CUSTOM LOBBY</button>
                  )}
                  <p className="mt-3 text-[9px] text-zinc-500">Private invite-code rooms stay out of the public directory.</p>
                </aside>
              ) : null}
            </div>
          </div>
          )}
          {children && mode === "single" && (
            <div className="grid grid-cols-1 gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-2 xl:grid-rows-[minmax(0,1fr)_auto] xl:[&>section:first-child]:col-span-2">
              {children}
            </div>
          )}
        </div>
        {footer && <div className={`w-full ${compactLayout ? "mt-auto pt-2 xl:pt-3" : "mt-7"}`}>{footer({ onCreateLobby: () => openSettings("create"), onlineView })}</div>}
      </div>
      {settingsKind && <SettingsDialog kind={settingsKind} value={draftSettings} onChange={setDraftSettings} maps={maps} environments={environments} onConfirm={confirmSettings} onClose={() => setSettingsKind(null)} errorMessage={settingsKind === "create" ? creationError : ""} confirming={creatingRoom} />}
      {leaveLobbyConfirmation && room.roomCode && <LeaveLobbyDialog roomCode={room.roomCode} onStay={() => setLeaveLobbyConfirmation(false)} onLeave={confirmLeaveRoom} />}
    </section>
  );
}

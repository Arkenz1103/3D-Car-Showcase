import React from "react";
import {
  ArrowLeft,
  LogOut,
  Maximize2,
  Moon,
  Music2,
  Play,
  RotateCw,
  Settings,
  Sun,
  VolumeX,
} from "lucide-react";

type GraphicsQuality = "low" | "standard" | "high";

type MainMenuProps = {
  open: boolean;
  mode?: "title" | "pause";
  musicOn: boolean;
  lightsOn: boolean;
  autoOrbit: boolean;
  graphicsQuality: GraphicsQuality;
  onStart: () => void;
  onResume?: () => void;
  onQuit: () => void;
  onQuitToTitle?: () => void;
  onToggleMusic: () => void;
  onToggleLights: () => void;
  onToggleOrbit: () => void;
  onGraphicsQualityChange: (quality: GraphicsQuality) => void;
};

const QUALITY_OPTIONS: { id: GraphicsQuality; label: string; note: string }[] = [
  { id: "low", label: "Performance", note: "Lower resolution · shadows off" },
  { id: "standard", label: "Balanced", note: "Recommended for most devices" },
  { id: "high", label: "High fidelity", note: "Sharper image · higher GPU load" },
];

function SettingToggle({ label, description, enabled, onClick, icon: Icon }: {
  label: string;
  description: string;
  enabled: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onClick}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-left transition-colors hover:border-white/25 hover:bg-white/[0.05]"
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon className={`h-4 w-4 shrink-0 ${enabled ? "text-[#F5C518]" : "text-zinc-500"}`} />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-white">{label}</span>
          <span className="mt-0.5 block text-xs text-zinc-500">{description}</span>
        </span>
      </span>
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${enabled ? "bg-[#DC1A22]" : "bg-zinc-700"}`} aria-hidden="true">
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}

export function MainMenu({
  open,
  mode = "title",
  musicOn,
  lightsOn,
  autoOrbit,
  graphicsQuality,
  onStart,
  onResume,
  onQuit,
  onQuitToTitle,
  onToggleMusic,
  onToggleLights,
  onToggleOrbit,
  onGraphicsQualityChange,
}: MainMenuProps) {
  const [screen, setScreen] = React.useState<"home" | "settings" | "quit">("home");

  const beginGame = () => {
    setScreen("home");
    if (mode === "pause") onResume?.();
    else onStart();
  };
  const quitFromMenu = () => {
    if (mode === "pause") {
      setScreen("home");
      onQuitToTitle?.();
    } else {
      setScreen("quit");
      onQuit();
    }
  };
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (screen !== "home") setScreen("home");
      else if (mode === "pause") onResume?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, screen, mode, onResume]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#030406]/82 px-4 py-6 backdrop-blur-md sm:px-8" role="dialog" aria-modal="true" aria-labelledby={screen === "home" ? mode === "pause" ? "pause-menu-title" : "main-menu-title" : screen === "settings" ? "settings-title" : "quit-title"}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-32 top-1/4 h-80 w-80 rounded-full bg-[#DC1A22]/10 blur-[110px]" />
        <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-[#F5C518]/[0.06] blur-[130px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#DC1A22]/60 to-transparent" />
      </div>

      {screen === "home" && (
        <main className="relative my-auto w-full max-w-md rounded-[28px] border border-white/12 bg-gradient-to-br from-[#121316]/96 via-[#090a0d]/96 to-[#08090b]/96 p-7 shadow-[0_35px_120px_rgba(0,0,0,0.72)] sm:p-10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 grid h-11 w-11 place-items-center rounded-xl border border-[#DC1A22]/50 bg-[#DC1A22]/10">
              <span className="h-4 w-4 rotate-45 border-2 border-[#DC1A22]" />
            </div>
            <div className="font-display text-xl sm:text-2xl font-black uppercase italic leading-tight tracking-[0.045em] text-rose-50" style={{ WebkitTextStroke: "0.7px rgba(255, 142, 170, 0.7)", textShadow: "0 1px 0 rgba(102, 17, 39, 0.95), 0 0 8px rgba(255, 92, 133, 0.95), 0 0 22px rgba(246, 37, 98, 0.62), 0 0 36px rgba(45, 214, 255, 0.24)" }}>CITY OF SPEEDRUNNERS</div>
            <h1 id={mode === "pause" ? "pause-menu-title" : "main-menu-title"} className="mt-3 font-display text-3xl font-bold uppercase tracking-[0.08em] text-white">{mode === "pause" ? "Paused" : "Main Menu"}</h1>
          </div>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={beginGame}
              className="flex min-h-14 items-center justify-center gap-3 rounded-xl border border-[#f0444b]/80 bg-gradient-to-r from-[#DC1A22] to-[#a50f18] px-5 font-mono-tech text-xs font-bold uppercase tracking-[0.2em] text-white shadow-[0_0_36px_rgba(220,26,34,0.2)] transition-all hover:brightness-110"
            >
              <Play className="h-4 w-4 fill-current" />{mode === "pause" ? "Resume Game" : "Start Game"}
            </button>
            <button type="button" onClick={() => setScreen("settings")} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.035] px-4 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-zinc-200 transition-colors hover:border-white/30 hover:bg-white/[0.07]">
              <Settings className="h-4 w-4 text-[#F5C518]" />Settings
            </button>
            <button type="button" onClick={quitFromMenu} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.035] px-4 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-zinc-300 transition-colors hover:border-[#DC1A22]/60 hover:text-white">
              <LogOut className="h-4 w-4 text-[#DC1A22]" />Quit Game
            </button>
          </div>
        </main>
      )}

      {screen === "settings" && (
        <section className="relative my-auto w-full max-w-3xl overflow-hidden rounded-[26px] border border-white/12 bg-[#0b0c0f]/95 shadow-[0_35px_120px_rgba(0,0,0,0.72)]" aria-labelledby="settings-title">
          <header className="flex items-center justify-between border-b border-white/10 px-5 py-5 sm:px-8">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setScreen("home")} aria-label={mode === "pause" ? "Back to pause menu" : "Back to main menu"} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-zinc-300 hover:border-white/30 hover:text-white"><ArrowLeft className="h-4 w-4" /></button>
              <div><div className="font-mono-tech text-[9px] uppercase tracking-[0.24em] text-[#F5C518]">Preferences</div><h2 id="settings-title" className="mt-1 font-display text-2xl font-bold text-white">Settings</h2></div>
            </div>
            <span className="font-mono-tech text-[9px] uppercase tracking-wider text-zinc-600">Applied immediately</span>
          </header>
          <div className="grid gap-7 p-5 sm:p-8 md:grid-cols-2">
            <section>
              <h3 className="mb-3 font-mono-tech text-[9px] uppercase tracking-[0.2em] text-zinc-500">Graphics quality</h3>
              <div className="space-y-2">
                {QUALITY_OPTIONS.map((option) => (
                  <button key={option.id} type="button" aria-pressed={graphicsQuality === option.id} onClick={() => onGraphicsQualityChange(option.id)} className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${graphicsQuality === option.id ? "border-[#F5C518]/60 bg-[#F5C518]/[0.07]" : "border-white/10 bg-white/[0.02] hover:border-white/25"}`}>
                    <span><span className="block text-sm font-semibold text-white">{option.label}</span><span className="mt-1 block text-[10px] text-zinc-500">{option.note}</span></span>
                    <span className={`h-3 w-3 rounded-full border ${graphicsQuality === option.id ? "border-[#F5C518] bg-[#F5C518] shadow-[0_0_10px_rgba(245,197,24,.45)]" : "border-zinc-600"}`} />
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[10px] leading-5 text-zinc-600">Performance mode lowers pixel density and disables real-time shadows to help reduce GPU load.</p>
            </section>

            <section>
              <h3 className="mb-3 font-mono-tech text-[9px] uppercase tracking-[0.2em] text-zinc-500">Experience</h3>
              <div className="space-y-2">
                <SettingToggle label="Garage music" description="HTML5 garage soundtrack playlist" enabled={musicOn} onClick={onToggleMusic} icon={musicOn ? Music2 : VolumeX} />
                <SettingToggle label="Garage lighting" description="Showroom illumination" enabled={lightsOn} onClick={onToggleLights} icon={lightsOn ? Sun : Moon} />
                <SettingToggle label="Auto-orbit camera" description="Slow 360° showroom rotation" enabled={autoOrbit} onClick={onToggleOrbit} icon={RotateCw} />
              </div>
              <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <div className="font-mono-tech text-[9px] uppercase tracking-[0.18em] text-zinc-500">Controls</div>
                <div className="mt-3 space-y-2 text-[11px] text-zinc-400">
                  <div className="flex justify-between gap-3"><span>Move / steer</span><kbd className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono-tech text-[9px] text-zinc-300">WASD / arrows</kbd></div>
                  <div className="flex justify-between gap-3"><span>Shift / neutral / reverse</span><kbd className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono-tech text-[9px] text-zinc-300">Q/E · N · R</kbd></div>
                  <div className="flex justify-between gap-3"><span>Ignition / handbrake</span><kbd className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono-tech text-[9px] text-zinc-300">I · Space</kbd></div>
                  <div className="flex justify-between gap-3"><span>Lights / camera / exit</span><kbd className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono-tech text-[9px] text-zinc-300">L · C · Esc</kbd></div>
                </div>
              </div>
            </section>
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4 sm:px-8">
            <button type="button" onClick={() => { const result = document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.(); void result?.catch(() => {}); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"><Maximize2 className="h-3.5 w-3.5" />Toggle fullscreen</button>
            <button type="button" onClick={() => setScreen("home")} className="rounded-lg border border-white/15 bg-white/[0.04] px-5 py-2.5 font-mono-tech text-[10px] uppercase tracking-[0.16em] text-white transition-colors hover:border-white/30 hover:bg-white/[0.08]">Done</button>
          </footer>
        </section>
      )}

      {screen === "quit" && (
        <section className="relative my-auto w-full max-w-lg rounded-[26px] border border-white/12 bg-[#0b0c0f]/95 p-7 text-center shadow-[0_35px_120px_rgba(0,0,0,0.72)] sm:p-10" aria-labelledby="quit-title">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-[#DC1A22]/40 bg-[#DC1A22]/10"><LogOut className="h-5 w-5 text-[#DC1A22]" /></span>
          <h2 id="quit-title" className="mt-5 font-display text-2xl font-bold text-white">Thanks for playing.</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">Your browser may block games from closing their own tab. You can close this tab now, or return to the main menu.</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={() => setScreen("home")} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3 font-mono-tech text-[10px] uppercase tracking-wider text-zinc-200 hover:border-white/30 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" />Main Menu</button>
            <button type="button" onClick={beginGame} className="flex items-center justify-center gap-2 rounded-xl bg-[#DC1A22] px-5 py-3 font-mono-tech text-[10px] font-bold uppercase tracking-wider text-white hover:bg-[#b9151c]"><Play className="h-3.5 w-3.5 fill-current" />Start Game</button>
          </div>
        </section>
      )}
    </div>
  );
}

export default MainMenu;

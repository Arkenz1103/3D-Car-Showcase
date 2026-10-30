import React from "react";
import { Music2, Pause, Play, SkipBack, SkipForward } from "lucide-react";

export const SOUNDTRACK_PLAYLIST = [
  {
    title: "BANDIT",
    artist: "Don Toliver",
    url: "/Garage-Soundtrack/Bandit.mp3",
  },
  {
    title: "Precision",
    artist: "Big Sean",
    url: "/Garage-Soundtrack/Big%20Sean%20-%20Precision.mp3",
  },
  {
    title: "Sprinter",
    artist: "Central Cee & Dave",
    url: "/Garage-Soundtrack/Central%20Cee%20x%20Dave%20-%20Sprinter%20%5BMusic%20Video%5D.mp3",
  },
  {
    title: "Tobey",
    artist: "Eminem ft. Big Sean & BabyTron",
    url: "/Garage-Soundtrack/Eminem%20-%20Tobey%20feat.%20Big%20Sean%20&%20BabyTron%20(Official%20Music%20Video).mp3",
  },
  {
    title: "Big Dawgs",
    artist: "Hanumankind & Kalmi",
    url: "/Garage-Soundtrack/Hanumankind,%20Kalmi%20-%20Hanumankind%20%E2%80%93%20Big%20Dawgs%20Prod.%20Kalmi%20(Official%20Music%20Video)%20Def%20Jam%20India.mp3",
  },
  {
    title: "Let's Go",
    artist: "Key Glock",
    url: "/Garage-Soundtrack/Key%20Glock%20-%20Let's%20Go%20(Official%20Visualizer).mp3",
  },
  {
    title: "Two Days",
    artist: "Killer Mike ft. Ty Dolla $ign",
    url: "/Garage-Soundtrack/Killer%20Mike%20-%20Two%20Days%20ft.%20Ty%20Dolla%20$ign%20[Audio].mp3",
  },
  {
    title: "Go Hard",
    artist: "Lil Baby",
    url: "/Garage-Soundtrack/Lil%20Baby%20-%20Go%20Hard.mp3",
  },
] as const;

export type GarageSoundtrackHandle = {
  startRandomTrack: () => void;
  togglePlayback: () => void;
  resumePlayback: () => void;
};

type GarageSoundtrackProps = {
  active: boolean;
  isPaused: boolean;
  onPlaybackChange: (playing: boolean) => void;
};

type TrackIndex = number;

export const GarageSoundtrack = React.forwardRef<GarageSoundtrackHandle, GarageSoundtrackProps>(function GarageSoundtrack(
  { active, isPaused, onPlaybackChange },
  ref,
) {
  const [currentTrackIndex, setCurrentTrackIndex] = React.useState<TrackIndex>(() => Math.floor(Math.random() * SOUNDTRACK_PLAYLIST.length));
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [playbackError, setPlaybackError] = React.useState("");
  const playbackErrorRef = React.useRef("");
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const trackIndexRef = React.useRef(currentTrackIndex);
  const activeRef = React.useRef(active);
  const isPausedRef = React.useRef(isPaused);
  const wantsPlaybackRef = React.useRef(false);
  const playingRef = React.useRef(false);
  const fadeTimerRef = React.useRef<number | null>(null);
  const playRandomTrackRef = React.useRef<(excludeIndex?: number) => void>(() => {});
  activeRef.current = active;
  isPausedRef.current = isPaused;
  playbackErrorRef.current = playbackError;

  const reportPlaying = React.useCallback((playing: boolean) => {
    playingRef.current = playing;
    setIsPlaying(playing);
    onPlaybackChange(playing);
  }, [onPlaybackChange]);

  const cancelFade = React.useCallback(() => {
    if (fadeTimerRef.current !== null) {
      window.clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const fadeAudioTo = React.useCallback((target: number, onComplete?: () => void) => {
    const bgm = audioRef.current;
    if (!bgm) {
      onComplete?.();
      return;
    }
    cancelFade();
    const initialVolume = bgm.volume;
    const steps = 8;
    let step = 0;
    fadeTimerRef.current = window.setInterval(() => {
      step += 1;
      bgm.volume = Math.max(0, Math.min(1, initialVolume + (target - initialVolume) * (step / steps)));
      if (step >= steps) {
        cancelFade();
        onComplete?.();
      }
    }, 32);
  }, [cancelFade]);

  const playTrackAt = React.useCallback((requestedIndex: number) => {
    if (isPausedRef.current) return;
    const index = ((Math.trunc(requestedIndex) % SOUNDTRACK_PLAYLIST.length) + SOUNDTRACK_PLAYLIST.length) % SOUNDTRACK_PLAYLIST.length;
    const track = SOUNDTRACK_PLAYLIST[index];
    const previousBgm = audioRef.current;
    if (previousBgm) {
      previousBgm.onended = null;
      previousBgm.onerror = null;
      previousBgm.onplay = null;
      previousBgm.onpause = null;
      previousBgm.pause();
    }
    cancelFade();
    trackIndexRef.current = index;
    setCurrentTrackIndex(index);
    setPlaybackError("");
    wantsPlaybackRef.current = true;

    // Start Game calls this synchronously from its click handler. Only licensed
    // audio assets or authorized direct stream URLs should be placed in the list.
    const bgm = new Audio(track.url);
    bgm.preload = "auto";
    bgm.muted = false;
    bgm.volume = 1.0;
    audioRef.current = bgm;
    bgm.onplay = () => {
      if (audioRef.current === bgm) reportPlaying(true);
    };
    bgm.onpause = () => {
      if (audioRef.current === bgm) reportPlaying(false);
    };
    bgm.onerror = () => {
      if (audioRef.current !== bgm) return;
      wantsPlaybackRef.current = false;
      reportPlaying(false);
      setPlaybackError(`Audio stream unavailable for “${track.title}”. Check the direct MP3 URL.`);
    };
    bgm.onended = () => {
      if (
        audioRef.current !== bgm ||
        isPausedRef.current ||
        !activeRef.current ||
        !playingRef.current ||
        !wantsPlaybackRef.current
      ) return;
      playRandomTrackRef.current(index);
    };

    void bgm.play().then(() => {
      if (audioRef.current === bgm) reportPlaying(true);
    }).catch(() => {
      if (audioRef.current !== bgm) return;
      wantsPlaybackRef.current = false;
      reportPlaying(false);
      setPlaybackError(`Could not play “${track.title}”. Check the direct stream URL and browser permissions.`);
    });
  }, [cancelFade, reportPlaying]);

  const playSelectedTrack = React.useCallback(() => {
    playTrackAt(trackIndexRef.current);
  }, [playTrackAt]);

  React.useEffect(() => {
    const startOnFirstPageClick = () => {
      // Start only while the UI is still in READY TO PLAY. The listener runs
      // after React's click handler, so Start Game can start its random track first.
      if (audioRef.current || playbackErrorRef.current) return;
      playSelectedTrack();
    };
    window.addEventListener("click", startOnFirstPageClick, { once: true });
    return () => window.removeEventListener("click", startOnFirstPageClick);
  }, [playSelectedTrack]);

  const playRandomTrack = React.useCallback((excludeIndex?: number) => {
    const count = SOUNDTRACK_PLAYLIST.length;
    let index = Math.floor(Math.random() * count);
    if (typeof excludeIndex === "number" && count > 1 && index === excludeIndex) {
      index = (index + 1 + Math.floor(Math.random() * (count - 1))) % count;
    }
    playTrackAt(index);
  }, [playTrackAt]);
  playRandomTrackRef.current = playRandomTrack;

  const playAdjacentTrack = React.useCallback((direction: -1 | 1) => {
    playTrackAt(trackIndexRef.current + direction);
  }, [playTrackAt]);

  const togglePlayback = React.useCallback(() => {
    if (isPausedRef.current) return;
    const bgm = audioRef.current;
    if (!bgm) {
      wantsPlaybackRef.current = true;
      playTrackAt(trackIndexRef.current);
      return;
    }
    cancelFade();
    if (!bgm.paused) {
      wantsPlaybackRef.current = false;
      bgm.pause();
      reportPlaying(false);
      return;
    }
    wantsPlaybackRef.current = true;
    bgm.volume = 1.0;
    setPlaybackError("");
    void bgm.play().then(() => reportPlaying(true)).catch(() => {
      wantsPlaybackRef.current = false;
      reportPlaying(false);
      setPlaybackError("Could not play this track. Check the direct stream URL and browser permissions.");
    });
  }, [cancelFade, playTrackAt, reportPlaying]);

  const startRandomTrack = React.useCallback(() => {
    const randomIndex = Math.floor(Math.random() * SOUNDTRACK_PLAYLIST.length);
    playTrackAt(randomIndex);
  }, [playTrackAt]);

  const resumePlayback = React.useCallback(() => {
    if (!wantsPlaybackRef.current) return;
    void audioRef.current?.play().catch(() => {});
  }, []);

  React.useImperativeHandle(ref, () => ({
    startRandomTrack,
    togglePlayback,
    resumePlayback,
  }), [startRandomTrack, togglePlayback, resumePlayback]);

  React.useEffect(() => {
    const bgm = audioRef.current;
    if (!bgm) return;
    if (isPaused) {
      cancelFade();
      bgm.pause();
      bgm.volume = 1.0;
      reportPlaying(false);
      return;
    }
    if (!active) {
      if (!bgm.paused) {
        fadeAudioTo(0, () => {
          if (!activeRef.current) bgm.pause();
          bgm.volume = 1.0;
        });
      }
      return;
    }
    cancelFade();
    bgm.volume = 1.0;
    if (wantsPlaybackRef.current && bgm.paused) {
      void bgm.play().then(() => reportPlaying(true)).catch(() => {
        wantsPlaybackRef.current = false;
        reportPlaying(false);
        setPlaybackError("Could not resume this track. Check the direct stream URL and browser permissions.");
      });
    }
  }, [active, cancelFade, fadeAudioTo, isPaused, reportPlaying]);

  React.useEffect(() => () => {
    cancelFade();
    const bgm = audioRef.current;
    if (bgm) {
      bgm.onended = null;
      bgm.pause();
      audioRef.current = null;
    }
  }, [cancelFade]);

  const track = SOUNDTRACK_PLAYLIST[currentTrackIndex];
  const playbackLabel = playbackError || (isPlaying ? "PLAYING" : audioRef.current ? "PAUSED" : "READY TO PLAY");

  return (
    <section aria-label="Garage soundtrack" className="col-span-2 min-w-0 rounded-lg border border-white/8 bg-black/15 p-2.5">
      <div className="flex items-center gap-1.5 font-mono-tech text-[10px] uppercase tracking-wider text-zinc-200">
        <Music2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#F5C518]" />
        Garage soundtrack
      </div>
      <div className="mt-1 min-w-0">
        <div aria-live="polite" className="truncate font-mono-tech text-[10px] uppercase tracking-wider text-[#F5C518]">
          {track.title}
        </div>
        <div className="truncate text-[10px] text-zinc-400">{track.artist}</div>
      </div>
      <div aria-live="polite" className={`mt-1 min-h-3 break-words text-[9px] ${playbackError ? "text-rose-300" : "text-zinc-500"}`}>
        {playbackLabel}
      </div>
      <div className="mt-2 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => playAdjacentTrack(-1)}
          aria-label="Previous soundtrack"
          title="Previous track"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-300 transition-colors hover:border-[#F5C518]/40 hover:text-white"
        >
          <SkipBack aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={togglePlayback}
          aria-label={isPlaying ? "Pause soundtrack" : "Play soundtrack"}
          aria-pressed={isPlaying}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#F5C518]/40 bg-[#F5C518]/15 text-[#F5C518] transition-colors hover:bg-[#F5C518]/25"
        >
          {isPlaying ? <Pause aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => playAdjacentTrack(1)}
          aria-label="Next soundtrack"
          title="Next track"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-300 transition-colors hover:border-[#F5C518]/40 hover:text-white"
        >
          <SkipForward aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
});

import { Building2, Map, Waves } from "lucide-react";

export type CircuitTrackSummary = {
  id: string;
  region: string;
};

const TRACK_ARTWORK: Record<string, {
  Icon: typeof Map;
  landscape: string;
  routeShape: string;
  routeStart: [number, number];
}> = {
  manila: {
    Icon: Map,
    landscape: "linear-gradient(135deg, rgba(220,26,34,.45), rgba(13,16,24,.35) 58%, rgba(245,197,24,.16))",
    routeShape: "M24 28 L164 28 Q188 28 190 47 L182 68 Q178 78 158 78 L137 78 L128 88 L80 88 L49 80 Q31 76 27 59 Z",
    routeStart: [24, 28],
  },
  tokyo: {
    Icon: Waves,
    landscape: "linear-gradient(135deg, rgba(30,142,185,.45), rgba(13,16,24,.35) 58%, rgba(50,200,170,.18))",
    routeShape: "M24 38 C39 18 59 19 77 27 C99 37 106 13 130 17 C153 20 157 41 180 34 C202 27 204 51 183 57 C161 63 174 81 151 79 C127 77 119 58 96 63 C71 69 64 84 43 72 C24 62 13 51 24 38 Z",
    routeStart: [24, 38],
  },
  "new-york": {
    Icon: Building2,
    landscape: "linear-gradient(135deg, rgba(126,91,45,.42), rgba(13,16,24,.35) 58%, rgba(56,189,248,.18))",
    routeShape: "M25 22 L173 22 L194 39 L192 63 L171 78 L132 78 L119 65 L79 65 L72 82 L40 78 L23 57 L39 43 Z",
    routeStart: [25, 22],
  },
};

/** Shared map illustration used by both single-player race setup and lobby configuration. */
export function CircuitTrackArtwork({ map, selected }: { map: CircuitTrackSummary; selected: boolean }) {
  const { Icon, landscape, routeShape, routeStart } = TRACK_ARTWORK[map.id] ?? TRACK_ARTWORK.manila;
  return (
    <div className="relative flex h-16 items-end justify-between overflow-hidden p-3" style={{ background: landscape }}>
      <svg className="absolute inset-0 h-full w-full opacity-75" viewBox="0 0 220 96" fill="none" aria-hidden="true">
        <path d={routeShape} stroke={selected ? "#F5C518" : "#FFFFFF"} strokeOpacity="0.82" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={routeStart[0]} cy={routeStart[1]} r="3.5" fill={selected ? "#F5C518" : "#FFFFFF"} />
      </svg>
      <Icon className={`relative z-10 h-6 w-6 ${selected ? "text-[#F5C518]" : "text-white/80"}`} />
      <span className="relative rounded-full bg-black/45 px-2 py-1 font-mono-tech text-[9px] uppercase tracking-wider text-white/80">{map.region}</span>
    </div>
  );
}

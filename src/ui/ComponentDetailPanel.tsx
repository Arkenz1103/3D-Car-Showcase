// @ts-nocheck
import {
  CALIPER_SWATCHES,
  COMPONENT_IDS,
  COMPONENT_SPECS,
  PAINT_COLORS,
  POWER_MODES,
  WHEEL_SWATCHES,
} from "@/data/catalog";
import {
  ChevronLeft,
  ChevronRight,
  Cpu,
  Eye,
  Gauge,
  Layers,
  Lightbulb,
  Sparkles,
  Wind,
  X,
} from "lucide-react";

export const ComponentDetailPanel = ({
  componentId: Q,
  specOverride: A,
  isSF90: g = !0,
  onClose: I,
  onSelectComponent: C,
  meshInventory: E,
  paintHex: e,
  onChangePaintHex: o,
  caliperSwatch: l,
  onChangeCaliper: M,
  wheelSwatch: n,
  onChangeWheel: r,
  headlightsOn: h,
  onToggleHeadlights: V,
  brakeLightsOn: P,
  onToggleBrakeLights: y,
  highDownforceGurney: j,
  onToggleGurney: u,
  showAeroStreamlines: K,
  onToggleStreamlines: U,
  rollingRoad: p,
  onToggleRollingRoad: G,
  steeringAngleDeg: q,
  onChangeSteering: N,
  technicalView: W,
  onChangeTechnicalView: m,
  powerMode: X,
  onChangePowerMode: L,
}) => {
  if (!Q) return null;
  const gA = A ?? COMPONENT_SPECS[Q],
    QA = E.filter((IA) => IA.componentId === Q),
    AA = QA.reduce((IA, iA) => IA + iA.triangles, 0),
    CA = COMPONENT_IDS.indexOf(Q),
    R = COMPONENT_IDS[(CA - 1 + COMPONENT_IDS.length) % COMPONENT_IDS.length],
    z = COMPONENT_IDS[(CA + 1) % COMPONENT_IDS.length];
  return (
    <aside
      aria-label="Selected Component Specification Panel"
      className="fixed z-30 right-3 bottom-3 md:right-5 md:top-20 md:bottom-20 w-[calc(100vw-1.5rem)] md:w-[392px] max-h-[56vh] md:max-h-none atelier-panel rounded-2xl flex flex-col overflow-hidden transition-all duration-300"
    >
      <div className="px-5 pt-4 pb-3.5 border-b border-white/10 flex items-start justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#DC1A22] animate-pulse" />
            <span className="font-mono-tech text-[10px] tracking-[0.16em] text-[#F5C518] uppercase">
              {gA.code}
            </span>
            <span className="font-mono-tech text-[10px] text-zinc-500">
              {"· "}
              {QA.length} {QA.length === 1 ? "Mesh" : "Meshes"}
              {" ("}
              {AA.toLocaleString()}
              {" tris)"}
            </span>
          </div>
          <h2 className="font-display text-lg font-semibold text-white leading-snug">{gA.name}</h2>
          <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{gA.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={I}
          title="Close Specification Panel"
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/12 text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-5 space-y-4 overflow-y-auto custom-scroll flex-1 text-xs">
        {g &&
          (Q === "aero_gurney" ||
            Q === "carbon_splitter" ||
            Q === "carbon_diffuser" ||
            Q === "carbon_skirts") && (
            <div className="p-3 rounded-xl bg-white/[0.035] border border-white/10 space-y-2.5">
              <div className="font-mono-tech text-[10px] uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5 text-[#38BDF8]" />
                {" Live Aerodynamic Actuation"}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={u}
                  className={`px-3 py-2 rounded-lg font-mono-tech text-[11px] border transition-all cursor-pointer ${j ? "bg-[#DC1A22]/25 border-[#DC1A22] text-white" : "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10"}`}
                >
                  {j ? "GURNEY: HIGH DF (390 kg)" : "GURNEY: LOW DRAG"}
                </button>
                <button
                  type="button"
                  onClick={U}
                  className={`px-3 py-2 rounded-lg font-mono-tech text-[11px] border transition-all cursor-pointer ${K ? "bg-sky-500/20 border-sky-400 text-sky-200" : "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10"}`}
                >
                  {K ? "CFD FLOW: ACTIVE" : "SHOW CFD FLOW"}
                </button>
              </div>
            </div>
          )}
        {g && Q === "headlights" && (
          <div className="p-3 rounded-xl bg-white/[0.035] border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-200">
              <Lightbulb className="w-4 h-4 text-sky-300" />
              <span className="font-medium">Matrix LED Active Beam</span>
            </div>
            <button
              type="button"
              onClick={V}
              className={`px-3 py-1.5 rounded-lg font-mono-tech text-[11px] border cursor-pointer transition-all ${h ? "bg-sky-400/20 border-sky-300 text-white" : "bg-white/5 border-white/10 text-zinc-400"}`}
            >
              {h ? "BEAM ON" : "STANDBY"}
            </button>
          </div>
        )}
        {g && Q === "taillights" && (
          <div className="p-3 rounded-xl bg-white/[0.035] border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-200">
              <Sparkles className="w-4 h-4 text-[#DC1A22]" />
              <span className="font-medium">Brake-by-Wire Lamp Load</span>
            </div>
            <button
              type="button"
              onClick={y}
              className={`px-3 py-1.5 rounded-lg font-mono-tech text-[11px] border cursor-pointer transition-all ${P ? "bg-[#DC1A22]/30 border-[#DC1A22] text-white" : "bg-white/5 border-white/10 text-zinc-300"}`}
            >
              {P ? "FULL BRAKE STOP" : "TAIL RUNNING"}
            </button>
          </div>
        )}
        {Q === "paintwork" && (
          <div className="p-3 rounded-xl bg-white/[0.035] border border-white/10 space-y-2">
            <div className="font-mono-tech text-[10px] uppercase tracking-widest text-zinc-400">
              Quick Maranello Paint Selection
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {PAINT_COLORS.map((IA) => (
                <button
                  key={IA.id}
                  type="button"
                  title={`${IA.name} (${IA.code})`}
                  onClick={() => o(IA.hex)}
                  style={{
                    backgroundColor: IA.hex,
                  }}
                  className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${e.toLowerCase() === IA.hex.toLowerCase() ? "ring-2 ring-white scale-110" : "ring-1 ring-white/25 hover:scale-105"}`}
                />
              ))}
            </div>
          </div>
        )}
        {Q === "calipers" && (
          <div className="p-3 rounded-xl bg-white/[0.035] border border-white/10 space-y-2">
            <div className="font-mono-tech text-[10px] uppercase tracking-widest text-zinc-400">
              Brembo Monoblock Finish
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {CALIPER_SWATCHES.map((IA) => (
                  <button
                    key={IA.id}
                    type="button"
                    title={IA.name}
                    onClick={() => M(IA)}
                    style={{
                      backgroundColor: IA.hex,
                    }}
                    className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${l.id === IA.id ? "ring-2 ring-white scale-110" : "ring-1 ring-white/25 hover:scale-105"}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={G}
                className={`px-2.5 py-1 rounded-lg font-mono-tech text-[10px] border cursor-pointer ${p ? "bg-[#F5C518]/20 border-[#F5C518] text-[#F5C518]" : "bg-white/5 border-white/10 text-zinc-300"}`}
              >
                {p ? "250 KM/H SPIN" : "SPIN ROTORS"}
              </button>
            </div>
          </div>
        )}
        {(Q === "wheels" || Q === "brakes_ccm" || Q === "tires") && (
          <div className="p-3 rounded-xl bg-white/[0.035] border border-white/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {WHEEL_SWATCHES.map((IA) => (
                <button
                  key={IA.id}
                  type="button"
                  title={IA.name}
                  onClick={() => r(IA)}
                  style={{
                    backgroundColor: IA.hex,
                  }}
                  className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${n.id === IA.id ? "ring-2 ring-white scale-110" : "ring-1 ring-white/25 hover:scale-105"}`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={G}
              className={`px-3 py-1.5 rounded-lg font-mono-tech text-[10px] border cursor-pointer flex items-center gap-1.5 ${p ? "bg-[#F5C518]/20 border-[#F5C518] text-[#F5C518]" : "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10"}`}
            >
              <Gauge className="w-3.5 h-3.5" />
              {p ? "STOP DYNAMO" : "SPIN @ 250 KM/H"}
            </button>
          </div>
        )}
        {g && (Q === "steering_wheel" || Q === "cockpit") && (
          <div className="p-3 rounded-xl bg-white/[0.035] border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono-tech text-[10px] uppercase tracking-widest text-zinc-400">
                eManettino Live Cluster Mode
              </span>
              <span className="font-mono-tech text-[10px] text-[#F5C518]">
                {"STEER "}
                {q > 0 ? `+${q}°` : `${q}°`}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {POWER_MODES.map((IA) => (
                <button
                  key={IA.id}
                  type="button"
                  onClick={() => L(IA.id)}
                  className={`py-1.5 px-1 rounded-md font-mono-tech text-[10px] border cursor-pointer transition-all ${X === IA.id ? "bg-white/15 border-white text-white font-semibold" : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"}`}
                >
                  {IA.name}
                </button>
              ))}
            </div>
            <input
              type="range"
              min={-26}
              max={26}
              value={q}
              onChange={(IA) => N(Number(IA.target.value))}
              className="w-full accent-[#DC1A22] cursor-pointer h-1.5"
            />
          </div>
        )}
        {(Q === "engine_v8" || Q === "hybrid_system") && (
          <div className="p-3 rounded-xl bg-white/[0.035] border border-white/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-zinc-200">
              <Eye className="w-4 h-4 text-[#F5C518]" />
              <span className="text-[11px]">X-Ray Cutaway Shell</span>
            </div>
            <button
              type="button"
              onClick={() => m(W === "xray" ? "solid" : "xray")}
              className={`px-3 py-1.5 rounded-lg font-mono-tech text-[10px] border cursor-pointer transition-all ${W === "xray" ? "bg-[#F5C518]/20 border-[#F5C518] text-[#F5C518]" : "bg-white/8 border-white/15 text-white hover:bg-white/15"}`}
            >
              {W === "xray" ? "RESTORE BODYWORK" : "ENABLE X-RAY VIEW"}
            </button>
          </div>
        )}
        <div className="space-y-3">
          <div>
            <h3 className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-1">
              Design & Packaging
            </h3>
            <p className="text-zinc-200 leading-relaxed">{gA.design}</p>
          </div>
          <div>
            <h3 className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-1">
              Aerodynamic & Mechanical Function
            </h3>
            <p className="text-zinc-300 leading-relaxed">{gA.function}</p>
          </div>
          <div>
            <h3 className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-1 flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-[#DC1A22]" />
              {" Materials & Metallurgy"}
            </h3>
            <p className="text-zinc-300 leading-relaxed">{gA.materials}</p>
          </div>
        </div>
        <div className="pt-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-[#F5C518] flex items-center gap-1.5">
              <Cpu className="w-3 h-3" />
              {" Verified Factory Specifications"}
            </h3>
            <span className="font-mono-tech text-[9px] text-zinc-500 uppercase">
              {g ? "Maranello F173" : "Manufacturer data"}
            </span>
          </div>
          <div className="rounded-xl border border-white/10 divide-y divide-white/[0.06] overflow-hidden bg-black/30">
            {gA.verifiedSpecs.map((IA) => (
              <div key={IA.label} className="px-3 py-2 flex items-center justify-between gap-3">
                <span className="text-zinc-400 text-[11px]">{IA.label}</span>
                <div className="text-right">
                  <div className="font-mono-tech text-[11px] font-medium text-white">{IA.value}</div>
                  {IA.detail && <div className="font-mono-tech text-[9px] text-zinc-500">{IA.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="px-4 py-2.5 border-t border-white/10 bg-black/35 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={() => C(R)}
          className="flex items-center gap-1 text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-white/5"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="font-mono-tech text-[10px] uppercase">Prev System</span>
        </button>
        <span className="font-mono-tech text-[10px] text-zinc-500">
          {String(CA + 1).padStart(2, "0")}
          {" / "}
          {String(COMPONENT_IDS.length).padStart(2, "0")}
        </span>
        <button
          type="button"
          onClick={() => C(z)}
          className="flex items-center gap-1 text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-white/5"
        >
          <span className="font-mono-tech text-[10px] uppercase">Next System</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};

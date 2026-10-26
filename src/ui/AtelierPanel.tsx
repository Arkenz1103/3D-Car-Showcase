// @ts-nocheck
import {
  CALIPER_SWATCHES,
  CARS,
  COMPONENT_IDS,
  COMPONENT_SPECS,
  INTERIOR_SWATCHES,
  PAINT_COLORS,
  PAINT_FINISHES,
  PANEL_SECTIONS,
  POWER_MODES,
  STUDIO_THEMES,
  WHEEL_SWATCHES,
} from "@/data/catalog";
import { getBundledGlbUrl } from "@/lib/gltf";
import {
  Box,
  Car,
  Check,
  Download,
  FileUp,
  Layers,
  Palette,
  RefreshCcw,
  SlidersVertical,
  Sparkles,
  Upload,
  X as CloseIcon,
  Zap,
} from "lucide-react";
import React from "react";

export const AtelierPanel = ({
  open: Q,
  activeTab: A,
  onChangeTab: g,
  onClose: I,
  paintHex: C,
  onChangePaintHex: E,
  paintFinish: e,
  onChangePaintFinish: o,
  wheelSwatch: l,
  onChangeWheelSwatch: M,
  caliperSwatch: n,
  onChangeCaliperSwatch: r,
  interiorSwatch: h,
  onChangeInteriorSwatch: V,
  matteCarbon: P,
  onToggleMatteCarbon: y,
  studioTheme: j,
  onChangeStudioTheme: u,
  technicalView: K,
  onChangeTechnicalView: U,
  powerMode: p,
  onChangePowerMode: G,
  highDownforceGurney: q,
  onToggleGurney: N,
  showAeroStreamlines: W,
  onToggleStreamlines: m,
  rollingRoad: X,
  onToggleRollingRoad: L,
  headlightsOn: gA,
  onToggleHeadlights: QA,
  brakeLightsOn: AA,
  onToggleBrakeLights: CA,
  steeringAngleDeg: R,
  onChangeSteering: z,
  showHotspotPins: IA,
  onToggleHotspotPins: iA,
  selectedComponent: DA,
  onSelectComponent: H,
  activeCarId: wA,
  onSelectCar: BA,
  loadingAsset: MA,
  vehicleAsset: WA,
  meshInventory: JA,
  onUploadCustomGlbFile: nA,
  onLoadCustomGlbUrl: rA,
  onResetBundledGlb: kA,
}) => {
  const og = React.useRef(null),
    [$A, Ug] = React.useState("");
  if (!Q) return null;
  const Tg = POWER_MODES.find((hA) => hA.id === p),
    XA = PAINT_COLORS.find((hA) => hA.hex.toLowerCase() === C.toLowerCase());
  return (
    <section
      aria-label="Atelier Configurator and Engineering Controls"
      className="showroom-panel fixed z-30 left-3 top-18 bottom-20 md:left-5 md:top-20 md:bottom-20 w-[calc(100vw-1.5rem)] sm:w-[364px] atelier-panel rounded-2xl flex flex-col overflow-hidden"
    >
      <div className="grid grid-cols-[repeat(5,minmax(0,1fr))_24px] border-b border-white/10 bg-black/30 p-1.5 gap-1 shrink-0">
        {[
          {
            id: "garage",
            label: "Garage",
            icon: Car,
          },
          {
            id: "customize",
            label: "Atelier",
            icon: Palette,
          },
          {
            id: "systems",
            label: "Tech Lab",
            icon: SlidersVertical,
          },
          {
            id: "components",
            label: "Parts",
            icon: Layers,
          },
          {
            id: "asset",
            label: "GLB",
            icon: Box,
          },
        ].map((hA) => {
          const TabIcon = hA.icon,
            HA = A === hA.id;
          return (
            <button
              key={hA.id}
              type="button"
              onClick={() => g(hA.id)}
              className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl font-mono-tech text-[10px] uppercase tracking-wider transition-all cursor-pointer ${HA ? "bg-white/12 text-white border border-white/15 shadow-sm" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"}`}
            >
              <TabIcon className={`w-3.5 h-3.5 ${HA ? "text-[#DC1A22]" : ""}`} />
              <span>{hA.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={I}
          aria-label="Close configurator"
          title="Close configurator"
          className="self-start cursor-pointer rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-4 space-y-5 overflow-y-auto custom-scroll flex-1 text-xs">
        {A === "garage" && (
          <div className="space-y-3">
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Three licensed supercars are bundled (Draco-compressed, lazy-decoded only when selected). Every
              car keeps full 360° orbit, click-to-inspect raycasting, live paint, caliper and wheel
              customization.
            </p>
            {CARS.map((hA) => {
              const vA = hA.id === wA;
              return (
                <button
                  key={hA.id}
                  type="button"
                  disabled={MA}
                  onClick={() => BA(hA.id)}
                  className={`w-full p-3.5 rounded-2xl border text-left transition-all cursor-pointer disabled:opacity-60 ${vA ? "bg-white/12 border-white/40" : "bg-white/[0.03] border-white/8 hover:border-white/25"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div
                        className="font-mono-tech text-[9px] uppercase tracking-[0.18em]"
                        style={{
                          color: hA.accentHex,
                        }}
                      >
                        {hA.brand}
                        {" · "}
                        {hA.year}
                      </div>
                      <div className="font-display text-sm font-semibold text-white">{hA.model}</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">{hA.tagline}</div>
                    </div>
                    <span
                      className={`shrink-0 font-mono-tech text-[9px] uppercase px-2 py-1 rounded-md ${vA ? "bg-white text-black" : "bg-white/8 text-zinc-300"}`}
                    >
                      {vA ? (MA ? "Loading" : "In Studio") : "Select"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 mt-3">
                    {hA.telemetry.slice(0, 3).map((HA) => (
                      <div key={HA.label} className="rounded-lg bg-black/35 px-2 py-1.5">
                        <div className="font-mono-tech text-[8px] uppercase tracking-wider text-zinc-500 truncate">
                          {HA.label}
                        </div>
                        <div className="font-display text-[12px] font-semibold text-white">{HA.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 font-mono-tech text-[9px] text-zinc-500 leading-relaxed">
                    {hA.license.title}
                    {" — "}
                    {hA.license.author}
                    {" · "}
                    {hA.license.license}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {A === "customize" && (
          <>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-zinc-400">
                  Exterior Coachwork Livery
                </span>
                <span className="font-mono-tech text-[11px] text-white font-medium">
                  {XA ? `${XA.name} (${XA.code})` : C.toUpperCase()}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {PAINT_COLORS.map((hA) => {
                  const vA = hA.hex.toLowerCase() === C.toLowerCase();
                  return (
                    <button
                      key={hA.id}
                      type="button"
                      onClick={() => E(hA.hex)}
                      className={`group p-2 rounded-xl border text-left transition-all cursor-pointer ${vA ? "bg-white/12 border-white/40" : "bg-white/[0.03] border-white/8 hover:border-white/20"}`}
                    >
                      <div
                        className="w-full h-5 rounded-md mb-1.5 border border-white/20 flex items-center justify-end pr-1"
                        style={{
                          backgroundColor: hA.hex,
                        }}
                      >
                        {vA && <Check className="w-3 h-3 text-white drop-shadow" />}
                      </div>
                      <div className="text-[10px] text-zinc-200 font-medium truncate">
                        {hA.name.replace(" ", " ")}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] border border-white/8">
                <span className="text-[11px] text-zinc-400">Tailor Made Custom Pigment</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="font-mono-tech text-[10px] text-zinc-300 uppercase">{C}</span>
                  <input
                    type="color"
                    value={C}
                    onChange={(hA) => E(hA.target.value)}
                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                  />
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-zinc-400 block">
                Clearcoat & Micro-Flake Finish
              </span>
              <div className="grid grid-cols-2 gap-2">
                {PAINT_FINISHES.map((hA) => {
                  const vA = e.id === hA.id;
                  return (
                    <button
                      key={hA.id}
                      type="button"
                      onClick={() => o(hA)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${vA ? "bg-white/12 border-[#DC1A22] text-white" : "bg-white/[0.03] border-white/8 text-zinc-300 hover:border-white/20"}`}
                    >
                      <div className="font-medium text-[11px] flex items-center justify-between">
                        <span>{hA.name}</span>
                        {vA && <Sparkles className="w-3 h-3 text-[#F5C518]" />}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5 truncate">{hA.subtitle}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/8 space-y-2">
                <div className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400">
                  20" Forged Wheels
                </div>
                <div className="text-[11px] text-white font-medium truncate">{l.name}</div>
                <div className="flex items-center gap-2 pt-0.5">
                  {WHEEL_SWATCHES.map((hA) => (
                    <button
                      key={hA.id}
                      type="button"
                      title={hA.name}
                      onClick={() => M(hA)}
                      style={{
                        backgroundColor: hA.hex,
                      }}
                      className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${l.id === hA.id ? "ring-2 ring-white scale-110" : "ring-1 ring-white/25 hover:scale-105"}`}
                    />
                  ))}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/8 space-y-2">
                <div className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400">
                  Brembo Calipers
                </div>
                <div className="text-[11px] text-white font-medium truncate">{n.name}</div>
                <div className="flex items-center gap-1.5 pt-0.5">
                  {CALIPER_SWATCHES.map((hA) => (
                    <button
                      key={hA.id}
                      type="button"
                      title={hA.name}
                      onClick={() => r(hA)}
                      style={{
                        backgroundColor: hA.hex,
                      }}
                      className={`w-5 h-5 rounded-full cursor-pointer transition-transform ${n.id === hA.id ? "ring-2 ring-white scale-110" : "ring-1 ring-white/25 hover:scale-105"}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/8 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400">
                    Cockpit Upholstery & CFRP
                  </div>
                  <div className="text-[11px] text-white font-medium">{h.name}</div>
                </div>
                <button
                  type="button"
                  onClick={y}
                  className={`px-2.5 py-1 rounded-lg font-mono-tech text-[10px] border cursor-pointer ${P ? "bg-white/15 border-white/40 text-white" : "bg-white/5 border-white/10 text-zinc-300"}`}
                >
                  {P ? "CFRP: MATTE" : "CFRP: GLOSS"}
                </button>
              </div>
              <div className="flex items-center gap-2">
                {INTERIOR_SWATCHES.map((hA) => (
                  <button
                    key={hA.id}
                    type="button"
                    title={hA.name}
                    onClick={() => V(hA)}
                    style={{
                      backgroundColor: hA.hex,
                    }}
                    className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${h.id === hA.id ? "ring-2 ring-white scale-110" : "ring-1 ring-white/25 hover:scale-105"}`}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-zinc-400 block">
                Architectural Studio Lighting
              </span>
              <div className="space-y-1.5">
                {STUDIO_THEMES.map((hA) => {
                  const vA = j.id === hA.id;
                  return (
                    <button
                      key={hA.id}
                      type="button"
                      onClick={() => u(hA)}
                      className={`w-full px-3 py-2 rounded-xl border flex items-center justify-between text-left cursor-pointer transition-all ${vA ? "bg-white/12 border-white/35 text-white" : "bg-white/[0.025] border-white/8 text-zinc-300 hover:bg-white/[0.05]"}`}
                    >
                      <div>
                        <div className="text-[11px] font-medium">{hA.name}</div>
                        <div className="text-[10px] text-zinc-500">{hA.subtitle}</div>
                      </div>
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0"
                        style={{
                          backgroundColor: hA.rimColor,
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
        {A === "systems" && (
          <>
            <div className="space-y-2">
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-zinc-400 block">
                Engineering Visualization Mode
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  {
                    id: "solid",
                    label: "Studio PBR",
                  },
                  {
                    id: "xray",
                    label: "X-Ray Cutaway",
                  },
                  {
                    id: "wireframe",
                    label: "CAD Mesh",
                  },
                ].map((hA) => (
                  <button
                    key={hA.id}
                    type="button"
                    onClick={() => U(hA.id)}
                    className={`py-2 px-2 rounded-xl font-mono-tech text-[10px] uppercase border cursor-pointer transition-all ${K === hA.id ? "bg-[#DC1A22]/25 border-[#DC1A22] text-white font-semibold" : "bg-white/[0.04] border-white/10 text-zinc-300 hover:bg-white/8"}`}
                  >
                    {hA.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                {"Enable "}
                <strong className="text-zinc-200">X-Ray Cutaway</strong>
                {
                  " to ghost exterior coachwork and click directly on the mid-mounted F154FA V8, axial-flux MGU-K, 7.9 kWh battery pack, and front twin RAC-e motors."
                }
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.035] border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-zinc-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-[#F5C518]" />
                  {" eManettino Powertrain Logic"}
                </span>
                <span
                  className="font-mono-tech text-[10px] font-semibold px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: `${Tg.accentHex}22`,
                    color: Tg.accentHex,
                  }}
                >
                  {Tg.combinedOutput}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {POWER_MODES.map((hA) => (
                  <button
                    key={hA.id}
                    type="button"
                    onClick={() => G(hA.id)}
                    className={`py-1.5 px-1 rounded-lg font-mono-tech text-[10px] border cursor-pointer transition-all ${p === hA.id ? "bg-white/15 border-white text-white font-semibold" : "bg-white/5 border-white/8 text-zinc-400 hover:text-zinc-200"}`}
                  >
                    {hA.name}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">{Tg.description}</p>
              <div className="pt-1 border-t border-white/8 space-y-1 font-mono-tech text-[10px]">
                <div className="flex justify-between">
                  <span className="text-zinc-500">F154FA 4.0L V8:</span>
                  <span className="text-zinc-200">{Tg.v8State}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">3× Electric Drive:</span>
                  <span className="text-zinc-200">{Tg.electricState}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-zinc-400 block">
                Active Hardware & Wind-Tunnel Controls
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={N}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${q ? "bg-[#DC1A22]/25 border-[#DC1A22] text-white" : "bg-white/[0.03] border-white/10 text-zinc-300"}`}
                >
                  <div className="font-mono-tech text-[10px] uppercase">Shut-Off Gurney</div>
                  <div className="text-[11px] font-semibold mt-0.5">
                    {q ? "High Downforce (390kg)" : "Low-Drag Flush"}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={m}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${W ? "bg-sky-500/20 border-sky-400 text-sky-100" : "bg-white/[0.03] border-white/10 text-zinc-300"}`}
                >
                  <div className="font-mono-tech text-[10px] uppercase">CFD Aero Flow</div>
                  <div className="text-[11px] font-semibold mt-0.5">
                    {W ? "Laminar Ribbons ON" : "Streamlines OFF"}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={L}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${X ? "bg-[#F5C518]/20 border-[#F5C518] text-white" : "bg-white/[0.03] border-white/10 text-zinc-300"}`}
                >
                  <div className="font-mono-tech text-[10px] uppercase">Rolling Dynamo</div>
                  <div className="text-[11px] font-semibold mt-0.5">
                    {X ? "Spinning @ 250 km/h" : "Static Showroom"}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={iA}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${IA ? "bg-white/14 border-white/35 text-white" : "bg-white/[0.03] border-white/10 text-zinc-300"}`}
                >
                  <div className="font-mono-tech text-[10px] uppercase">3D Callout Pins</div>
                  <div className="text-[11px] font-semibold mt-0.5">
                    {IA ? "Visible on Car" : "Clean Sculpture"}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={QA}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${gA ? "bg-sky-400/20 border-sky-300 text-white" : "bg-white/[0.03] border-white/10 text-zinc-300"}`}
                >
                  <div className="font-mono-tech text-[10px] uppercase">Matrix LEDs</div>
                  <div className="text-[11px] font-semibold mt-0.5">{gA ? "Active Beam ON" : "DRL Off"}</div>
                </button>
                <button
                  type="button"
                  onClick={CA}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${AA ? "bg-[#DC1A22]/30 border-[#DC1A22] text-white" : "bg-white/[0.03] border-white/10 text-zinc-300"}`}
                >
                  <div className="font-mono-tech text-[10px] uppercase">Quad Taillights</div>
                  <div className="text-[11px] font-semibold mt-0.5">
                    {AA ? "Full Brake Load" : "Running Lamps"}
                  </div>
                </button>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
              <div className="flex items-center justify-between font-mono-tech text-[10px]">
                <span className="uppercase text-zinc-400">Front Axle & F1 Wheel Angle</span>
                <span className="text-white">{R > 0 ? `+${R}°` : `${R}°`}</span>
              </div>
              <input
                type="range"
                min={-26}
                max={26}
                value={R}
                onChange={(hA) => z(Number(hA.target.value))}
                className="w-full accent-[#DC1A22] cursor-pointer h-1.5"
              />
              <div className="flex justify-between font-mono-tech text-[9px] text-zinc-500">
                <button type="button" onClick={() => z(-22)} className="hover:text-zinc-300 cursor-pointer">
                  -22° Left Lock
                </button>
                <button type="button" onClick={() => z(0)} className="hover:text-zinc-300 cursor-pointer">
                  0° Center
                </button>
                <button type="button" onClick={() => z(22)} className="hover:text-zinc-300 cursor-pointer">
                  +22° Right Lock
                </button>
              </div>
            </div>
          </>
        )}
        {A === "components" && (
          <div className="space-y-4">
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Click any modeled subsystem directly on the 3D car or select from the index below to focus the
              studio camera, isolate its meshes, and inspect verified specifications.
            </p>
            {PANEL_SECTIONS.map((hA) => {
              const vA = COMPONENT_IDS.map((HA) => COMPONENT_SPECS[HA]).filter((HA) => HA.category === hA);
              return (
                <div key={hA} className="space-y-1.5">
                  <div className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-[#F5C518]">
                    {hA}
                  </div>
                  <div className="space-y-1">
                    {vA.map((HA) => {
                      const lg = DA === HA.id;
                      return (
                        <button
                          key={HA.id}
                          type="button"
                          onClick={() => H(HA.id)}
                          className={`w-full px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 cursor-pointer transition-all ${lg ? "bg-[#DC1A22]/20 border-[#DC1A22] text-white" : "bg-white/[0.025] border-white/8 text-zinc-300 hover:bg-white/[0.06]"}`}
                        >
                          <div className="min-w-0">
                            <div className="text-[11px] font-medium truncate">{HA.name}</div>
                            <div className="font-mono-tech text-[9px] text-zinc-500">{HA.code}</div>
                          </div>
                          <span className="font-mono-tech text-[10px] text-zinc-400 shrink-0">Focus →</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {A === "asset" && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-[#F5C518]/[0.07] border border-[#F5C518]/30 space-y-2">
              <div className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-[#F5C518] font-semibold">
                3D GLB Asset Provenance & Replaceable Architecture
              </div>
              <p className="text-[11px] text-zinc-200 leading-relaxed">
                {"Official factory CAD geometry for the "}
                <strong>Ferrari SF90 Stradale (F173)</strong> is proprietary to Ferrari S.p.A. and unavailable
                as a royalty-free open asset.
              </p>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                {"This showroom runs on a real binary "}
                <strong>glTF 2.0 (.glb)</strong>
                {" pipeline: it auto-loads "}
                <code className="text-zinc-200">public/models/sf90-stradale.glb</code>{" "}
                {"when present, and ships with our compiled "}
                <strong>73-mesh composite reference GLB</strong> (pairing the CC-BY 4.0 Ferrari mid-engine V8
                berlinetta NURBS coachwork/interior mesh with custom SF90 Stradale Shut-Off Gurney, 4-corner
                Brembo calipers, F154FA V8, and 3-motor MGU-K / RAC-e hybrid powertrain geometry).
              </p>
            </div>
            {WA && (
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5 font-mono-tech text-[10px]">
                <div className="text-zinc-400 uppercase">Active Loaded GLB Asset</div>
                <div className="text-white text-[11px] font-medium break-words">{WA.sourceLabel}</div>
                <div className="flex items-center justify-between pt-1 text-zinc-400">
                  <span>
                    {"Meshes: "}
                    {WA.meshCount}
                  </span>
                  <span>
                    {"Triangles: "}
                    {WA.triangleCount.toLocaleString()}
                  </span>
                  <span>
                    {"Size: "}
                    {WA.fileSizeMB}
                    {" MB"}
                  </span>
                </div>
              </div>
            )}
            <div className="space-y-2.5">
              <input
                ref={og}
                type="file"
                accept=".glb,.gltf"
                className="hidden"
                onChange={(hA) => {
                  const vA = hA.target.files?.[0];
                  (vA && nA(vA), (hA.target.value = ""));
                }}
              />
              <button
                type="button"
                onClick={() => og.current?.click()}
                className="w-full py-2.5 px-3 rounded-xl bg-[#DC1A22] hover:bg-[#b8141b] text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Hot-Swap Custom SF90 .GLB / .GLTF File</span>
              </button>
              <div className="text-[10px] text-zinc-500 text-center">
                {"Or drag & drop any "}
                <code>.glb</code>
                {" file anywhere onto the 3D showroom"}
              </div>
              <form
                onSubmit={(hA) => {
                  (hA.preventDefault(), $A.trim() && rA($A.trim()));
                }}
                className="flex gap-1.5"
              >
                <input
                  type="url"
                  placeholder="https://example.com/sf90-stradale.glb"
                  value={$A}
                  onChange={(hA) => Ug(hA.target.value)}
                  className="flex-1 bg-black/50 border border-white/12 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/35"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/18 text-white font-mono-tech text-[10px] uppercase cursor-pointer"
                >
                  Load
                </button>
              </form>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {!WA?.isBundledReference && (
                  <button
                    type="button"
                    onClick={kA}
                    className="py-2 px-2.5 rounded-lg bg-white/8 hover:bg-white/14 text-zinc-200 font-mono-tech text-[10px] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    {" Reset Reference"}
                  </button>
                )}
                <a
                  href={getBundledGlbUrl()}
                  download="sf90-stradale-showroom.glb"
                  className="py-2 px-2.5 rounded-lg bg-white/8 hover:bg-white/14 text-zinc-200 font-mono-tech text-[10px] flex items-center justify-center gap-1.5 col-span-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  {" Export Active 73-Mesh .GLB (1.49 MB)"}
                </a>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-zinc-400 flex items-center justify-between">
                <span>Selectable GLB Scene Meshes ({JA.length})</span>
                <FileUp className="w-3 h-3 text-zinc-500" />
              </div>
              <div className="max-h-48 overflow-y-auto custom-scroll rounded-xl border border-white/8 divide-y divide-white/[0.05] bg-black/35">
                {JA.map((hA) => (
                  <button
                    key={hA.uuid}
                    type="button"
                    onClick={() => H(hA.componentId)}
                    className={`w-full px-2.5 py-1.5 text-left flex items-center justify-between hover:bg-white/8 cursor-pointer ${DA === hA.componentId ? "bg-[#DC1A22]/15 text-white" : "text-zinc-300"}`}
                  >
                    <span className="font-mono-tech text-[10px] truncate pr-2">{hA.name}</span>
                    <span className="font-mono-tech text-[9px] text-zinc-500 shrink-0">
                      {hA.triangles.toLocaleString()}t
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="px-4 py-2 border-t border-white/10 bg-black/35 flex items-center justify-between shrink-0 md:hidden">
        <span className="font-mono-tech text-[10px] text-zinc-500 uppercase">Atelier Studio</span>
        <button
          type="button"
          onClick={I}
          className="font-mono-tech text-[10px] uppercase text-white bg-white/10 px-3 py-1 rounded-md"
        >
          Done
        </button>
      </div>
    </section>
  );
};

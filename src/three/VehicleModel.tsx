// @ts-nocheck
import BUNDLED_PNG_URL from "@/assets/textures/bundled";
import { COMPONENT_IDS, COMPONENT_SPECS, HOTSPOT_IDS } from "@/data/catalog";
import { classifyMesh } from "@/lib/gltf";
import { liftTimeline } from "@/three/liftTimeline";
import { raceDrive } from "@/three/raceEngine";
import { markShadowsDirty } from "./sceneMotion";
import { getNeonPalette } from "./neonColor";
import { drawDashboardDisplay, makeStudioTextures } from "@/three/textures";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import React from "react";
import { clone as cloneScene } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  AdditiveBlending,
  Box3,
  CanvasTexture,
  Color,
  DoubleSide,
  MathUtils,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SRGBColorSpace,
  Sphere,
  SpotLight,
  Vector2,
  Vector3,
} from "three";

// ---------------------------------------------------------------------------
// Door handling
//
// Several of the bundled showroom models are authored with the doors swung
// open (the hinge node itself carries the open rotation, the panels are modelled
// shut). Racing with the doors flapping in the wind looks broken, so every
// `*_hinge` node discovered on the clone is damped back to its neutral
// (identity) pose as soon as `raceDrive.active` goes true.
//
// Models that ship with the doors already shut — or with no door nodes at all
// (`car-3`, the SF90's lone `Aero_Door_Latches`) — are simply a no-op: a hinge
// that is already at identity fails the `angleTo` test and is skipped.
// ---------------------------------------------------------------------------
const DOOR_CLOSED = new Quaternion();
const STEERING_AXIS_Z = new Vector3(0, 0, 1);

/** Paint-matched underbody pools and cool cabin practicals.
 * Light objects stay mounted; toggling only flips their visibility. */
export function NeonLighting({ enabled, bodyColor }) {
  const lights = React.useMemo(() => Array.from({ length: 6 }, () => React.createRef()), []);
  const materials = React.useMemo(() => Array.from({ length: 2 }, () => React.createRef()), []);
  const palette = React.useMemo(() => getNeonPalette(bodyColor), [bodyColor]);
  const glowTexture = React.useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (context) {
      const glow = context.createRadialGradient(64, 64, 3, 64, 64, 64);
      glow.addColorStop(0, "rgba(255,255,255,0.9)");
      glow.addColorStop(0.22, "rgba(255,255,255,0.66)");
      glow.addColorStop(0.55, "rgba(255,255,255,0.2)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, 128, 128);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, []);

  React.useEffect(() => () => glowTexture.dispose(), [glowTexture]);

  React.useLayoutEffect(() => {
    lights.forEach((ref, index) => {
      const light = ref.current;
      if (!light) return;
      light.visible = enabled;
      light.color.set(index < 4 ? palette.underglow : palette.interior);
    });
    materials.forEach((ref) => {
      if (ref.current) ref.current.color.set(palette.underglow);
    });
  }, [enabled, lights, materials, palette]);

  return (
    <group name="Paint_Matched_Neon_Underglow_And_Cockpit_Ambience">
      <pointLight ref={lights[0]} position={[-0.72, 0.13, -1.15]} intensity={7.5} distance={3.8} decay={2} color="#FF2BC7" />
      <pointLight ref={lights[1]} position={[0.72, 0.13, -1.15]} intensity={7.5} distance={3.8} decay={2} color="#FF2BC7" />
      <pointLight ref={lights[2]} position={[-0.72, 0.13, 1.15]} intensity={7.5} distance={3.8} decay={2} color="#FF2BC7" />
      <pointLight ref={lights[3]} position={[0.72, 0.13, 1.15]} intensity={7.5} distance={3.8} decay={2} color="#FF2BC7" />
      <pointLight ref={lights[4]} position={[-0.3, 0.84, -0.35]} intensity={5.2} distance={1.9} decay={2} color="#A77BFF" />
      <pointLight ref={lights[5]} position={[0.3, 0.84, -0.35]} intensity={5.2} distance={1.9} decay={2} color="#A77BFF" />
      <mesh
        position={[0, 0.014, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[1.3, 2.3, 1]}
        visible={enabled}
        raycast={() => null}
      >
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial
          ref={materials[0]}
          map={glowTexture}
          color="#C000FF"
          transparent
          opacity={0.92}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh
        position={[0, 0.016, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[0.88, 1.92, 1]}
        visible={enabled}
        raycast={() => null}
      >
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial
          ref={materials[1]}
          map={glowTexture}
          color="#F04BFF"
          transparent
          opacity={0.68}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {[-0.76, 0.76].map((side) => (
        <mesh
          key={side}
          position={[side, 0.012, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[0.62, 1.78, 1]}
          visible={enabled}
          raycast={() => null}
        >
          <circleGeometry args={[1, 48]} />
          <meshBasicMaterial
            map={glowTexture}
            color={palette.underglow}
            transparent
            opacity={0.76}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Real headlight beams.
 *
 * The previous implementation set `target-position` on <spotLight>, but a
 * SpotLight's `.target` object is NOT part of the scene graph by default, so its
 * world matrix never updates and both beams kept pointing at the world origin –
 * i.e. the headlights did nothing visible. Here each target is a real Object3D
 * that is mounted as a sibling, so the beam follows the lamp and sweeps around
 * correctly while the turntable rotates.
 *
 * Intensity is scaled by distance-squared decay, so the value is in candela: a
 * few hundred is what it takes to read as a bright pool of light on the floor.
 */
const HEADLIGHT_LOW_BEAM = 340;

export const HeadlightBeams = ({ on, brake }) => {
  const invalidate = useThree((state) => state.invalidate);
  const units = React.useMemo(
    () =>
      [-1, 1].map((side) => {
        const target = new Object3D();
        target.position.set(side * 0.95, -0.32, -9.2);
        const spot = new SpotLight("#EAF4FF", 0, 17, 0.46, 0.72, 1.7);
        spot.position.set(side * 0.71, 0.62, -1.92);
        spot.target = target;
        spot.castShadow = false;
        spot.matrixAutoUpdate = true;
        return { spot, target };
      }),
    [],
  );

  React.useLayoutEffect(() => {
    for (const unit of units) unit.spot.intensity = on ? HEADLIGHT_LOW_BEAM : 0;
    invalidate();
  }, [on, units, invalidate]);

  React.useEffect(() => () => units.forEach(({ spot }) => spot.dispose()), [units]);

  return (
    <group name="Matrix_LED_Beams">
      {units.map((unit, i) => (
        <React.Fragment key={i}>
          <primitive object={unit.target} />
          <primitive object={unit.spot} />
        </React.Fragment>
      ))}
      <pointLight
        position={[0, 0.66, -2.1]}
        intensity={on ? 1.6 : 0}
        distance={3.2}
        decay={2}
        color="#DCEEFF"
      />
      <pointLight
        position={[0, 0.74, 2.32]}
        intensity={brake ? 5.5 : on ? 1.8 : 0}
        distance={3.6}
        decay={2}
        color="#FF1A22"
      />
    </group>
  );
};

export const VehicleModel = React.memo(
  ({
    asset: Q,
    selectedComponent: A,
    entranceSeq: g,
    onSelectComponent: I,
    onHoverTelemetry: C,
    onMeshInventoryReady: E,
    paintHex: e,
    paintFinish: o,
    caliperSwatch: l,
    wheelSwatch: M,
    interiorSwatch: n,
    matteCarbon: r,
    headlightsOn: h,
    brakeLightsOn: V,
    highDownforceGurney: P,
    rollingRoad: y,
    steeringAngleDeg: j,
    technicalView: u,
    powerMode: K,
    showHotspotPins: U,
    neonLightsOn = false,
  }) => {
    const p = React.useMemo(() => makeStudioTextures(), []),
      G = React.useRef({
        x: 0,
        y: 0,
      }),
      q = React.useRef(null),
      N = React.useRef(() => {}),
      W = React.useMemo(() => {
        const BA = document.createElement("canvas");
        ((BA.width = 256), (BA.height = 512));
        const MA = BA.getContext("2d");
        MA.clearRect(0, 0, BA.width, BA.height);
        const WA = new CanvasTexture(BA),
          JA = new Image();
        return (
          (JA.onload = () => {
            ((BA.width = JA.width || 256),
              (BA.height = JA.height || 512),
              MA.drawImage(JA, 0, 0, BA.width, BA.height));
            const nA = MA.getImageData(0, 0, BA.width, BA.height),
              rA = nA.data;
            for (let kA = 0; kA < rA.length; kA += 4) {
              const og = (rA[kA] + rA[kA + 1] + rA[kA + 2]) / 3,
                $A = Math.max(0, Math.min(255, 255 - og));
              ((rA[kA] = 0),
                (rA[kA + 1] = 0),
                (rA[kA + 2] = 0),
                (rA[kA + 3] = Math.round(Math.pow($A / 255, 0.85) * 245)));
            }
            (MA.putImageData(nA, 0, 0), (WA.needsUpdate = !0), N.current());
          }),
          (JA.src = BUNDLED_PNG_URL),
          WA
        );
      }, []),
      m = React.useMemo(() => document.createElement("canvas"), []),
      X = React.useMemo(() => {
        drawDashboardDisplay(m, K, y ? 250 : 0);
        const BA = new CanvasTexture(m);
        return ((BA.colorSpace = SRGBColorSpace), (BA.flipY = !1), (BA.needsUpdate = !0), BA);
      }, [m]);
    const steeringWheelRotation = React.useMemo(() => new Quaternion(), []);
    const steeringWheelAngle = React.useRef(0);
    React.useEffect(() => {
      (drawDashboardDisplay(m, K, y ? 250 : 0), (X.needsUpdate = !0));
    }, [m, X, K, y]);
    const L = React.useMemo(() => {
      const BA = cloneScene(Q.gltf.scene),
        MA = [],
        WA = [],
        JA = new Map(),
        nA = [],
        rA = [],
        kA = [],
        og = [],
        $A = [],
        Ug = [],
        Tg = [],
        XA = [],
        hA = [],
        vA = [],
        doorNodes = [];
      let HA = null,
        lg = null;
      return (
        BA.traverse((Wg) => {
          if (
            ((Wg.name === "Wheel_Assembly_FL" ||
              Wg.name === "Wheel_Assembly_FR" ||
              Wg.name === "Wheel_Assembly_RL" ||
              Wg.name === "Wheel_Assembly_RR" ||
              /^wheel_(fl|fr|rl|rr)$/i.test(Wg.name)) &&
              hA.push(Wg),
            (Wg.name === "Knuckle_FL" || Wg.name === "Knuckle_FR") && vA.push(Wg),
            (Wg.name === "F1_Steering_Wheel_Group" || Wg.name === "steering_wheel") && (HA = Wg),
            Wg.name === "ShutOff_Gurney_Mobile_Flap" && (lg = Wg),
            // Door hinges are captured BEFORE the mesh early-out: they are plain
            // Object3D pivots, never meshes.
            /hinge/i.test(Wg.name) && !/latch/i.test(Wg.name) && doorNodes.push(Wg),
            !Wg.isMesh)
          )
            return;
          const yg = Wg,
            Mg = classifyMesh(yg);
          ((yg.userData.componentId = Mg),
            (yg.castShadow =
              Mg === "paintwork" ||
              Mg === "wheels" ||
              Mg === "tires" ||
              Mg === "carbon_splitter" ||
              Mg === "carbon_diffuser" ||
              Mg === "aero_gurney"),
            (yg.receiveShadow = Mg === "paintwork" || Mg === "cockpit"));
          const mg = Array.isArray(yg.material) ? yg.material[0] : yg.material,
            tA = `${yg.name} ${mg?.name || ""}`.toLowerCase();
          let eg;
          const zg = !Q.isBundledReference,
            $ = (mg?.name || "").toLowerCase();
          if (zg) {
            if (/body|paint/.test($) && !/badge|emblem|glass|interior|trim/.test($)) {
              const xA = new MeshPhysicalMaterial({
                name: "TailorMade_Coachwork",
                color: new Color(e),
                metalness: o.metalness,
                roughness: o.roughness,
                clearcoat: o.clearcoat,
                clearcoatRoughness: o.clearcoatRoughness,
                iridescence: o.iridescence,
                iridescenceIOR: 1.35,
                normalMap: p.flakeNormal,
                normalScale: new Vector2(o.flakeScale, o.flakeScale),
                envMapIntensity: 1.45,
                side: DoubleSide,
              });
              (nA.push(xA), (eg = xA));
            } else if (/caliper/.test($)) {
              const xA = new MeshStandardMaterial({
                name: "Monoblock_Caliper",
                color: new Color(l.hex),
                metalness: l.metalness,
                roughness: l.roughness,
                envMapIntensity: 1.45,
              });
              (rA.push(xA), (eg = xA));
            } else if (
              /wheel_rim|color_rims|\brim\b|rim_ao|ext_wheel/.test($) &&
              !/tyre|tire|brake/.test($)
            ) {
              const xA = mg,
                RA = new MeshStandardMaterial({
                  name: "Forged_Wheel",
                  color: new Color(M.hex),
                  map: xA?.map || null,
                  metalness: M.metalness,
                  roughness: M.roughness,
                  envMapIntensity: 1.55,
                });
              (kA.push(RA), (eg = RA));
            } else if (mg && mg.isMeshStandardMaterial)
              ((eg = mg.clone()),
                (eg.envMapIntensity = 1.1),
                /glass|win_int|windshield/.test($) &&
                  ((eg.transparent = !0), (eg.opacity = Math.min(eg.opacity, 0.35)), (eg.depthWrite = !1)),
                /light|lamp|led|emitter|display/.test($) &&
                  eg.emissive.getHex() === 0 &&
                  !eg.emissiveMap &&
                  (eg.emissive.set(/rear|tail/.test($) ? "#B0101A" : "#DCEEFF"),
                  (eg.emissiveIntensity = 0.6)));
            else {
              const xA = mg;
              eg = new MeshStandardMaterial({
                color: xA?.color ? xA.color.clone() : new Color("#2A2D33"),
                map: xA?.map || null,
                metalness: 0.3,
                roughness: 0.5,
              });
            }
          } else if (Mg === "paintwork" && !/shield|emblem|cavallino|latch/.test(tA)) {
            const xA = new MeshPhysicalMaterial({
              name: "Ferrari_TailorMade_Coachwork",
              color: new Color(e),
              metalness: o.metalness,
              roughness: o.roughness,
              clearcoat: o.clearcoat,
              clearcoatRoughness: o.clearcoatRoughness,
              iridescence: o.iridescence,
              iridescenceIOR: 1.35,
              normalMap: p.flakeNormal,
              normalScale: new Vector2(o.flakeScale, o.flakeScale),
              envMapIntensity: 1.45,
              side: DoubleSide,
            });
            (nA.push(xA), (eg = xA));
          } else if (Mg === "calipers") {
            const xA = new MeshStandardMaterial({
              name: "Brembo_Monoblock_Caliper",
              color: new Color(l.hex),
              metalness: l.metalness,
              roughness: l.roughness,
              envMapIntensity: 1.45,
              side: DoubleSide,
            });
            (rA.push(xA), (eg = xA));
          } else if (Mg === "brakes_ccm")
            eg = new MeshStandardMaterial({
              name: "Brembo_CCM_Rotor",
              color: new Color("#7B8088"),
              map: p.rotorAlbedo,
              roughnessMap: p.rotorRoughness,
              metalness: 0.62,
              roughness: 0.42,
              envMapIntensity: 1.15,
              side: DoubleSide,
            });
          else if (Mg === "wheels") {
            if (/center_cap|centre|yellow/.test(tA))
              eg = new MeshStandardMaterial({
                name: "Giallo_Modena_Cap",
                color: new Color("#F2BE13"),
                metalness: 0.25,
                roughness: 0.2,
                envMapIntensity: 1.3,
                side: DoubleSide,
              });
            else if (/lug_bolt|nuts/.test(tA))
              eg = new MeshStandardMaterial({
                name: "Gr5_Titanium_Bolts",
                color: new Color("#525864"),
                metalness: 0.92,
                roughness: 0.25,
                side: DoubleSide,
              });
            else {
              const xA = new MeshStandardMaterial({
                name: "Forged_Aero_Wheel",
                color: new Color(M.hex),
                metalness: M.metalness,
                roughness: M.roughness,
                envMapIntensity: 1.55,
                side: DoubleSide,
              });
              (kA.push(xA), (eg = xA));
            }
          } else if (Mg === "tires")
            eg = new MeshStandardMaterial({
              name: "Michelin_Cup2R_Compound",
              color: new Color("#17191D"),
              metalness: 0.08,
              roughness: 0.78,
              envMapIntensity: 0.65,
            });
          else if (
            Mg === "carbon_splitter" ||
            Mg === "carbon_skirts" ||
            Mg === "carbon_diffuser" ||
            /carbon|gurney|cooling_louver/.test(tA)
          ) {
            const xA = new MeshPhysicalMaterial({
              name: "PrePreg_2x2_Carbon_Fiber",
              color: new Color("#FFFFFF"),
              map: p.carbonAlbedo,
              normalMap: p.carbonNormal,
              normalScale: new Vector2(0.55, 0.55),
              roughnessMap: p.carbonRoughness,
              metalness: 0.18,
              roughness: 0.34,
              clearcoat: r ? 0.18 : 1,
              clearcoatRoughness: r ? 0.42 : 0.07,
              envMapIntensity: 1.35,
              side: DoubleSide,
            });
            ($A.push(xA), (eg = xA));
          } else if (Mg === "headlights") {
            if (/polycarbonate|lens/.test(tA))
              eg = new MeshStandardMaterial({
                name: "Headlight_Optical_Lens",
                color: new Color("#FFFFFF"),
                metalness: 0.05,
                roughness: 0.04,
                transparent: !0,
                opacity: 0.14,
                envMapIntensity: 1.25,
                depthWrite: !1,
                side: DoubleSide,
              });
            else if (/led|blade|projector/.test(tA)) {
              const xA = new MeshStandardMaterial({
                name: "Matrix_LED_Emitter",
                color: new Color("#F8FAFC"),
                emissive: new Color("#DCEEFF"),
                emissiveIntensity: 2.6,
                metalness: 0.1,
                roughness: 0.12,
              });
              (Ug.push(xA), (eg = xA));
            } else
              eg = new MeshStandardMaterial({
                name: "Headlight_Bezel",
                color: new Color("#14171C"),
                metalness: 0.5,
                roughness: 0.35,
              });
          } else if (Mg === "taillights") {
            if (/outer_lens/.test(tA)) {
              const xA = new MeshStandardMaterial({
                name: "Taillight_Ruby_Lens",
                color: new Color("#9E0B12"),
                emissive: new Color("#DC1A22"),
                emissiveIntensity: 0.9,
                metalness: 0.08,
                roughness: 0.06,
                transparent: !0,
                opacity: 0.72,
                side: DoubleSide,
              });
              (Tg.push(xA), (eg = xA));
            } else {
              const xA = new MeshStandardMaterial({
                name: "Taillight_LED_Ring",
                color: new Color("#FF1E26"),
                emissive: new Color("#FF1A22"),
                emissiveIntensity: 2.2,
                metalness: 0.1,
                roughness: 0.15,
              });
              (Tg.push(xA), (eg = xA));
            }
          } else if (Mg === "exhausts")
            eg = new MeshStandardMaterial({
              name: "Inconel_Titanium_Exhaust",
              color: new Color("#CFC8BE"),
              metalness: 0.96,
              roughness: 0.17,
              envMapIntensity: 1.75,
              side: DoubleSide,
            });
          else if (Mg === "engine_v8")
            /rosso|plenum/.test(tA)
              ? (eg = new MeshStandardMaterial({
                  name: "F154FA_Rosso_Wrinkle_Plenum",
                  color: new Color("#C41219"),
                  normalMap: p.wrinkleNormal,
                  normalScale: new Vector2(0.45, 0.45),
                  metalness: 0.18,
                  roughness: 0.58,
                  envMapIntensity: 1.1,
                }))
              : (eg = new MeshStandardMaterial({
                  name: "F154FA_Machined_Block_Turbos",
                  color: new Color("#A8B0BA"),
                  metalness: 0.9,
                  roughness: 0.28,
                  envMapIntensity: 1.4,
                }));
          else if (Mg === "hybrid_system") {
            const xA = new MeshStandardMaterial({
              name: "SF90_HV_Hybrid_Drive",
              color: new Color("#EB5E12"),
              emissive: new Color("#FF5500"),
              emissiveIntensity: 0.45,
              metalness: 0.55,
              roughness: 0.28,
              envMapIntensity: 1.25,
            });
            (XA.push(xA), (eg = xA));
          } else if (Mg === "glass_canopy") {
            const xA = /engine|lexan/.test(tA);
            eg = new MeshStandardMaterial({
              name: xA ? "Lexan_Engine_Hatch" : "Acoustic_Visor_Glass",
              color: new Color(xA ? "#A8B8C8" : "#06080C"),
              metalness: 0.08,
              roughness: 0.04,
              transparent: !0,
              opacity: xA ? 0.14 : 0.21,
              envMapIntensity: 0.95,
              depthWrite: !1,
              side: DoubleSide,
            });
          } else if (/curved_display/.test(tA))
            eg = new MeshStandardMaterial({
              name: "Curved_16in_HUD_Screen",
              color: new Color("#FFFFFF"),
              map: X,
              emissiveMap: X,
              emissive: new Color("#FFFFFF"),
              emissiveIntensity: 1.15,
              roughness: 0.12,
              metalness: 0.05,
              side: DoubleSide,
            });
          else if (/leather_seats|leather_grips/.test(tA)) {
            const xA = new MeshStandardMaterial({
              name: "Poltrona_Frau_Leather",
              color: new Color(n.hex),
              metalness: n.metalness,
              roughness: n.roughness,
              envMapIntensity: 0.85,
              side: DoubleSide,
            });
            (og.push(xA), (eg = xA));
          } else
            /stitching|shift_leds/.test(tA)
              ? (eg = new MeshStandardMaterial({
                  name: "Rosso_Accent_LED_Stitch",
                  color: new Color("#D91820"),
                  emissive: new Color(/shift_leds/.test(tA) ? "#FF1E26" : "#220000"),
                  emissiveIntensity: /shift_leds/.test(tA) ? 2 : 0.15,
                  roughness: 0.35,
                }))
              : /shield|cavallino_boss/.test(tA)
                ? (eg = new MeshStandardMaterial({
                    name: "Scuderia_Ferrari_Shield",
                    color: new Color("#F2BE13"),
                    metalness: 0.3,
                    roughness: 0.18,
                    envMapIntensity: 1.35,
                    side: DoubleSide,
                  }))
                : /emblem|latch|paddle|switchgear/.test(tA)
                  ? (eg = new MeshStandardMaterial({
                      name: "Maranello_Machined_Chrome",
                      color: new Color("#D8DDE5"),
                      metalness: 0.95,
                      roughness: 0.16,
                      envMapIntensity: 1.6,
                    }))
                  : ((eg = mg
                      ? mg.clone()
                      : new MeshStandardMaterial({
                          color: "#1C1F26",
                        })),
                    (eg.envMapIntensity = 0.9));
          if (zg && Mg === "headlights" && !/bezel|housing|glass|lens/.test(tA)) {
            eg.emissive.set("#DCEEFF");
            Ug.push(eg);
          }
          if (zg && Mg === "taillights" && !/housing|bezel/.test(tA)) {
            eg.emissive.set("#FF1A22");
            Tg.push(eg);
          }
          if (eg.transparent) eg.forceSinglePass = true;
          yg.material = eg;
          const T = yg.geometry,
            YA = Math.round(T.index ? T.index.count / 3 : T.attributes.position.count / 3);
          MA.push({
            mesh: yg,
            componentId: Mg,
            material: eg,
            baseEmissive: eg.emissive.clone(),
            baseEmissiveIntensity: eg.emissiveIntensity,
            triangles: YA,
          });
          const SA = JA.get(Mg) || [];
          (SA.push(yg), JA.set(Mg, SA));
          const KA = new Box3().setFromObject(yg),
            Eg = new Sphere();
          (KA.getBoundingSphere(Eg),
            WA.push({
              uuid: yg.uuid,
              name: yg.name || mg?.name || "SubMesh",
              componentId: Mg,
              triangles: YA,
              center: [Eg.center.x, Eg.center.y, Eg.center.z],
              radius: Number.isFinite(Eg.radius) ? Eg.radius : 0.5,
            }));
        }),
        {
          root: BA,
          records: MA,
          inventory: WA,
          componentMeshes: JA,
          bodyMaterials: nA,
          caliperMaterials: rA,
          wheelMaterials: kA,
          leatherMaterials: og,
          carbonMaterials: $A,
          headlightEmissiveMats: Ug,
          taillightEmissiveMats: Tg,
          hybridEmissiveMats: XA,
          wheelSpinNodes: hA,
          frontSteerNodes: vA,
          steeringWheelGroup: HA,
          steeringWheelBaseQuaternion: HA ? HA.quaternion.clone() : null,
          gurneyFlapNode: lg,
          doorNodes,
        }
      );
    }, [Q, p, X]);
    React.useLayoutEffect(() => {
      steeringWheelAngle.current = 0;
      if (L.steeringWheelGroup && L.steeringWheelBaseQuaternion) {
        L.steeringWheelGroup.quaternion.copy(L.steeringWheelBaseQuaternion);
      }
    }, [L]);
    (React.useEffect(() => {
      E(L.inventory);
    }, [L.inventory, E]),
      React.useLayoutEffect(() => {
        const BA = new Color(e);
        for (const MA of L.bodyMaterials) {
          const shaderChanged =
            MA.transparent !== (u === "xray") ||
            MA.wireframe !== (u === "wireframe") ||
            MA.iridescence > 0 !== o.iridescence > 0;
          (MA.color.copy(BA),
            (MA.metalness = o.metalness),
            (MA.roughness = u === "xray" ? 0.06 : o.roughness),
            (MA.clearcoat = o.clearcoat),
            (MA.clearcoatRoughness = o.clearcoatRoughness),
            (MA.iridescence = o.iridescence),
            MA.normalScale.set(o.flakeScale, o.flakeScale),
            (MA.wireframe = u === "wireframe"),
            (MA.transparent = u === "xray"),
            (MA.opacity = u === "xray" ? 0.15 : 1),
            (MA.depthWrite = u !== "xray"));
          if (shaderChanged) MA.needsUpdate = true;
        }
        markShadowsDirty();
      }, [L, e, o, u]),
      React.useLayoutEffect(() => {
        const BA = new Color(l.hex);
        for (const MA of L.caliperMaterials)
          (MA.color.copy(BA), (MA.metalness = l.metalness), (MA.roughness = l.roughness));
      }, [L, l]),
      React.useLayoutEffect(() => {
        const BA = new Color(M.hex);
        for (const MA of L.wheelMaterials)
          (MA.color.copy(BA), (MA.metalness = M.metalness), (MA.roughness = M.roughness));
      }, [L, M]),
      React.useLayoutEffect(() => {
        const BA = new Color(n.hex);
        for (const MA of L.leatherMaterials)
          (MA.color.copy(BA), (MA.metalness = n.metalness), (MA.roughness = n.roughness));
      }, [L, n]),
      React.useLayoutEffect(() => {
        for (const BA of L.carbonMaterials)
          ((BA.clearcoat = r ? 0.18 : 1), (BA.clearcoatRoughness = r ? 0.42 : 0.07));
      }, [L, r]),
      React.useLayoutEffect(() => {
        for (const BA of L.records) {
          if (
            (L.headlightEmissiveMats.includes(BA.material) && (BA.baseEmissiveIntensity = h ? 3.2 : 0),
            L.taillightEmissiveMats.includes(BA.material))
          ) {
            const MA = BA.material.name.includes("Lens");
            BA.baseEmissiveIntensity = V ? (MA ? 1.85 : 3.8) : h ? (MA ? 0.65 : 1.45) : 0;
          }
          if (L.hybridEmissiveMats.includes(BA.material)) {
            const MA = {
              edrive: 1.15,
              hybrid: 0.65,
              performance: 0.85,
              qualify: 1.55,
            };
            BA.baseEmissiveIntensity = MA[K];
          }
          BA.material.emissive.copy(BA.baseEmissive);
          BA.material.emissiveIntensity = BA.baseEmissiveIntensity;
          if (A === BA.componentId) {
            BA.material.emissive.lerp(QA, 0.72);
            BA.material.emissiveIntensity = Math.max(BA.baseEmissiveIntensity, 0.42);
          }
        }
      }, [L, h, V, K, A]));
    const gA = (BA) => {
        for (const MA of BA.intersections) {
          const WA = MA.object;
          if (!WA?.isMesh) continue;
          const JA = WA.userData.componentId;
          if (JA) {
            if (JA === "paintwork" && u !== "solid") {
              const nA = BA.intersections.find((rA) => {
                const og = rA.object?.userData?.componentId;
                return og && og !== "paintwork" && og !== "glass_canopy";
              });
              if (nA) return nA;
            }
            if (JA === "glass_canopy") {
              const nA = BA.intersections.find((rA) => {
                const og = rA.object?.userData?.componentId;
                return (
                  og === "engine_v8" || og === "hybrid_system" || og === "steering_wheel" || og === "cockpit"
                );
              });
              if (nA) return nA;
            }
            return MA;
          }
        }
        return null;
      },
      QA = React.useMemo(() => new Color("#FF2A32"), []),
      CA = React.useRef(null),
      shaderWarmups = React.useRef(new WeakMap()),
      [z, IA] = React.useState(!1),
      gl = useThree((s) => s.gl),
      scene = useThree((s) => s.scene),
      camera = useThree((s) => s.camera),
      invalidate = useThree((s) => s.invalidate),
      raycaster = useThree((s) => s.raycaster);
    React.useLayoutEffect(() => {
      invalidate();
    }, [L, e, o, l, M, n, r, h, V, K, A, u, P, j, y, invalidate]);

    React.useEffect(
      () => () => {
        L.records.forEach(({ material }) => material.dispose());
        document.body.style.cursor = "auto";
      },
      [L],
    );
    React.useEffect(
      () => () => {
        W.dispose();
        X.dispose();
      },
      [W, X],
    );
    // three-mesh-bvh: only the closest hit per mesh is needed for picking.
    React.useEffect(() => {
      raycaster.firstHitOnly = !0;
    }, [raycaster]);
    // Hotspot pins only appear once the platform has reached showroom level.
    React.useEffect(() => {
      IA(!1);
    }, [g]);
    // Warm up every shader of the freshly mounted vehicle *before* the lift starts
    // moving, so the first animated frames never hitch. The timeline waits for this
    // signal (bounded by LIFT_TIMING.maxArmWait) and only then engages the lift.
    React.useEffect(() => {
      let cancelled = !1;
      const ready = () => {
        if (cancelled) return;
        liftTimeline.markReady(g);
        invalidate();
      };
      let pending = shaderWarmups.current.get(L);
      if (!pending) {
        try {
          pending =
            typeof gl.compileAsync === "function" ? gl.compileAsync(scene, camera) : Promise.resolve();
        } catch {
          pending = Promise.resolve();
        }
        shaderWarmups.current.set(L, pending);
      }
      Promise.resolve(pending).then(ready, ready);
      return () => {
        cancelled = !0;
      };
    }, [L, g, gl, scene, camera, invalidate]);
    useFrame((BA, MA) => {
      N.current = BA.invalidate;
      const WA = Math.min(MA, 0.05);
      // In race mode the world transform lives on <RaceVehicleRig/>, so the
      // turntable group stays neutral and the controls come from the engine.
      const racing = raceDrive.active;
      let JA = !1;
      if (CA.current) {
        if (racing) {
          CA.current.position.y = 0;
          CA.current.rotation.y = 0;
        } else {
          // Mirror the shared lift timeline (advanced by <LiftDirector/>): the car
          // rides the platform with identical height + yaw, frame for frame.
          CA.current.position.y = liftTimeline.y;
          CA.current.rotation.y = liftTimeline.yaw;
          if (liftTimeline.atTop && !z) IA(!0);
        }
      }
      if (L.gurneyFlapNode) {
        const rA = P ? 0.931 : 0.958,
          kA = P ? -0.16 : 0;
        ((L.gurneyFlapNode.position.y = MathUtils.damp(L.gurneyFlapNode.position.y, rA, 9, WA)),
          (L.gurneyFlapNode.rotation.x = MathUtils.damp(L.gurneyFlapNode.rotation.x, kA, 9, WA)),
          (Math.abs(L.gurneyFlapNode.position.y - rA) > 5e-4 ||
            Math.abs(L.gurneyFlapNode.rotation.x - kA) > 5e-4) &&
            (JA = !0));
      }
      const nA = racing ? MathUtils.degToRad(raceDrive.steerDeg) : MathUtils.degToRad(j);
      for (const rA of L.frontSteerNodes)
        ((rA.rotation.y = MathUtils.damp(rA.rotation.y, nA, 10, WA)),
          Math.abs(rA.rotation.y - nA) > 0.001 && (JA = !0));
      if (L.steeringWheelGroup && L.steeringWheelBaseQuaternion) {
        const rA = nA * 7.5;
        steeringWheelAngle.current = MathUtils.damp(steeringWheelAngle.current, rA, 10, WA);
        steeringWheelRotation.setFromAxisAngle(STEERING_AXIS_Z, steeringWheelAngle.current);
        L.steeringWheelGroup.quaternion.copy(steeringWheelRotation).multiply(L.steeringWheelBaseQuaternion);
        if (Math.abs(steeringWheelAngle.current - rA) > 0.001) JA = true;
      }
      for (const rA of L.wheelSpinNodes)
        (/fl|fr/i.test(rA.name) &&
          ((rA.rotation.order = "YXZ"), (rA.rotation.y = MathUtils.damp(rA.rotation.y, nA, 10, WA))),
          racing
            ? (Math.abs(raceDrive.spinRate) > 0.05 && ((rA.rotation.x -= WA * raceDrive.spinRate), (JA = !0)))
            : y && ((rA.rotation.x -= WA * 16.5), (JA = !0)));
      // Doors shut for the race. SlERPing the hinge back to identity is the only
      // allocation free way to animate a quaternion pivot, and hinges that are
      // already neutral cost one `angleTo` comparison.
      if (racing && L.doorNodes.length) {
        const rA = 1 - Math.exp(-7 * WA);
        for (const kA of L.doorNodes) {
          if (kA.quaternion.angleTo(DOOR_CLOSED) < 0.002) continue;
          kA.quaternion.slerp(DOOR_CLOSED, rA);
          JA = true;
        }
      }
      // Brake lights flare straight from the simulation — no React round trip.
      if (racing && L.taillightEmissiveMats.length) {
        for (const rA of L.taillightEmissiveMats)
          rA.emissiveIntensity = raceDrive.braking
            ? rA.name.includes("Lens")
              ? 1.85
              : 3.8
            : h
              ? rA.name.includes("Lens")
                ? 0.65
                : 1.45
              : 0;
      }
      if (JA) {
        markShadowsDirty();
        BA.invalidate();
      }
      CA.current?.updateMatrixWorld();
    }, -4);
    const iA = (BA) => {
        G.current = {
          x: BA.nativeEvent.clientX,
          y: BA.nativeEvent.clientY,
        };
      },
      DA = (BA) => {
        if (BA.buttons) return;
        BA.stopPropagation();
        const MA = gA(BA);
        if (!MA) {
          ((document.body.style.cursor = "auto"), q.current !== null && ((q.current = null), C(null)));
          return;
        }
        const WA = MA.object,
          JA = WA.userData.componentId;
        document.body.style.cursor = "pointer";
        const nA = `${JA}:${WA.name}`;
        if (q.current === nA) return;
        ((q.current = nA), (document.body.style.cursor = "pointer"));
        const rA = WA.geometry,
          kA = Math.round(rA.index ? rA.index.count / 3 : rA.attributes.position.count / 3);
        C({
          componentId: JA,
          meshName: WA.name || "Mesh",
          triangles: kA,
          point: [MA.point.x, MA.point.y, MA.point.z],
        });
      },
      H = () => {
        ((document.body.style.cursor = "auto"), q.current !== null && ((q.current = null), C(null)));
      },
      wA = (BA) => {
        BA.stopPropagation();
        const MA = BA.nativeEvent.clientX - G.current.x,
          WA = BA.nativeEvent.clientY - G.current.y;
        if (Math.hypot(MA, WA) > 5) return;
        const JA = gA(BA);
        if (!JA) return;
        const nA = JA.object,
          rA = nA.userData.componentId;
        let kA;
        if (!Q.isBundledReference) {
          const og = new Box3().setFromObject(nA),
            $A = new Vector3(),
            Ug = new Sphere();
          (og.getCenter($A),
            og.getBoundingSphere(Ug),
            (kA = {
              target: [$A.x, $A.y, $A.z],
              radius: Math.max(Ug.radius, 0.35),
            }));
        }
        I(rA, kA);
      };
    return (
      <group name="Ferrari_SF90_Interactive_Rig">
        <group ref={CA} name="Car_On_Turntable" userData-carId={Q.carId}>
          {Q.isBundledReference && z && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]} raycast={() => null}>
              <planeGeometry args={[0.655 * 4, 1.3 * 4]} />
              <meshBasicMaterial
                map={W}
                toneMapped={!1}
                transparent={!0}
                opacity={0.96}
                depthWrite={!1}
                polygonOffset
                polygonOffsetFactor={-1}
                polygonOffsetUnits={-1}
              />
            </mesh>
          )}
          <NeonLighting enabled={neonLightsOn} bodyColor={e} />
          <HeadlightBeams on={h} brake={V} />
          <primitive
            object={L.root}
            dispose={null}
            onPointerDown={iA}
            onPointerMove={DA}
            onPointerOut={H}
            onClick={wA}
          />
          {/* Hotspot pins live INSIDE the turntable group so they ride along with
            the car during the lift and the 360° showcase turn. */}
          {U &&
            z &&
            Q.isBundledReference &&
            HOTSPOT_IDS.filter((BA) => COMPONENT_IDS.includes(BA)).map((BA, MA) => {
              const WA = COMPONENT_SPECS[BA],
                JA = A === BA;
              return (
                <Html
                  key={BA}
                  position={WA.hotspot}
                  center={!0}
                  distanceFactor={4.6}
                  zIndexRange={[18, 0]}
                  occlude={!1}
                  style={{
                    pointerEvents: "auto",
                  }}
                >
                  <button
                    type="button"
                    onClick={(nA) => {
                      (nA.stopPropagation(), I(BA));
                    }}
                    title={WA.name}
                    className={`group flex items-center gap-1.5 rounded-full transition-all duration-200 cursor-pointer ${JA ? "bg-[#DC1A22] text-white px-2.5 py-1 shadow-[0_0_20px_rgba(220,26,34,0.75)] scale-105" : "bg-black/75 hover:bg-black/95 text-zinc-200 border border-white/25 hover:border-[#DC1A22] w-6 h-6 justify-center"}`}
                  >
                    <span className="font-mono-tech text-[10px] font-semibold leading-none">
                      {String(MA + 1).padStart(2, "0")}
                    </span>
                    {JA && (
                      <span className="font-mono-tech text-[10px] uppercase tracking-wider whitespace-nowrap pr-0.5">
                        {WA.name.split(" ")[0]}
                      </span>
                    )}
                  </button>
                </Html>
              );
            })}
        </group>
      </group>
    );
  },
);

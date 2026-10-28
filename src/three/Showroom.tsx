// @ts-nocheck
import FLOOR_TEXTURE_URL from "@/assets/textures/floor";
import { makeFloorTextures } from "@/three/textures";
import { Environment, Lightformer, MeshReflectorMaterial } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import React from "react";
import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  CatmullRomCurve3,
  ClampToEdgeWrapping,
  MathUtils,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  TubeGeometry,
  Vector3,
} from "three";

import { liftTimeline } from "@/three/liftTimeline";
import { markShadowsDirty } from "./sceneMotion";
import { CeilingFixtures, DrainSlats } from "./StudioFixtures";
export { LIFT_TIMING, liftTimeline } from "@/three/liftTimeline";

export const HALL_LENGTH = 13;

export const HALL_WIDTH = 10;

export const HALL_HEIGHT = 5.6;

export const HALL_TEX_SCALE = HALL_HEIGHT * 1.5;

export const PLATFORM_RADIUS = 2.62;

export const PIT_RADIUS = 2.74;

export const STREAMLINE_OFFSETS = [-0.66, -0.44, -0.22, 0, 0.22, 0.44, 0.66];

const GATE_OPEN_TRAVEL = 4.35;
const GATE_SLAT_COUNT = 34;

/** A reusable, instanced roller shutter. Its single transform is damped in
 * place, so opening never allocates objects or recreates GPU resources. */
function GarageGate({ open }) {
  const shutter = React.useRef(null);
  const slats = React.useRef(null);
  const openRef = React.useRef(open);
  const slat = React.useMemo(() => new Object3D(), []);
  openRef.current = open;

  React.useLayoutEffect(() => {
    if (!slats.current) return;
    for (let i = 0; i < GATE_SLAT_COUNT; i++) {
      slat.position.set(0, 0.12 + i * 0.12, 0);
      slat.updateMatrix();
      slats.current.setMatrixAt(i, slat.matrix);
    }
    slats.current.instanceMatrix.needsUpdate = true;
    slats.current.computeBoundingSphere();
  }, [slat]);

  // Negative priority keeps R3F's automatic render pass enabled. Positive
  // render priorities take over drawing and would leave the canvas black unless
  // this callback manually called gl.render().
  useFrame((state, delta) => {
    if (!shutter.current || document.hidden) return;
    const target = openRef.current ? GATE_OPEN_TRAVEL : 0;
    const current = shutter.current.position.y;
    const next = MathUtils.damp(current, target, 5.4, Math.min(delta, 0.05));
    if (Math.abs(target - next) < 0.002) {
      shutter.current.position.y = target;
      return;
    }
    shutter.current.position.y = next;
    state.invalidate();
  }, -1);

  return (
    <group name="Motorized_Garage_Roller_Door" position={[0, 0, HALL_WIDTH - 0.06]} rotation={[0, Math.PI, 0]}>
      {/* Fixed guides and roller housing */}
      <mesh position={[-4.28, 2.12, 0]} raycast={() => null}>
        <boxGeometry args={[0.14, 4.24, 0.2]} />
        <meshStandardMaterial color="#292d34" metalness={0.82} roughness={0.3} />
      </mesh>
      <mesh position={[4.28, 2.12, 0]} raycast={() => null}>
        <boxGeometry args={[0.14, 4.24, 0.2]} />
        <meshStandardMaterial color="#292d34" metalness={0.82} roughness={0.3} />
      </mesh>
      <mesh position={[0, 4.3, 0]} raycast={() => null}>
        <boxGeometry args={[8.65, 0.28, 0.34]} />
        <meshStandardMaterial color="#171a20" metalness={0.78} roughness={0.34} />
      </mesh>
      <mesh position={[0, 4.14, 0.19]} raycast={() => null}>
        <boxGeometry args={[8.1, 0.025, 0.025]} />
        <meshBasicMaterial color="#DC1A22" toneMapped={false} />
      </mesh>
      <group ref={shutter} position={[0, 0, 0.02]}>
        <instancedMesh ref={slats} args={[undefined, undefined, GATE_SLAT_COUNT]} raycast={() => null}>
          <boxGeometry args={[8.35, 0.108, 0.13]} />
          <meshStandardMaterial color="#636a73" metalness={0.82} roughness={0.28} />
        </instancedMesh>
      </group>
    </group>
  );
}

function ExteriorApron({ cityDriveMode = false }) {
  return (
    <group name="Circuit_Outside_Garage">
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, HALL_WIDTH + 13]} raycast={() => null}>
        <planeGeometry args={[26, 26]} />
        <meshStandardMaterial color="#171a20" roughness={0.92} metalness={0.08} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.012, HALL_WIDTH + 13]} raycast={() => null}>
        <planeGeometry args={[7.4, 26]} />
        <meshStandardMaterial color="#101318" roughness={0.88} metalness={0.12} />
      </mesh>
      {[-3.55, 3.55].map((x) => (
        <mesh key={x} position={[x, 0.005, HALL_WIDTH + 13]} raycast={() => null}>
          <boxGeometry args={[0.035, 0.008, 25]} />
          <meshBasicMaterial color="#B5B9C0" />
        </mesh>
      ))}
      {Array.from({ length: 7 }, (_, index) => (
        <mesh key={index} position={[0, 0.006, HALL_WIDTH + 2.5 + index * 3.1]} raycast={() => null}>
          <boxGeometry args={[0.12, 0.008, 1.55]} />
          <meshBasicMaterial color="#D7D9DE" />
        </mesh>
      ))}
      <mesh
        visible={!cityDriveMode}
        position={[0, 5.2, HALL_WIDTH + 26]}
        rotation={[0, Math.PI, 0]}
        raycast={() => null}
      >
        <planeGeometry args={[26, 10]} />
        <meshBasicMaterial color="#141923" fog />
      </mesh>
    </group>
  );
}

export const AeroStreamlines = ({ highDownforce: Q }) => {
  const rig = React.useRef(null);
  const A = React.useRef([]),
    g = React.useMemo(() => {
      const E = document.createElement("canvas");
      ((E.width = 256), (E.height = 16));
      const e = E.getContext("2d"),
        o = e.createLinearGradient(0, 0, 256, 0);
      (o.addColorStop(0, "rgba(56, 189, 248, 0.0)"),
        o.addColorStop(0.28, "rgba(56, 189, 248, 0.14)"),
        o.addColorStop(0.55, "rgba(186, 230, 253, 0.92)"),
        o.addColorStop(0.72, "rgba(56, 189, 248, 0.20)"),
        o.addColorStop(1, "rgba(56, 189, 248, 0.0)"),
        (e.fillStyle = o),
        e.fillRect(0, 0, 256, 16));
      const l = new CanvasTexture(E);
      return ((l.wrapS = l.wrapT = RepeatWrapping), l.repeat.set(3, 1), (l.needsUpdate = !0), l);
    }, []),
    I = React.useMemo(
      () =>
        STREAMLINE_OFFSETS.map((E) => {
          const e = Math.abs(E),
            o = Math.max(0, 1 - e / 0.72),
            l = Q ? 0.24 : 0.05,
            M = [
              new Vector3(E * 0.92, 0.19, -3.35),
              new Vector3(E * 0.95, 0.28, -2.35),
              new Vector3(E * 0.98, 0.68 + o * 0.1, -1.65),
              new Vector3(E * 0.94, 0.88 + o * 0.4, -0.55),
              new Vector3(E * 0.92, 0.92 + o * 0.36, 0.05),
              new Vector3(E * 0.95, 1.03 + o * 0.04, 1.05),
              new Vector3(E * 0.92, 0.99, 2.02),
              new Vector3(E * 0.96, 1.03 + l, 2.75),
              new Vector3(E * 1.04, 1.08 + l * 1.65, 3.65),
            ],
            n = new CatmullRomCurve3(M);
          return new TubeGeometry(n, 72, 0.0065, 6, !1);
        }),
      [Q],
    ),
    C = React.useMemo(
      () =>
        [-0.42, 0, 0.42].map((E) => {
          const e = [
            new Vector3(E, 0.1, -3.2),
            new Vector3(E, 0.09, -1.5),
            new Vector3(E, 0.08, 0.5),
            new Vector3(E * 1.08, 0.16, 1.95),
            new Vector3(E * 1.18, 0.36 + (Q ? 0.12 : 0.03), 3.3),
          ];
          return new TubeGeometry(new CatmullRomCurve3(e), 56, 0.0055, 6, !1);
        }),
      [Q],
    );
  React.useEffect(
    () => () => {
      I.forEach((geometry) => geometry.dispose());
      C.forEach((geometry) => geometry.dispose());
    },
    [I, C],
  );
  React.useEffect(() => () => g.dispose(), [g]);
  return (
    useFrame((E, e) => {
      // This component is only mounted while the streamlines are switched on, so
      // animating here is correct; the clamped delta keeps the flow speed stable
      // through frame hitches.
      if (document.hidden) return;
      g.offset.x -= Math.min(e, 0.05) * 1.65;
      if (rig.current) {
        rig.current.position.y = liftTimeline.y;
        rig.current.rotation.y = liftTimeline.yaw;
        rig.current.updateMatrixWorld();
      }
      E.invalidate();
    }, -4),
    (
      <group ref={rig} name="CFD_Aero_Streamlines">
        {I.map((E, e) => (
          <mesh key={`upper-${e}`} geometry={E} raycast={() => null}>
            <meshBasicMaterial
              ref={(o) => {
                A.current[e] = o;
              }}
              map={g}
              color={Q ? "#F5C518" : "#38BDF8"}
              transparent={!0}
              opacity={0.85}
              depthWrite={!1}
              blending={AdditiveBlending}
            />
          </mesh>
        ))}
        {C.map((E, e) => (
          <mesh key={`under-${e}`} geometry={E} raycast={() => null}>
            <meshBasicMaterial
              map={g}
              color="#DC1A22"
              transparent={!0}
              opacity={0.72}
              depthWrite={!1}
              blending={AdditiveBlending}
            />
          </mesh>
        ))}
      </group>
    )
  );
};

export const GarageFloorAndLift = ({ theme: Q, isSoftwareWebGL: A, active: I, garageLightsOn = true }) => {
  const C = React.useMemo(() => makeFloorTextures(), []),
    E = React.useRef(null);
  return (
    // The platform simply mirrors the shared timeline every frame. The timeline
    // itself is advanced by <LiftDirector/> (runs first), so the platform and the
    // car always share the exact same height and yaw.
    useFrame(() => {
      const M = E.current;
      if (!M) return;
      M.position.y = liftTimeline.y;
      M.rotation.y = liftTimeline.yaw;
      M.updateMatrixWorld();
    }, -5),
    (
      <group name="Garage_Floor_And_Turntable_Lift">
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow={!A} raycast={() => null}>
          <ringGeometry args={[PIT_RADIUS + 0.02, 24, 96, 1]} />
          {A ? (
            <meshStandardMaterial
              map={C.concreteAlbedo}
              roughnessMap={C.concreteRoughness}
              color="#8f949c"
              metalness={0.04}
              roughness={0.82}
            />
          ) : (
            <MeshReflectorMaterial
              map={C.concreteAlbedo}
              roughnessMap={C.concreteRoughness}
              color="#9aa0a8"
              resolution={256}
              blur={[96, 32]}
              mixBlur={0.42}
              mixStrength={9}
              mirror={0.38}
              depthScale={1.6}
              minDepthThreshold={0.35}
              maxDepthThreshold={1.7}
              metalness={0.14}
              roughness={0.58}
            />
          )}
        </mesh>
        <mesh position={[0, -1, 0]} raycast={() => null}>
          <cylinderGeometry args={[PIT_RADIUS, PIT_RADIUS, 2, 64, 1, !0]} />
          <meshStandardMaterial color="#14161a" metalness={0.55} roughness={0.52} side={BackSide} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.99, 0]} raycast={() => null}>
          <circleGeometry args={[PIT_RADIUS, 64]} />
          <meshStandardMaterial color="#0a0b0e" metalness={0.2} roughness={0.85} />
        </mesh>
        {Array.from({
          length: 8,
        }).map((l, M) => {
          const n = (M / 8) * Math.PI * 2;
          return (
            <mesh
              key={M}
              position={[Math.sin(n) * (PIT_RADIUS - 0.06), -0.95, Math.cos(n) * (PIT_RADIUS - 0.06)]}
              rotation={[0, n, 0]}
              raycast={() => null}
            >
              <planeGeometry args={[0.035, 1.7]} />
              <meshBasicMaterial color={Q.rimColor} transparent={!0} opacity={0.16} toneMapped={!1} />
            </mesh>
          );
        })}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} raycast={() => null}>
          <ringGeometry args={[PIT_RADIUS, PIT_RADIUS + 0.1, 96]} />
          <meshStandardMaterial color="#3a3f47" metalness={0.85} roughness={0.34} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0045, 0]} raycast={() => null}>
          <ringGeometry args={[PIT_RADIUS + 0.16, PIT_RADIUS + 0.26, 96]} />
          <meshStandardMaterial
            color="#b6952f"
            roughness={0.78}
            metalness={0.15}
            transparent={!0}
            opacity={0.72}
          />
        </mesh>
        <group position={[0, 0.006, -3.55]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <planeGeometry args={[4.6, 0.26]} />
            <meshStandardMaterial color="#1c1f24" metalness={0.7} roughness={0.5} />
          </mesh>
          <DrainSlats />
          <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <planeGeometry args={[4.6, 0.7]} />
            <meshStandardMaterial
              color="#0e1013"
              transparent={!0}
              opacity={0.22}
              roughness={0.9}
              depthWrite={false}
            />
          </mesh>
        </group>
        <group ref={E} name="Turntable_Platform">
          <mesh position={[0, -0.14, 0]} receiveShadow={!0} raycast={() => null}>
            <cylinderGeometry args={[PLATFORM_RADIUS, PLATFORM_RADIUS * 0.975, 0.28, 80, 1, true]} />
            <meshStandardMaterial color="#2b2f35" metalness={0.88} roughness={0.36} />
          </mesh>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.002, 0]}
            receiveShadow={!0}
            raycast={() => null}
          >
            <circleGeometry args={[PLATFORM_RADIUS, 80]} />
            <meshStandardMaterial
              map={C.platformAlbedo}
              roughnessMap={C.platformRoughness}
              color="#a8aeb7"
              metalness={0.62}
              roughness={0.44}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0]} raycast={() => null}>
            <ringGeometry args={[PLATFORM_RADIUS - 0.045, PLATFORM_RADIUS - 0.004, 80]} />
            <meshBasicMaterial color={Q.rimColor} transparent={!0} opacity={0.5} toneMapped={!1} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} raycast={() => null}>
            <ringGeometry args={[0.62, 0.66, 48]} />
            <meshStandardMaterial color="#1e2126" metalness={0.7} roughness={0.4} />
          </mesh>
        </group>
        <pointLight
          position={[0, -0.35, 0]}
          intensity={garageLightsOn ? (I ? 2.4 : 1.4) : 0}
          distance={4}
          decay={2}
          color={Q.rimColor}
        />
      </group>
    )
  );
};

const StudioEnvironment = React.memo(function StudioEnvironment({ theme: Q, software: e, lightsOn }) {
  return (
    <Environment
      resolution={e ? 64 : 256}
      frames={1}
      environmentIntensity={Q.envIntensity * (lightsOn ? 1 : 0.16)}
    >
      <color attach="background" args={["#050608"]} />
      <Lightformer
        form="rect"
        intensity={3.4}
        color={Q.keyColor}
        scale={[3.2, 11.5, 1]}
        position={[0, 5.4, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      />
      <Lightformer
        form="rect"
        intensity={2.4}
        color="#FFFFFF"
        scale={[0.35, 11, 1]}
        position={[-2.6, 3.8, 0]}
        rotation={[Math.PI / 2.6, -0.42, 0]}
      />
      <Lightformer
        form="rect"
        intensity={2.4}
        color="#FFFFFF"
        scale={[0.35, 11, 1]}
        position={[2.6, 3.8, 0]}
        rotation={[Math.PI / 2.6, 0.42, 0]}
      />
      <Lightformer
        form="rect"
        intensity={2.1}
        color={Q.rimColor}
        scale={[9.5, 1.15, 1]}
        position={[-6.5, 1.45, 1.2]}
        rotation={[0, Math.PI / 2, 0]}
      />
      <Lightformer
        form="rect"
        intensity={1.65}
        color={Q.fillColor}
        scale={[9.5, 1.15, 1]}
        position={[6.5, 1.45, -1.2]}
        rotation={[0, -Math.PI / 2, 0]}
      />
      <Lightformer
        form="rect"
        intensity={1.8}
        color={Q.keyColor}
        scale={[5.5, 0.85, 1]}
        position={[0, 1.2, -7.5]}
        rotation={[0, 0, 0]}
      />
      <Lightformer
        form="rect"
        intensity={1.9}
        color={Q.rimColor}
        scale={[5.5, 0.95, 1]}
        position={[0, 1.35, 7.5]}
        rotation={[0, Math.PI, 0]}
      />
    </Environment>
  );
});

export const Showroom = React.memo(
  ({
    theme: Q,
    showAeroStreamlines: A,
    highDownforceGurney: g,
    rollingRoad: I,
    garageGateOpen = false,
    garageLightsOn = true,
    cityDriveMode = false,
  }) => {
    const E = useThree((M) => M.gl),
      e = React.useMemo(() => {
        try {
          const M = E.getContext(),
            n = M.getExtension("WEBGL_debug_renderer_info"),
            r = n ? String(M.getParameter(n.UNMASKED_RENDERER_WEBGL)) : "";
          return /swiftshader|llvmpipe|software|basic render/i.test(r);
        } catch {
          return !1;
        }
      }, [E]),
      o = React.useMemo(() => {
        const M = (n) => {
          const r = new TextureLoader().load(FLOOR_TEXTURE_URL);
          return (
            (r.colorSpace = SRGBColorSpace),
            (r.wrapS = RepeatWrapping),
            (r.wrapT = ClampToEdgeWrapping),
            r.repeat.set(n, 1),
            (r.anisotropy = 8),
            r
          );
        };
        return {
          long: M((HALL_LENGTH * 2) / HALL_TEX_SCALE),
          short: M((HALL_WIDTH * 2) / HALL_TEX_SCALE),
        };
      }, []),
      l = React.useMemo(() => {
        const M = [];
        for (const n of [-5.2, 5.2])
          for (const r of [-6.6, -2.2, 2.2, 6.6]) M.push([n, HALL_HEIGHT - 0.03, r]);
        return M;
      }, []);
    React.useLayoutEffect(() => {
      markShadowsDirty();
    }, [Q]);
    return (
      <>
        {/* Keep the garage's original world background and fog when the shutter
            opens. The city supplies a local sky backdrop inside the doorway. */}
        <color attach="background" args={[Q.bgHex]} />
        <fog attach="fog" args={[Q.fogHex, 22, 55]} />
        <group name="Maranello_Architectural_Showroom">
          {/* Once the gate exposes the city, keep global scene lighting fixed;
              the garage switch then affects only its local practical lights. */}
          <StudioEnvironment theme={Q} software={e} lightsOn={garageLightsOn || cityDriveMode} />
          <ambientLight intensity={cityDriveMode ? 0.36 : garageLightsOn ? 0.52 : 0.18} color={Q.fillColor} />
          <hemisphereLight args={[Q.keyColor, "#08090c", cityDriveMode ? 0.48 : garageLightsOn ? 0.72 : 0.24]} />
          <directionalLight
            position={[-3.4, 7.2, -3.2]}
            intensity={garageLightsOn || cityDriveMode ? (e ? 2.15 : 2.55) : 0}
            color={Q.keyColor}
          />
          <directionalLight
            position={[4.2, 4.6, 2.8]}
            intensity={garageLightsOn || cityDriveMode ? 1.25 : 0}
            color={Q.fillColor}
          />
          <directionalLight
            position={[0, 3.4, -5.5]}
            intensity={garageLightsOn || cityDriveMode ? 0.95 : 0}
            color={Q.rimColor}
          />
          {e ? (
            <directionalLight
              position={[-3.4, 7.2, -3.2]}
              intensity={Q.keyIntensity * 0.95}
              color={Q.keyColor}
              visible={false}
            />
          ) : (
            <>
              <spotLight
                position={[-3.4, 7.2, -3.2]}
                angle={0.48}
                penumbra={0.78}
                intensity={Q.keyIntensity * 18}
                distance={20}
                decay={1.45}
                color={Q.keyColor}
                visible={false}
                castShadow={!0}
                shadow-mapSize-width={1024}
                shadow-mapSize-height={1024}
                shadow-bias={-2e-4}
              />
              <spotLight
                position={[3.8, 5.6, 4.4]}
                angle={0.52}
                penumbra={0.85}
                intensity={Q.keyIntensity * 15}
                distance={19}
                decay={1.45}
                color={Q.rimColor}
                visible={false}
              />
              <spotLight
                position={[0, 4.2, 1.15]}
                angle={0.32}
                penumbra={0.9}
                intensity={9.5}
                distance={9}
                decay={1.4}
                color="#FFF5EA"
                visible={false}
              />
            </>
          )}
          {/* Low-mounted practicals preserve the bright floor accents without
              reintroducing the harsh ceiling beams. */}
          <pointLight position={[-2.6, 0.55, -1.15]} intensity={garageLightsOn ? 1.5 : 0} distance={5.5} color={Q.keyColor} />
          <pointLight position={[2.6, 0.55, -1.15]} intensity={garageLightsOn ? 1.5 : 0} distance={5.5} color={Q.keyColor} />
          <pointLight position={[-2.6, 0.55, 1.5]} intensity={garageLightsOn ? 1.3 : 0} distance={5.5} color={Q.rimColor} />
          <pointLight position={[2.6, 0.55, 1.5]} intensity={garageLightsOn ? 1.3 : 0} distance={5.5} color={Q.rimColor} />
          <GarageFloorAndLift theme={Q} isSoftwareWebGL={e} active={I} garageLightsOn={garageLightsOn} />
          <group position={[0, 4.85, 0]}>
            <mesh raycast={() => null}>
              <boxGeometry args={[2.65, 0.09, 6.6]} />
              <meshStandardMaterial color="#111318" metalness={0.82} roughness={0.32} />
            </mesh>
            <mesh position={[0, -0.052, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
              <planeGeometry args={[2.42, 6.36]} />
              <meshBasicMaterial color={Q.keyColor} />
            </mesh>
            <mesh position={[-1.33, 0, 0]} raycast={() => null}>
              <boxGeometry args={[0.012, 0.025, 6.62]} />
              <meshBasicMaterial color="#DC1A22" />
            </mesh>
            <mesh position={[1.33, 0, 0]} raycast={() => null}>
              <boxGeometry args={[0.012, 0.025, 6.62]} />
              <meshBasicMaterial color="#DC1A22" />
            </mesh>
          </group>
          <group name="Garage_Shell">
            {/* Split the front wall around a real doorway, leaving the rest of the shell intact. */}
            {[-1, 1].map((side) => (
              <mesh
                key={`front-wall-${side}`}
                position={[side * ((HALL_LENGTH + 4.2) / 2), HALL_HEIGHT / 2, HALL_WIDTH]}
                rotation={[0, Math.PI, 0]}
                raycast={() => null}
              >
                <planeGeometry args={[HALL_LENGTH - 4.2, HALL_HEIGHT]} />
                <meshStandardMaterial
                  map={o.long}
                  emissiveMap={o.long}
                  emissive="#ffffff"
                  emissiveIntensity={0.22}
                  roughness={0.92}
                  metalness={0.05}
                />
              </mesh>
            ))}
            <mesh position={[0, 4.9, HALL_WIDTH]} rotation={[0, Math.PI, 0]} raycast={() => null}>
              <planeGeometry args={[8.4, 1.4]} />
              <meshStandardMaterial
                map={o.long}
                emissiveMap={o.long}
                emissive="#ffffff"
                emissiveIntensity={0.22}
                roughness={0.92}
                metalness={0.05}
              />
            </mesh>
            <GarageGate open={garageGateOpen} />
            <ExteriorApron cityDriveMode={cityDriveMode} />
            <mesh position={[0, HALL_HEIGHT / 2, -HALL_WIDTH]} raycast={() => null}>
              <planeGeometry args={[HALL_LENGTH * 2, HALL_HEIGHT]} />
              <meshStandardMaterial
                map={o.long}
                emissiveMap={o.long}
                emissive="#ffffff"
                emissiveIntensity={0.28}
                roughness={0.92}
                metalness={0.05}
              />
            </mesh>
            <mesh
              position={[-HALL_LENGTH, HALL_HEIGHT / 2, 0]}
              rotation={[0, Math.PI / 2, 0]}
              raycast={() => null}
            >
              <planeGeometry args={[HALL_WIDTH * 2, HALL_HEIGHT]} />
              <meshStandardMaterial
                map={o.short}
                emissiveMap={o.short}
                emissive="#ffffff"
                emissiveIntensity={0.28}
                roughness={0.92}
                metalness={0.05}
              />
            </mesh>
            <mesh
              position={[HALL_LENGTH, HALL_HEIGHT / 2, 0]}
              rotation={[0, -Math.PI / 2, 0]}
              raycast={() => null}
            >
              <planeGeometry args={[HALL_WIDTH * 2, HALL_HEIGHT]} />
              <meshStandardMaterial
                map={o.short}
                emissiveMap={o.short}
                emissive="#ffffff"
                emissiveIntensity={0.28}
                roughness={0.92}
                metalness={0.05}
              />
            </mesh>
            <mesh position={[0, HALL_HEIGHT, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
              <planeGeometry args={[HALL_LENGTH * 2, HALL_WIDTH * 2]} />
              <meshStandardMaterial color="#0b0c10" roughness={0.95} metalness={0.1} />
            </mesh>
            <CeilingFixtures positions={l} color={Q.keyColor} active={false} />
            {[-6.6, 0, 6.6].map((M) => (
              <mesh key={M} position={[0, HALL_HEIGHT - 0.18, M]} raycast={() => null}>
                <boxGeometry args={[HALL_LENGTH * 2, 0.36, 0.22]} />
                <meshStandardMaterial color="#111318" metalness={0.75} roughness={0.42} />
              </mesh>
            ))}
          </group>
          {A && <AeroStreamlines highDownforce={g} />}
        </group>
      </>
    );
  },
);

export { CameraRig } from "./CameraRig";

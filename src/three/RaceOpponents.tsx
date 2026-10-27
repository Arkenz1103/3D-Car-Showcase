// @ts-nocheck
/**
 * The two AI supercars.
 *
 * They are deliberately cheap: a handful of scaled unit boxes and four shared
 * cylinder wheels per car, all reusing the same two geometries and three
 * materials for the whole field. Nothing here is instanced because there are
 * only two of them and each needs its own paint colour — the draw call cost is
 * a dozen triangles-batches, and the part that actually matters (their
 * station-keeping simulation) already runs in `raceAi` inside the engine.
 *
 * Geometry and materials are module level singletons: created once, shared by
 * every mount, and never rebuilt when the player leaves and re-enters race mode.
 */
import { useFrame } from "@react-three/fiber";
import { Fragment, memo, useRef } from "react";
import { BoxGeometry, CylinderGeometry, MeshStandardMaterial } from "three";
import { AI_COUNT, raceAi, raceDrive } from "./raceEngine";
import { raceSession } from "./raceSession";
import { markShadowsDirty } from "./sceneMotion";

const unitBox = new BoxGeometry(1, 1, 1);
const wheelGeometry = new CylinderGeometry(0.36, 0.36, 0.3, 12);
// Lay the cylinder on its side so the axle runs along the car's X axis.
wheelGeometry.rotateZ(Math.PI / 2);

/** High contrast paints so the pack reads instantly against the tarmac. */
const PAINTS = ["#FF5A1F", "#B4FF3A"];

const shellMaterials = PAINTS.map(
  (hex) =>
    new MeshStandardMaterial({
      color: hex,
      roughness: 0.33,
      metalness: 0.45,
      envMapIntensity: 1.3,
    }),
);

/** Shared dark glass/mirror finish for both cockpits and both wheelsets. */
const cockpitMaterial = new MeshStandardMaterial({
  color: "#0d1116",
  roughness: 0.15,
  metalness: 0.62,
  envMapIntensity: 1.1,
});
const tyreMaterial = new MeshStandardMaterial({
  color: "#14161a",
  roughness: 0.86,
  metalness: 0.05,
  envMapIntensity: 0.6,
});
const headlampMaterial = new MeshStandardMaterial({
  color: "#DCEEFF",
  emissive: "#DCEEFF",
  emissiveIntensity: 2.5,
  toneMapped: false,
});
const taillampMaterial = new MeshStandardMaterial({
  color: "#B0101A",
  emissive: "#FF1A22",
  emissiveIntensity: 1.6,
  toneMapped: false,
});

const WHEELS = [
  [-0.88, 0.36, -1.5],
  [0.88, 0.36, -1.5],
  [-0.9, 0.36, 1.45],
  [0.9, 0.36, 1.45],
];

export const RaceOpponents = memo(function RaceOpponents() {
  const groups = useRef<any[]>([]);
  const lampGroups = useRef<any[]>([]);

  useFrame(() => {
    const active = raceDrive.active;
    const lampsOn = active && raceSession.carLightsOn;
    for (let car = 0; car < AI_COUNT; car++) {
      const lamps = lampGroups.current[car];
      if (lamps && lamps.visible !== lampsOn) lamps.visible = lampsOn;
    }
    if (!active) {
      for (let car = 0; car < AI_COUNT; car++) {
        const node = groups.current[car];
        if (node && node.visible) node.visible = false;
      }
      return;
    }
    for (let car = 0; car < AI_COUNT; car++) {
      const node = groups.current[car];
      if (!node) continue;
      node.visible = true;
      node.position.set(raceAi.x[car], raceAi.y[car], raceAi.z[car]);
      // Same convention as the player's rig: local -Z is forward.
      node.rotation.y = raceAi.heading[car];
    }
    markShadowsDirty();
  }, -2);

  return (
    <>
      {Array.from({ length: AI_COUNT }, (_, car) => (
        <group
          key={car}
          visible={false}
          ref={(node: any) => {
            if (node) groups.current[car] = node;
          }}
        >
          {/* Chassis, nose wedge and rear wing share the car's paint. */}
          <mesh
            geometry={unitBox}
            material={shellMaterials[car]}
            position={[0, 0.58, 0]}
            scale={[1.9, 0.5, 4.3]}
            castShadow
          />
          <mesh
            geometry={unitBox}
            material={shellMaterials[car]}
            position={[0, 0.42, -1.9]}
            scale={[1.72, 0.26, 1.4]}
            castShadow
          />
          <mesh
            geometry={unitBox}
            material={cockpitMaterial}
            position={[0, 0.99, 0.34]}
            scale={[1.46, 0.44, 1.95]}
          />
          <mesh
            geometry={unitBox}
            material={shellMaterials[car]}
            position={[0, 1.2, 2.06]}
            scale={[1.78, 0.07, 0.52]}
          />
          <group
            visible={false}
            ref={(node: any) => {
              if (node) lampGroups.current[car] = node;
            }}
          >
            {[-0.62, 0.62].map((x) => (
              <Fragment key={x}>
                <mesh geometry={unitBox} material={headlampMaterial} position={[x, 0.68, -2.18]} scale={[0.38, 0.14, 0.05]} />
                <mesh geometry={unitBox} material={taillampMaterial} position={[x, 0.68, 2.18]} scale={[0.34, 0.13, 0.05]} />
              </Fragment>
            ))}
          </group>
          {WHEELS.map((position, index) => (
            <mesh
              key={index}
              geometry={wheelGeometry}
              material={tyreMaterial}
              position={position}
              raycast={() => null}
            />
          ))}
        </group>
      ))}
    </>
  );
});

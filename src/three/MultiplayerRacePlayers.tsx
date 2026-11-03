// @ts-nocheck
/** Remote race cars: 20 Hz state send + smoothed, shadowless GLB replicas. */
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { memo, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Group } from "three";
import { CARS, getCarById } from "@/data/catalog";
import { loadVehicleAsset } from "@/lib/gltf";
import { getMultiplayerSnapshot, publishRacePose, subscribeMultiplayerState } from "@/lib/multiplayer";
import { raceDrive } from "./raceEngine";

const modelCache = new Map();

function loadRemoteCar(carId: string) {
  if (!modelCache.has(carId)) {
    const car = getCarById(carId);
    const request = loadVehicleAsset(null, null, car, { accelerateRaycast: false })
      .then((asset) => asset.gltf.scene)
      .catch((error) => {
        modelCache.delete(carId);
        throw error;
      });
    modelCache.set(carId, request);
  }
  return modelCache.get(carId).then((scene) => scene.clone(true));
}

function RemoteRaceCar({ player }: { player: any }) {
  const group = useRef<Group>(null);
  const speedLabel = useRef<HTMLDivElement>(null);
  const hasPose = useRef(false);
  const [model, setModel] = useState<any>(null);
  const car = CARS.find((entry) => entry.id === player.carId) ?? CARS[0];

  useEffect(() => {
    let cancelled = false;
    setModel(null);
    loadRemoteCar(player.carId).then((scene) => {
      if (cancelled) return;
      scene.traverse((node: any) => {
        if (!node.isMesh) return;
        node.castShadow = false;
        node.receiveShadow = false;
        node.raycast = () => null;
      });
      setModel(scene);
    }).catch(() => {
      // The low-poly fallback keeps the room race visible if an optional GLB fails.
      if (!cancelled) setModel(false);
    });
    return () => { cancelled = true; };
  }, [player.carId]);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    const current = getMultiplayerSnapshot().players.find((candidate) => candidate.id === player.id);
    const pose = current?.pose;
    if (!pose) {
      node.visible = false;
      hasPose.current = false;
      return;
    }
    node.visible = true;
    if (!hasPose.current) {
      node.position.set(pose.x, pose.y, pose.z);
      node.rotation.set(pose.pitch, pose.heading, pose.roll);
      hasPose.current = true;
    } else {
      const blend = 1 - Math.exp(-Math.min(delta, 0.05) * 14);
      node.position.x += (pose.x - node.position.x) * blend;
      node.position.y += (pose.y - node.position.y) * blend;
      node.position.z += (pose.z - node.position.z) * blend;
      const yawDelta = Math.atan2(Math.sin(pose.heading - node.rotation.y), Math.cos(pose.heading - node.rotation.y));
      node.rotation.y += yawDelta * blend;
      node.rotation.x += (pose.pitch - node.rotation.x) * blend;
      node.rotation.z += (pose.roll - node.rotation.z) * blend;
    }
    if (speedLabel.current) speedLabel.current.textContent = `${Math.max(0, Math.round(pose.speed * 3.6))} km/h`;
  });

  return (
    <group ref={group} visible={false}>
      {model && model !== false ? (
        <primitive object={model} dispose={null} />
      ) : model === false ? (
        <group position={[0, 0.04, 0]}>
          <mesh position={[0, 0.52, 0]} castShadow={false} receiveShadow={false} raycast={() => null}>
            <boxGeometry args={[1.82, 0.62, 4.1]} />
            <meshStandardMaterial color={car.accentHex} metalness={0.55} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.95, 0.18]} castShadow={false} receiveShadow={false} raycast={() => null}>
            <boxGeometry args={[1.35, 0.43, 1.65]} />
            <meshStandardMaterial color="#11151c" metalness={0.45} roughness={0.2} />
          </mesh>
        </group>
      ) : null}
      <Html position={[0, 3.1, 0]} center distanceFactor={16} occlude={false} style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap rounded-lg border border-sky-200/35 bg-[#07111de8] px-2.5 py-1 text-center shadow-[0_5px_18px_rgba(0,0,0,.55)] backdrop-blur-sm">
          <div className="font-mono-tech text-[9px] font-bold uppercase tracking-[0.12em] text-sky-100">{player.username}</div>
          <div className="mt-0.5 font-mono-tech text-[7px] uppercase tracking-wider text-sky-200/60">{car.shortTitle || car.model} · <span ref={speedLabel}>0 km/h</span></div>
        </div>
      </Html>
    </group>
  );
}

export const MultiplayerRacePlayers = memo(function MultiplayerRacePlayers() {
  const room = useSyncExternalStore(subscribeMultiplayerState, getMultiplayerSnapshot, getMultiplayerSnapshot);
  const remotePlayers = room.players.filter((player) => player.id !== room.localPlayerId);
  const lastSentAt = useRef(0);

  useFrame(() => {
    if (!room.connected || !raceDrive.active) return;
    const now = performance.now();
    if (now - lastSentAt.current < 50) return;
    lastSentAt.current = now;
    publishRacePose({
      x: raceDrive.x,
      y: raceDrive.y,
      z: raceDrive.z,
      pitch: raceDrive.pitch,
      heading: raceDrive.heading,
      roll: raceDrive.roll,
      speed: raceDrive.speed,
    });
  }, -1);

  return <>{remotePlayers.map((player) => <RemoteRaceCar key={player.id} player={player} />)}</>;
});

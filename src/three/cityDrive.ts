// Allocation-free free-roam handling shared with the existing vehicle rig.
import { raceDrive, raceInput, raceTelemetry } from "./raceEngine";
import { isCityBuildingAt, isCityGarageExitAt, isCityJunctionAt, sampleCityRoad } from "./cityLayout";

const MAX_SPEED = 32;
const REVERSE_SPEED = 8;
const ACCELERATION = 12.5;
const BRAKING = 21;
const DRAG = 1.3;
const WHEEL_RADIUS = 0.34;
const ROAD_EDGE_ALLOWANCE = 1.3;

export const cityInput = {
  forward: false,
  reverse: false,
  left: false,
  right: false,
  handbrake: false,
};

export const cityDrive = {
  active: false,
  x: 0,
  y: 0,
  z: 0,
  heading: Math.PI,
  speed: 0,
  steer: 0,
  pitch: 0,
  lastSafeX: 0,
  lastSafeY: 0,
  lastSafeZ: 0,
};

export function releaseCityKeys() {
  cityInput.forward = false;
  cityInput.reverse = false;
  cityInput.left = false;
  cityInput.right = false;
  cityInput.handbrake = false;
  raceInput.throttle = 0;
  raceInput.brake = 0;
  raceInput.steer = 0;
  raceInput.handbrake = false;
}

export function startCityDrive() {
  releaseCityKeys();
  const road = sampleCityRoad(0, 0);
  cityDrive.active = true;
  cityDrive.x = 0;
  cityDrive.y = road.y + 0.02;
  cityDrive.z = 0;
  cityDrive.heading = Math.PI;
  cityDrive.speed = 0;
  cityDrive.steer = 0;
  cityDrive.pitch = 0;
  cityDrive.lastSafeX = 0;
  cityDrive.lastSafeY = cityDrive.y;
  cityDrive.lastSafeZ = 0;
  raceDrive.active = true;
  raceDrive.x = 0;
  raceDrive.y = cityDrive.y;
  raceDrive.z = 0;
  raceDrive.heading = Math.PI;
  raceDrive.pitch = 0;
  raceDrive.roll = 0;
  raceDrive.speed = 0;
  raceDrive.steerDeg = 0;
  raceDrive.spinRate = 0;
  raceDrive.boosting = false;
  raceDrive.boostFx = 0;
  raceDrive.braking = false;
  raceDrive.handbraking = false;
  raceDrive.crashFx = 0;
}

export function stopCityDrive() {
  releaseCityKeys();
  cityDrive.active = false;
  cityDrive.x = 0;
  cityDrive.y = 0;
  cityDrive.z = 0;
  cityDrive.heading = Math.PI;
  cityDrive.speed = 0;
  cityDrive.steer = 0;
  cityDrive.pitch = 0;
  cityDrive.lastSafeX = 0;
  cityDrive.lastSafeY = 0;
  cityDrive.lastSafeZ = 0;
  raceDrive.active = false;
  raceDrive.x = 0;
  raceDrive.y = 0;
  raceDrive.z = 0;
  raceDrive.heading = 0;
  raceDrive.speed = 0;
  raceDrive.steerDeg = 0;
  raceDrive.spinRate = 0;
  raceDrive.braking = false;
  raceDrive.handbraking = false;
  raceDrive.boostFx = 0;
  raceTelemetry.speedKph = 0;
  raceTelemetry.rpm = 800;
  raceTelemetry.gear = 0;
  raceTelemetry.gearLabel = "N";
  raceTelemetry.handbraking = false;
  raceTelemetry.drift = 0;
}

function approachZero(value: number, amount: number) {
  if (value > amount) return value - amount;
  if (value < -amount) return value + amount;
  return 0;
}

export function stepCityDrive(delta: number) {
  if (!cityDrive.active) return;
  const dt = Math.min(delta, 0.05);
  const steerInput = Number(cityInput.left) - Number(cityInput.right);
  const forward = cityInput.forward;
  const reverse = cityInput.reverse;

  raceInput.throttle = forward && !reverse ? 1 : 0;
  raceInput.brake = reverse && cityDrive.speed > 0.65 ? 1 : 0;
  raceInput.steer = steerInput;
  raceInput.handbrake = cityInput.handbrake;

  if (forward && !reverse) {
    if (cityDrive.speed < 0) cityDrive.speed = Math.min(0, cityDrive.speed + BRAKING * dt);
    else cityDrive.speed = Math.min(MAX_SPEED, cityDrive.speed + ACCELERATION * dt);
  } else if (reverse) {
    if (cityDrive.speed > 0) cityDrive.speed = Math.max(0, cityDrive.speed - BRAKING * dt);
    else cityDrive.speed = Math.max(-REVERSE_SPEED, cityDrive.speed - ACCELERATION * 0.72 * dt);
  } else {
    cityDrive.speed = approachZero(cityDrive.speed, DRAG * dt);
  }

  if (cityInput.handbrake) cityDrive.speed = approachZero(cityDrive.speed, BRAKING * 0.58 * dt);
  const speedRatio = Math.min(1, Math.abs(cityDrive.speed) / 4.2);
  cityDrive.steer += (steerInput - cityDrive.steer) * Math.min(1, dt * 8);
  // The shared car rig faces local -Z while the boulevard heads +Z (yaw π).
  // A positive left-steer must therefore advance yaw to turn the nose toward +X.
  cityDrive.heading += cityDrive.steer * speedRatio * dt * (cityDrive.speed < 0 ? -1 : 1) * 1.65;

  const nextX = cityDrive.x - Math.sin(cityDrive.heading) * cityDrive.speed * dt;
  const nextZ = cityDrive.z - Math.cos(cityDrive.heading) * cityDrive.speed * dt;
  const road = sampleCityRoad(nextX, nextZ);
  const onRoad = isCityGarageExitAt(nextX, nextZ) || isCityJunctionAt(nextX, nextZ) || road.distance <= Math.max(2, road.width / 2 - ROAD_EDGE_ALLOWANCE);
  const blocked = !onRoad || isCityBuildingAt(nextX, nextZ);
  if (blocked) {
    cityDrive.speed = approachZero(cityDrive.speed, BRAKING * dt);
    cityDrive.x = cityDrive.lastSafeX;
    cityDrive.y = cityDrive.lastSafeY;
    cityDrive.z = cityDrive.lastSafeZ;
    cityDrive.pitch = 0;
    raceDrive.crashFx = Math.max(raceDrive.crashFx, 0.2);
  } else {
    cityDrive.x = nextX;
    cityDrive.y = road.y + 0.02;
    cityDrive.z = nextZ;
    const facingX = -Math.sin(cityDrive.heading) * (cityDrive.speed < 0 ? -1 : 1);
    const facingZ = -Math.cos(cityDrive.heading) * (cityDrive.speed < 0 ? -1 : 1);
    const alignment = facingX * road.tangentX + facingZ * road.tangentZ;
    cityDrive.pitch = Math.atan(road.grade * alignment);
    cityDrive.lastSafeX = cityDrive.x;
    cityDrive.lastSafeY = cityDrive.y;
    cityDrive.lastSafeZ = cityDrive.z;
  }

  raceDrive.x = cityDrive.x;
  raceDrive.y = cityDrive.y;
  raceDrive.z = cityDrive.z;
  raceDrive.heading = cityDrive.heading;
  raceDrive.pitch = cityDrive.pitch;
  raceDrive.roll = -cityDrive.steer * Math.min(0.06, speedRatio * 0.06);
  raceDrive.speed = cityDrive.speed;
  raceDrive.steerDeg = cityDrive.steer * 27;
  raceDrive.spinRate = cityDrive.speed / WHEEL_RADIUS;
  raceDrive.braking = raceInput.brake > 0;
  raceDrive.handbraking = cityInput.handbrake;
  raceDrive.boostFx = 0;

  const speedKph = Math.abs(cityDrive.speed) * 3.6;
  const gear = speedKph < 2 ? 0 : speedKph < 20 ? 1 : speedKph < 42 ? 2 : speedKph < 70 ? 3 : speedKph < 102 ? 4 : 5;
  raceTelemetry.speedKph = speedKph;
  raceTelemetry.rpm = speedKph < 2 ? 850 : 1200 + Math.min(6200, speedKph * 49);
  raceTelemetry.gear = gear;
  raceTelemetry.gearLabel = gear === 0 ? "N" : String(gear);
  raceTelemetry.handbraking = cityInput.handbrake;
  raceTelemetry.drift = cityInput.handbrake && speedKph > 25 ? 0.55 : 0;
}

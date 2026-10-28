// Allocation-free free-roam handling shared with the existing vehicle rig.
import { raceDrive, raceInput, raceTelemetry } from "./raceEngine";
import { isCityBuildingAt, isCityGarageExitAt, isCityJunctionAt, sampleCityRoad } from "./cityLayout";

const REVERSE_SPEED = 6.5;
const REVERSE_ACCELERATION = 4.2;
const SERVICE_BRAKING = 28;
const HANDBRAKE_BRAKING = 10.5;
const COAST_DRAG = 0.22;
const WHEEL_RADIUS = 0.34;
const ROAD_EDGE_ALLOWANCE = 1.3;

/**
 * Verified production figures drive the two real road cars. The McLaren VGT is
 * a virtual concept, so its figures are a clearly marked game-simulation target.
 * Simulated per-gear redline bands scale to each car's published top speed.
 */
export const CITY_DRIVE_PROFILES = {
  sf90: {
    id: "sf90",
    model: "Ferrari SF90 Stradale",
    transmission: "8-speed DCT",
    topSpeedKph: 340,
    zeroTo100Kph: 2.5,
    redlineRpm: 8500,
    idleRpm: 850,
    shiftSeconds: 0.12,
    gearRedlineKph: [65, 106, 150, 194, 238, 279, 313, 340],
  },
  aventador: {
    id: "aventador",
    model: "Lamborghini Aventador LP 700-4",
    transmission: "7-speed ISR",
    topSpeedKph: 350,
    zeroTo100Kph: 2.9,
    redlineRpm: 8500,
    idleRpm: 850,
    shiftSeconds: 0.08,
    gearRedlineKph: [67, 112, 161, 210, 259, 308, 350],
  },
  "mclaren-vgt": {
    id: "mclaren-vgt",
    model: "McLaren Ultimate Vision GT",
    transmission: "8-speed concept DCT",
    topSpeedKph: 391,
    zeroTo100Kph: 2.7,
    redlineRpm: 9000,
    idleRpm: 900,
    shiftSeconds: 0.08,
    gearRedlineKph: [70, 117, 168, 219, 270, 321, 364, 391],
    concept: true,
  },
} as const;

const DEFAULT_PROFILE = CITY_DRIVE_PROFILES.sf90;
let activeProfile: any = DEFAULT_PROFILE;
const gearTopSpeedKph = (gear: number) => activeProfile.gearRedlineKph[gear - 1];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const cityInput = {
  forward: false,
  brake: false,
  left: false,
  right: false,
  handbrake: false,
};

export const cityDrive: any = {
  active: false,
  x: 0,
  y: 0,
  z: 0,
  heading: Math.PI,
  speed: 0,
  steer: 0,
  pitch: 0,
  gear: 0,
  gearCount: DEFAULT_PROFILE.gearRedlineKph.length,
  topSpeedKph: DEFAULT_PROFILE.topSpeedKph,
  rpm: 0,
  engineRunning: false,
  redlineRpm: DEFAULT_PROFILE.redlineRpm,
  transmission: DEFAULT_PROFILE.transmission,
  modelName: DEFAULT_PROFILE.model,
  concept: false,
  shiftTimer: 0,
  shiftFeedback: "",
  shiftFeedbackTime: 0,
  shiftPrompt: "",
  lastSafeX: 0,
  lastSafeY: 0,
  lastSafeZ: 0,
};

export function releaseCityKeys() {
  cityInput.forward = false;
  cityInput.brake = false;
  cityInput.left = false;
  cityInput.right = false;
  cityInput.handbrake = false;
  raceInput.throttle = 0;
  raceInput.brake = 0;
  raceInput.steer = 0;
  raceInput.handbrake = false;
}

export function startCityDrive(carId = "sf90") {
  releaseCityKeys();
  activeProfile = CITY_DRIVE_PROFILES[carId as keyof typeof CITY_DRIVE_PROFILES] ?? DEFAULT_PROFILE;
  cityDrive.gear = 0;
  cityDrive.engineRunning = false;
  cityDrive.gearCount = activeProfile.gearRedlineKph.length;
  cityDrive.topSpeedKph = activeProfile.topSpeedKph;
  cityDrive.redlineRpm = activeProfile.redlineRpm;
  cityDrive.transmission = activeProfile.transmission;
  cityDrive.modelName = activeProfile.model;
  cityDrive.concept = Boolean(activeProfile.concept);
  cityDrive.rpm = 0;
  cityDrive.shiftTimer = 0;
  cityDrive.shiftFeedback = "";
  cityDrive.shiftFeedbackTime = 0;
  cityDrive.shiftPrompt = "";
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
  raceTelemetry.speedKph = 0;
  raceTelemetry.rpm = 0;
  raceTelemetry.gear = 0;
  raceTelemetry.gearLabel = "N";
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
  cityDrive.gear = 0;
  cityDrive.engineRunning = false;
  cityDrive.rpm = 0;
  cityDrive.shiftTimer = 0;
  cityDrive.shiftFeedback = "";
  cityDrive.shiftFeedbackTime = 0;
  cityDrive.shiftPrompt = "";
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

function setShiftFeedback(message: string, duration = 0.8) {
  cityDrive.shiftFeedback = message;
  cityDrive.shiftFeedbackTime = duration;
}

/** The ignition is separate from throttle so the engine can idle/rev in neutral. */
export function toggleCityEngine() {
  if (!cityDrive.active) return false;
  if (!cityDrive.engineRunning) {
    if (cityDrive.gear !== 0) {
      setShiftFeedback("SELECT NEUTRAL TO START");
      return false;
    }
    cityDrive.engineRunning = true;
    cityDrive.rpm = activeProfile.idleRpm;
    setShiftFeedback("ENGINE STARTED", 1.2);
    return true;
  }
  if (cityDrive.gear !== 0 || Math.abs(cityDrive.speed) > 0.5) {
    setShiftFeedback("STOP IN NEUTRAL TO SHUT DOWN");
    return false;
  }
  cityDrive.engineRunning = false;
  cityDrive.rpm = 0;
  setShiftFeedback("ENGINE OFF", 1.2);
  return true;
}

export function selectCityGear(target: -1 | 0) {
  if (!cityDrive.active) return false;
  if (target === -1 && Math.abs(cityDrive.speed) > 0.4) {
    setShiftFeedback("STOP BEFORE REVERSE");
    return false;
  }
  if (cityDrive.gear === target) {
    setShiftFeedback(target === 0 ? "ALREADY IN NEUTRAL" : "REVERSE SELECTED", 0.65);
    return target === -1;
  }
  cityDrive.gear = target;
  cityDrive.shiftTimer = activeProfile.shiftSeconds;
  setShiftFeedback(target === 0 ? "NEUTRAL" : "REVERSE GEAR", 0.8);
  return true;
}

/** Sequential R ↔ N ↔ 1…N shifting with protection against over-rev downshifts. */
export function shiftCityGear(direction: -1 | 1) {
  if (!cityDrive.active) return false;
  const previousGear = cityDrive.gear;
  let nextGear = previousGear;
  if (direction > 0) {
    if (previousGear < 0) nextGear = 0;
    else if (previousGear === 0) nextGear = 1;
    else nextGear = Math.min(cityDrive.gearCount, previousGear + 1);
  } else if (previousGear > 1) {
    nextGear = previousGear - 1;
  } else if (previousGear === 1) {
    nextGear = 0;
  } else if (previousGear === 0) {
    nextGear = -1;
  }
  if (nextGear === previousGear) {
    setShiftFeedback(direction > 0 ? "TOP GEAR" : "LOWEST GEAR", 0.65);
    return false;
  }
  const speedKph = Math.abs(cityDrive.speed) * 3.6;
  if (nextGear === -1 && speedKph > 1.5) {
    setShiftFeedback("STOP BEFORE REVERSE");
    return false;
  }
  if (nextGear > 0 && previousGear > 0 && nextGear < previousGear && speedKph > gearTopSpeedKph(nextGear) * 0.94) {
    setShiftFeedback("OVERSPEED · DOWNSHIFT BLOCKED");
    return false;
  }
  cityDrive.gear = nextGear;
  cityDrive.shiftTimer = activeProfile.shiftSeconds;
  setShiftFeedback(nextGear === 0 ? "NEUTRAL" : direction > 0 ? "UPSHIFT" : nextGear < 0 ? "REVERSE GEAR" : "DOWNSHIFT", 0.65);
  return true;
}

function updateTransmissionTelemetry(speedKph: number) {
  if (!cityDrive.engineRunning) {
    cityDrive.rpm = 0;
  } else if (cityDrive.gear > 0) {
    const gearLimit = Math.max(1, gearTopSpeedKph(cityDrive.gear));
    const rpmFraction = clamp(speedKph / gearLimit, 0, 1);
    cityDrive.rpm = activeProfile.idleRpm + (activeProfile.redlineRpm - activeProfile.idleRpm) * rpmFraction;
  } else if (cityDrive.gear < 0) {
    const rpmFraction = clamp(speedKph / (REVERSE_SPEED * 3.6), 0, 0.72);
    cityDrive.rpm = activeProfile.idleRpm + (activeProfile.redlineRpm - activeProfile.idleRpm) * rpmFraction;
  }
  const rpmFraction = cityDrive.gear > 0
    ? clamp(speedKph / Math.max(1, gearTopSpeedKph(cityDrive.gear)), 0, 1)
    : 0;
  cityDrive.shiftPrompt = cityDrive.shiftTimer > 0
    ? "SHIFTING"
    : cityDrive.gear === 0
      ? "NEUTRAL"
      : cityDrive.gear > 0 && rpmFraction >= 0.93 && cityDrive.gear < cityDrive.gearCount
        ? "SHIFT UP"
        : "";
  raceTelemetry.rpm = cityDrive.rpm;
  raceTelemetry.gear = cityDrive.gear;
  raceTelemetry.gearLabel = cityDrive.gear < 0 ? "R" : cityDrive.gear === 0 ? "N" : String(cityDrive.gear);
  raceTelemetry.speedKph = speedKph;
}

export function stepCityDrive(delta: number) {
  if (!cityDrive.active) return;
  const dt = Math.min(delta, 0.05);
  const steerInput = Number(cityInput.left) - Number(cityInput.right);
  const forward = cityInput.forward;
  const brake = cityInput.brake;

  raceInput.throttle = cityDrive.engineRunning && forward ? 1 : 0;
  raceInput.brake = brake ? 1 : 0;
  raceInput.steer = steerInput;
  raceInput.handbrake = cityInput.handbrake;

  cityDrive.shiftTimer = Math.max(0, cityDrive.shiftTimer - dt);
  cityDrive.shiftFeedbackTime = Math.max(0, cityDrive.shiftFeedbackTime - dt);
  if (cityDrive.shiftFeedbackTime === 0) cityDrive.shiftFeedback = "";
  const startingSpeedKph = Math.abs(cityDrive.speed) * 3.6;
  const topSpeedRatio = Math.min(1, startingSpeedKph / activeProfile.topSpeedKph);
  const aerodynamicDrag = COAST_DRAG + topSpeedRatio * topSpeedRatio * 0.48;

  if (cityDrive.engineRunning && cityDrive.gear === 0) {
    const targetRpm = forward && !brake
      ? activeProfile.idleRpm + (activeProfile.redlineRpm - activeProfile.idleRpm) * 0.78
      : activeProfile.idleRpm;
    const response = 1 - Math.exp(-dt * (targetRpm > cityDrive.rpm ? 7 : 3.5));
    cityDrive.rpm += (targetRpm - cityDrive.rpm) * response;
  }

  if (brake) {
    cityDrive.speed = approachZero(cityDrive.speed, SERVICE_BRAKING * dt);
  } else if (forward) {
    if (cityDrive.engineRunning && cityDrive.gear < 0 && cityDrive.shiftTimer <= 0) {
      if (cityDrive.speed > 0) cityDrive.speed = approachZero(cityDrive.speed, SERVICE_BRAKING * dt);
      else cityDrive.speed = Math.max(-REVERSE_SPEED, cityDrive.speed - REVERSE_ACCELERATION * dt);
    } else if (cityDrive.speed < 0) {
      cityDrive.speed = approachZero(cityDrive.speed, SERVICE_BRAKING * dt);
    } else if (cityDrive.engineRunning && cityDrive.gear > 0 && cityDrive.shiftTimer <= 0) {
      const gearLimitKph = gearTopSpeedKph(cityDrive.gear);
      if (startingSpeedKph >= gearLimitKph - 0.05) {
        cityDrive.speed = gearLimitKph / 3.6;
      } else {
        const rpmFraction = clamp(startingSpeedKph / gearLimitKph, 0, 1);
        const torqueBand = 0.92 + 0.08 * Math.sin(rpmFraction * Math.PI * 0.72);
        const powerFade = 1 - 0.48 * topSpeedRatio * topSpeedRatio;
        const launchAccel = (100 / 3.6 / activeProfile.zeroTo100Kph) * 1.1;
        const acceleration = launchAccel * torqueBand * powerFade;
        cityDrive.speed = Math.min(
          Math.min(activeProfile.topSpeedKph, gearLimitKph) / 3.6,
          cityDrive.speed + acceleration * dt,
        );
      }
    } else {
      cityDrive.speed = approachZero(cityDrive.speed, aerodynamicDrag * dt);
    }
  } else {
    cityDrive.speed = approachZero(cityDrive.speed, aerodynamicDrag * dt);
  }

  if (cityInput.handbrake) cityDrive.speed = approachZero(cityDrive.speed, HANDBRAKE_BRAKING * dt);
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
    // Reduce momentum in proportion to impact speed/material, and release the
    // throttle so it cannot immediately overcome the crash deceleration.
    const impactKph = Math.abs(cityDrive.speed) * 3.6;
    const buildingImpact = isCityBuildingAt(nextX, nextZ);
    const impactLoss = clamp(0.38 + impactKph / 260 * 0.42 + (buildingImpact ? 0.16 : 0), 0.38, 0.92);
    cityDrive.speed = impactKph < 1.5 ? 0 : cityDrive.speed * (1 - impactLoss);
    cityDrive.shiftTimer = 0;
    setShiftFeedback("IMPACT · SPEED REDUCED", 0.9);
    cityInput.forward = false;
    raceInput.throttle = 0;
    cityDrive.x = cityDrive.lastSafeX;
    cityDrive.y = cityDrive.lastSafeY;
    cityDrive.z = cityDrive.lastSafeZ;
    cityDrive.pitch = 0;
    raceDrive.crashFx = Math.max(raceDrive.crashFx, clamp(impactKph / 100, 0.15, 1));
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
  updateTransmissionTelemetry(speedKph);
  raceTelemetry.handbraking = cityInput.handbrake;
  raceTelemetry.drift = cityInput.handbrake && speedKph > 25 ? 0.55 : 0;
}

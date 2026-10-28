/**
 * Shared hydraulic-lift + turntable timeline.
 *
 * One deterministic timeline drives BOTH the platform and the car, so they can
 * never drift apart (the previous implementation ran two independent clocks –
 * the car's clock only started once its GLB finished loading, which made the
 * car rise out of sync with the platform and jump after shader-compile hitches).
 *
 * The timeline is advanced with a clamped delta time by exactly one driver
 * (<LiftDirector/>) and read by every consumer in their own useFrame.
 * React only sees throttled snapshots (phase / progress) for the HUD.
 */
import { MathUtils } from "three";

export type LiftPhase =
  | "idle" // nothing loaded yet – platform parked at the pit floor
  | "arming" // car mounted, waiting for shaders to compile / first frame
  | "hold" // short dwell at the bottom (hydraulics engage)
  | "ascending" // slow, smooth rise
  | "settle" // locked at showroom level, brief pause
  | "showcase" // slow 360° presentation turn
  | "unwind" // user interrupted – ease back to the nearest aligned angle
  | "drive-align" // slowly turn the elevator and car toward the open garage gate
  | "done";

export const LIFT_TIMING = {
  /** metres the platform sits below the showroom floor */
  depth: 1.5,
  /** small yaw offset while rising so the ascent reads as "arriving" */
  entryYaw: -0.24,
  /** seconds the platform waits at the bottom before rising */
  hold: 0.8,
  /** seconds for the ascent (smootherstep – slow start, slow finish) */
  ascend: 7.2,
  /** seconds locked at the top before the showcase turn begins */
  settle: 1.1,
  /** One full turn including the acceleration and deceleration ramps. */
  showcase: 37.5,
  /** seconds spent easing in / out of the constant-speed part of the turn */
  ramp: 4,
  /** never wait longer than this for shader warm-up before starting */
  maxArmWait: 3,
  /** seconds for the turntable to face the open garage gate before city driving */
  driveAlign: 3.8,
} as const;

export interface LiftSnapshot {
  phase: LiftPhase;
  /** 0..1 progress inside the current phase */
  progress: number;
  /** current yaw in degrees (0..360) – handy for the HUD */
  yawDeg: number;
  seq: number;
}

const TAU = Math.PI * 2;
/** max angular speed (rad/s) while unwinding after a user interruption (~60°/s) */
const UNWIND_MAX_SPEED = 1.05;

/** Ken Perlin's smootherstep: zero 1st & 2nd derivatives at both ends. */
const smootherstep = (t: number) => {
  const x = MathUtils.clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

/**
 * Angle travelled during the showcase with a trapezoidal velocity profile and
 * cosine ramps: ease-in (ramp s) → constant speed → ease-out (ramp s).
 * Guarantees exactly one full turn (2π) at t = showcase.
 */
function showcaseAngle(t: number): number {
  const T = LIFT_TIMING.showcase;
  const r = LIFT_TIMING.ramp;
  const omega = TAU / (T - r);
  const rampDist = (u: number) => (omega / 2) * (u - (r / Math.PI) * Math.sin((Math.PI * u) / r));
  if (t <= 0) return 0;
  if (t >= T) return TAU;
  if (t < r) return rampDist(t);
  if (t <= T - r) return rampDist(r) + omega * (t - r);
  return TAU - rampDist(T - t);
}

type Listener = () => void;

export class LiftTimeline {
  // ---- mutable simulation state (read every frame by three.js consumers)
  y: number = -LIFT_TIMING.depth;
  yaw: number = LIFT_TIMING.entryYaw;
  phase: LiftPhase = "idle";
  seq = Number.NaN;

  private t = 0;
  private readySeq = Number.NaN;
  private armWait = 0;
  private skipRequested = false;
  private unwindTarget = 0;
  private unwindSpeed = 0;
  private driveAlignStartYaw = 0;
  private driveAlignDelta = 0;
  private driveAlignTargetYaw = Math.PI;
  private driveAlignStartY = 0;

  // ---- React-facing snapshot (throttled)
  private listeners = new Set<Listener>();
  private snapshot: LiftSnapshot = { phase: "idle", progress: 0, yawDeg: 0, seq: Number.NaN };
  private publishAccumulator = 0;

  /** True once the platform has reached showroom level for the current sequence. */
  get atTop() {
    return (
      this.phase === "settle" || this.phase === "showcase" || this.phase === "unwind" || this.phase === "done"
    );
  }

  /** True while something is still moving and frames must keep rendering. */
  get animating() {
    return this.phase !== "idle" && this.phase !== "done";
  }

  /** Elapsed seconds inside the active phase (used to align phase audio). */
  get elapsed() {
    return this.t;
  }

  /** Start (or restart) the whole sequence for a new entrance. */
  begin(seq: number) {
    if (this.seq === seq) return;
    this.seq = seq;
    this.t = 0;
    this.armWait = 0;
    this.skipRequested = false;
    this.publishAccumulator = 0;
    // Reset before the first frame of the newly mounted vehicle.
    this.y = -LIFT_TIMING.depth;
    this.yaw = LIFT_TIMING.entryYaw;
    this.phase = "arming";
    this.publish(true);
  }

  /** The vehicle reports that its shaders are compiled and it has been drawn once. */
  markReady(seq: number) {
    if (seq === this.seq) this.readySeq = seq;
  }

  pauseShowcase() {
    if (this.phase === "drive-align") return;
    if (this.atTop) {
      // Manual navigation takes over at the current angle, without a fast unwind.
      this.phase = "done";
      this.publish(true);
    } else {
      this.skipRequested = true;
    }
  }

  /** Settle the display lift before handing its vehicle to the open-road driver. */
  prepareForDrive() {
    this.y = 0;
    this.yaw = 0;
    this.phase = "done";
    this.skipRequested = false;
    this.t = 0;
    this.publish(true);
  }

  /**
   * Slowly turn the lift and car to face the positive-Z garage exit. Returns
   * true while an animation is needed; false means the lift was already aligned.
   */
  alignForDrive(targetYaw = Math.PI) {
    const tau = Math.PI * 2;
    let delta = targetYaw - this.yaw;
    delta = ((delta + Math.PI) % tau + tau) % tau - Math.PI;
    if (Math.abs(delta) < 0.0015 && Math.abs(this.y) < 0.0015) {
      this.y = 0;
      this.yaw = targetYaw;
      this.phase = "done";
      this.t = 0;
      this.skipRequested = false;
      this.publish(true);
      return false;
    }
    this.driveAlignStartYaw = this.yaw;
    this.driveAlignDelta = delta;
    this.driveAlignTargetYaw = targetYaw;
    this.driveAlignStartY = this.y;
    this.t = 0;
    this.phase = "drive-align";
    this.skipRequested = false;
    this.publish(true);
    return true;
  }

  /**
   * Called on user interaction. The ascent always completes, but the showcase
   * turn is skipped / gracefully unwound to the nearest aligned orientation.
   */
  skipShowcase() {
    if (this.phase === "showcase") {
      this.unwindTarget = this.yaw < Math.PI ? 0 : TAU;
      this.unwindSpeed = TAU / (LIFT_TIMING.showcase - LIFT_TIMING.ramp); // continue from cruise speed
      this.phase = "unwind";
      this.publish(true);
      return;
    }
    if (
      this.phase === "arming" ||
      this.phase === "hold" ||
      this.phase === "ascending" ||
      this.phase === "settle"
    ) {
      this.skipRequested = true;
    }
  }

  /** Advance the timeline. Returns true while frames must keep being rendered. */
  step(rawDelta: number): boolean {
    // Clamp so shader-compile / GC hitches pause the motion instead of skipping it
    // (frames up to 100 ms advance normally; anything longer is treated as a stall).
    const dt = Math.min(Math.max(rawDelta, 0), 0.1);
    switch (this.phase) {
      case "idle":
      case "done":
        return false;

      case "arming": {
        this.armWait += dt;
        if (this.readySeq === this.seq || this.armWait >= LIFT_TIMING.maxArmWait) {
          this.phase = "hold";
          this.t = 0;
          this.publish(true);
        }
        break;
      }

      case "hold": {
        this.t += dt;
        this.y = -LIFT_TIMING.depth;
        this.yaw = LIFT_TIMING.entryYaw;
        if (this.t >= LIFT_TIMING.hold) {
          this.phase = "ascending";
          this.t = 0;
          this.publish(true);
        }
        break;
      }

      case "ascending": {
        this.t += dt;
        const p = smootherstep(this.t / LIFT_TIMING.ascend);
        this.y = -LIFT_TIMING.depth * (1 - p);
        this.yaw = LIFT_TIMING.entryYaw * (1 - p);
        if (this.t >= LIFT_TIMING.ascend) {
          this.y = 0;
          this.yaw = 0;
          this.phase = "settle";
          this.t = 0;
          this.publish(true);
        }
        break;
      }

      case "settle": {
        this.t += dt;
        if (this.t >= LIFT_TIMING.settle) {
          this.t = 0;
          this.phase = this.skipRequested ? "done" : "showcase";
          this.publish(true);
        }
        break;
      }

      case "showcase": {
        this.t += dt;
        this.yaw = showcaseAngle(this.t);
        if (this.t >= LIFT_TIMING.showcase) {
          this.yaw = 0; // exactly one full turn → back to the hero orientation
          this.phase = "done";
          this.publish(true);
        }
        break;
      }

      case "drive-align": {
        this.t += dt;
        const progress = smootherstep(this.t / LIFT_TIMING.driveAlign);
        this.y = this.driveAlignStartY * (1 - progress);
        this.yaw = this.driveAlignStartYaw + this.driveAlignDelta * progress;
        if (this.t >= LIFT_TIMING.driveAlign) {
          this.y = 0;
          this.yaw = this.driveAlignTargetYaw;
          this.phase = "done";
          this.t = 0;
          this.publish(true);
        }
        break;
      }

      case "unwind": {
        // Velocity-limited approach: accelerate gently to at most ~60°/s, then
        // settle exponentially into the aligned orientation – never a snap.
        const remaining = this.unwindTarget - this.yaw;
        const desired = Math.min(UNWIND_MAX_SPEED, Math.abs(remaining) * 3.2);
        this.unwindSpeed += (desired - this.unwindSpeed) * Math.min(1, dt * 4);
        const move = Math.sign(remaining) * Math.min(Math.abs(remaining), this.unwindSpeed * dt);
        this.yaw += move;
        if (Math.abs(this.unwindTarget - this.yaw) < 0.0015) {
          this.yaw = 0;
          this.phase = "done";
          this.publish(true);
        }
        break;
      }
    }

    // Throttled HUD updates (~8 Hz) so React never re-renders per frame.
    this.publishAccumulator += dt;
    if (this.publishAccumulator >= 0.125) {
      this.publishAccumulator = 0;
      this.publish(false);
    }
    return this.animating;
  }

  private phaseProgress(): number {
    switch (this.phase) {
      case "hold":
        return this.t / LIFT_TIMING.hold;
      case "ascending":
        return smootherstep(this.t / LIFT_TIMING.ascend);
      case "settle":
        return this.t / LIFT_TIMING.settle;
      case "showcase":
        return this.yaw / TAU;
      case "drive-align":
        return smootherstep(this.t / LIFT_TIMING.driveAlign);
      case "unwind":
        return 1;
      case "done":
        return 1;
      default:
        return 0;
    }
  }

  private publish(force: boolean) {
    const next: LiftSnapshot = {
      phase: this.phase,
      progress: MathUtils.clamp(this.phaseProgress(), 0, 1),
      yawDeg: ((MathUtils.radToDeg(this.yaw) % 360) + 360) % 360,
      seq: this.seq,
    };
    const prev = this.snapshot;
    if (
      !force &&
      prev.phase === next.phase &&
      Math.abs(prev.progress - next.progress) < 0.004 &&
      Math.abs(prev.yawDeg - next.yawDeg) < 0.5
    ) {
      return;
    }
    this.snapshot = next;
    this.listeners.forEach((l) => l());
  }

  // ---- useSyncExternalStore plumbing
  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
}

export const liftTimeline = new LiftTimeline();

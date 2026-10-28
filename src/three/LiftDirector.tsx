import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef } from "react";
import { LIFT_TIMING, liftTimeline } from "./liftTimeline";
import { playLiftServoSound, stopLiftServoSound } from "./raceAudio";
import { markShadowsDirty } from "./sceneMotion";

interface LiftDirectorProps {
  /** Incremented every time a vehicle asset finishes loading → replays the entrance. */
  entranceSeq: number;
  /** The lift remains parked until the user activates the Lift the Car button. */
  startAllowed: boolean;
  /** Called once the elevator has slowly aligned the car with the garage exit. */
  onDriveAlignmentComplete?: () => void;
}

export function LiftDirector({ entranceSeq, startAllowed, onDriveAlignmentComplete }: LiftDirectorProps) {
  const invalidate = useThree((s) => s.invalidate);
  const resumed = useRef(false);
  const soundPhase = useRef<"ascending" | "showcase" | null>(null);

  useLayoutEffect(() => {
    if (entranceSeq > 0) {
      liftTimeline.begin(entranceSeq);
      markShadowsDirty();
      invalidate();
    }
  }, [entranceSeq, invalidate]);

  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden) {
        resumed.current = true;
        invalidate();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [invalidate]);

  useEffect(() => {
    if (startAllowed) invalidate();
  }, [startAllowed, invalidate]);

  // Update before all scene consumers. Resolution stays fixed throughout motion.
  useFrame((_, delta) => {
    if (document.hidden || !startAllowed) return;
    const wasMoving = liftTimeline.animating;
    const wasDriveAligning = liftTimeline.phase === "drive-align";
    const moving = liftTimeline.step(resumed.current ? 0 : delta);
    if (wasDriveAligning && liftTimeline.phase === "done") onDriveAlignmentComplete?.();
    if (liftTimeline.phase === "ascending" && soundPhase.current !== "ascending") {
      const remaining = Math.max(0.7, LIFT_TIMING.ascend - liftTimeline.elapsed);
      if (playLiftServoSound(remaining, "ascend")) soundPhase.current = "ascending";
    } else if (liftTimeline.phase === "showcase" && soundPhase.current !== "showcase") {
      stopLiftServoSound();
      const remaining = Math.max(0.7, LIFT_TIMING.showcase - liftTimeline.elapsed);
      soundPhase.current = playLiftServoSound(remaining, "showcase") ? "showcase" : null;
    } else if (liftTimeline.phase !== "ascending" && liftTimeline.phase !== "showcase" && soundPhase.current) {
      stopLiftServoSound();
      soundPhase.current = null;
    }
    resumed.current = false;
    if (wasMoving) markShadowsDirty();
    if (moving) invalidate();
  }, -20);

  return null;
}

import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils, PerspectiveCamera, Spherical, Vector3 } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { responsiveCameraGoal, type CameraGoal } from "./cameraFraming";
import { LIFT_TIMING } from "./liftTimeline";
import { sceneMotion } from "./sceneMotion";

interface CameraRigProps {
  goal: CameraGoal;
  autoOrbit: boolean;
  onUserInteract: () => void;
}

export const CameraRig = memo(function CameraRig({ goal, autoOrbit, onUserInteract }: CameraRigProps) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const size = useThree((state) => state.size);
  const set = useThree((state) => state.set);
  const get = useThree((state) => state.get);
  const controls = useMemo(() => new OrbitControls(camera), [camera]);
  const destination = useMemo(
    () => responsiveCameraGoal(goal, size.width / Math.max(size.height, 1)),
    [goal, size.width, size.height],
  );
  const goalPosition = useMemo(() => new Vector3(...destination.position), [destination]);
  const goalTarget = useMemo(() => new Vector3(...destination.target), [destination]);
  const interact = useRef(onUserInteract);
  interact.current = onUserInteract;
  const initialized = useRef(false);
  const transition = useRef({
    active: false,
    time: 0,
    fromPosition: new Vector3(),
    fromTarget: new Vector3(),
    fromSphere: new Spherical(),
    toSphere: new Spherical(),
    fromFov: 40,
    arc: true,
  });
  const tempPosition = useMemo(() => new Vector3(), []);
  const tempTarget = useMemo(() => new Vector3(), []);
  const tempSphere = useMemo(() => new Spherical(), []);

  useEffect(() => {
    controls.connect(gl.domElement);
    const previous = get().controls;
    set({ controls });
    const change = () => invalidate();
    const start = () => {
      transition.current.active = false;
      interact.current();
      invalidate();
    };
    controls.addEventListener("change", change);
    controls.addEventListener("start", start);
    return () => {
      controls.removeEventListener("change", change);
      controls.removeEventListener("start", start);
      controls.dispose();
      set({ controls: previous });
    };
  }, [camera, controls, gl, get, set, invalidate]);

  useLayoutEffect(() => {
    const motion = transition.current;
    // Clear residual drag velocity before a preset takes ownership of the camera.
    controls.enableDamping = false;
    controls.autoRotate = false;
    controls.update(0);
    motion.fromPosition.copy(camera.position);
    motion.fromTarget.copy(controls.target);
    motion.fromFov = camera.fov;
    motion.fromSphere.setFromVector3(camera.position.clone().sub(controls.target));
    motion.toSphere.setFromVector3(goalPosition.clone().sub(goalTarget));
    const turn =
      MathUtils.euclideanModulo(motion.toSphere.theta - motion.fromSphere.theta + Math.PI, Math.PI * 2) -
      Math.PI;
    motion.toSphere.theta = motion.fromSphere.theta + turn;
    motion.arc = !destination.interior && motion.fromSphere.radius > 2 && motion.toSphere.radius > 2;
    motion.time = 0;
    motion.active = initialized.current;
    sceneMotion.cameraMoving = motion.active;
    if (!initialized.current) {
      camera.position.copy(goalPosition);
      controls.target.copy(goalTarget);
      camera.fov = destination.fov;
      camera.updateProjectionMatrix();
      controls.update(0);
      initialized.current = true;
    }
    invalidate();
  }, [destination, goalPosition, goalTarget, camera, controls, invalidate]);

  useEffect(() => {
    invalidate();
  }, [autoOrbit, invalidate]);

  useFrame((_, rawDelta) => {
    if (document.hidden) return;
    const dt = Math.min(rawDelta, 0.08);
    const motion = transition.current;
    controls.minDistance = destination.interior ? 0.08 : destination.overview ? 3.8 : 0.65;
    controls.maxDistance = destination.interior ? 1.8 : 28;
    controls.minPolarAngle = destination.interior ? 0.2 : 0.001;
    controls.maxPolarAngle = destination.interior ? Math.PI * 0.78 : Math.PI * 0.49;
    controls.rotateSpeed = destination.interior ? 0.55 : 0.68;
    controls.zoomSpeed = 0.7;
    controls.panSpeed = 0.55;

    if (motion.active) {
      motion.time += dt;
      const t = Math.min(motion.time / 1.05, 1);
      const ease = t * t * t * (t * (t * 6 - 15) + 10);
      tempTarget.copy(motion.fromTarget).lerp(goalTarget, ease);
      if (motion.arc) {
        tempSphere.radius = MathUtils.lerp(motion.fromSphere.radius, motion.toSphere.radius, ease);
        tempSphere.phi = MathUtils.lerp(motion.fromSphere.phi, motion.toSphere.phi, ease);
        tempSphere.theta = MathUtils.lerp(motion.fromSphere.theta, motion.toSphere.theta, ease);
        tempPosition.setFromSpherical(tempSphere).add(tempTarget);
      } else {
        tempPosition.copy(motion.fromPosition).lerp(goalPosition, ease);
      }
      camera.position.copy(tempPosition);
      controls.target.copy(tempTarget);
      camera.fov = MathUtils.lerp(motion.fromFov, destination.fov, ease);
      camera.updateProjectionMatrix();
      controls.minDistance = 0.04;
      controls.maxDistance = 50;
      controls.enableDamping = false;
      controls.autoRotate = false;
      controls.update(0);
      motion.active = t < 1;
      sceneMotion.cameraMoving = motion.active;
      invalidate();
    } else {
      controls.enableDamping = true;
      controls.dampingFactor = 0.075;
      controls.autoRotate = autoOrbit && !destination.interior;
      controls.autoRotateSpeed = 60 / (LIFT_TIMING.showcase - LIFT_TIMING.ramp);
      sceneMotion.cameraMoving = controls.update(dt) || controls.autoRotate;
      if (sceneMotion.cameraMoving) invalidate();
    }
    camera.updateMatrixWorld();
  }, -2);

  return null;
});

import {
  ACESFilmicToneMapping,
  AmbientLight,
  DirectionalLight,
  DoubleSide,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  WebGLRenderer,
  SRGBColorSpace,
  Color,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CARS, PAINT_FINISHES } from "@/data/catalog";
import { classifyMesh, loadVehicleAsset } from "@/lib/gltf";

/**
 * Render the real, showroom-normalized GLBs once to card-sized stills. A single
 * temporary renderer is shared across the three cars, so lobby cards do not
 * create three persistent WebGL contexts or add a per-frame rendering cost.
 */
const thumbnailCache = new Map<string, string>();
const showroomFinish = PAINT_FINISHES[0];

export async function renderVehicleThumbnails(
  isCancelled: () => boolean,
  onThumbnail: (carId: string, dataUrl: string) => void,
) {
  const pendingCars = CARS.filter((car) => !thumbnailCache.has(car.id));
  for (const car of CARS) {
    const cached = thumbnailCache.get(car.id);
    if (cached) onThumbnail(car.id, cached);
  }
  if (pendingCars.length === 0 || isCancelled()) return;

  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 320;

  let renderer: WebGLRenderer | null = null;
  let pmrem: PMREMGenerator | null = null;
  let environment: ReturnType<PMREMGenerator["fromScene"]> | null = null;
  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(1);
    renderer.setSize(canvas.width, canvas.height, false);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    const scene = new Scene();
    scene.background = null;
    const camera = new PerspectiveCamera(40, canvas.width / canvas.height, 0.08, 40);
    // Match the showroom's three-quarter hero view and eye line.
    camera.position.set(-3.35, 1.82, -3.8);
    camera.lookAt(0, 0.48, 0.05);

    pmrem = new PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    environment = pmrem.fromScene(room, 0.04);
    room.dispose();
    scene.environment = environment.texture;

    scene.add(new AmbientLight(new Color("#dbe6ff"), 0.8));
    const key = new DirectionalLight("#fff2dd", 2.3);
    key.position.set(-4, 7, -5);
    scene.add(key);
    const fill = new DirectionalLight("#b9d9ff", 1.25);
    fill.position.set(5, 3.5, -1);
    scene.add(fill);
    const rim = new DirectionalLight("#ffffff", 1.8);
    rim.position.set(0, 4, 6);
    scene.add(rim);

    const floorMaterial = new MeshStandardMaterial({ color: "#11151c", metalness: 0.28, roughness: 0.46 });
    const floor = new Mesh(new PlaneGeometry(24, 24), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.018;
    scene.add(floor);

    for (const car of pendingCars) {
      if (isCancelled()) break;
      const asset = await loadVehicleAsset(null, null, car, { accelerateRaycast: false });
      if (isCancelled()) break;
      const model = asset.gltf.scene;
      const previewMaterials: (MeshStandardMaterial | MeshPhysicalMaterial)[] = [];
      model.traverse((node: any) => {
        if (!node.isMesh) return;
        const sourceMaterials = Array.isArray(node.material) ? node.material : [node.material];
        const preview = sourceMaterials.map((material: any) => {
          const materialName = `${node.name} ${material?.name ?? ""}`.toLowerCase();
          const isBodyPaint = (classifyMesh(node) === "paintwork" || /body|paint/.test(materialName))
            && !/glass|window|windshield|shield|emblem|badge|interior|trim|latch/.test(materialName);
          const clone = isBodyPaint
            ? new MeshPhysicalMaterial({
                name: `Lobby_${car.id}_Showroom_Paint`,
                color: car.defaultPaintHex,
                metalness: showroomFinish.metalness,
                roughness: showroomFinish.roughness,
                clearcoat: showroomFinish.clearcoat,
                clearcoatRoughness: showroomFinish.clearcoatRoughness,
                envMapIntensity: 1.45,
                side: DoubleSide,
              })
            : material.clone();
          clone.envMapIntensity = Math.max(clone.envMapIntensity ?? 1, 1.15);
          previewMaterials.push(clone);
          return clone;
        });
        node.material = Array.isArray(node.material) ? preview : preview[0];
      });
      scene.add(model);
      renderer.render(scene, camera);
      let dataUrl = canvas.toDataURL("image/webp", 0.9);
      if (!dataUrl.startsWith("data:image/webp")) dataUrl = canvas.toDataURL("image/png");
      thumbnailCache.set(car.id, dataUrl);
      onThumbnail(car.id, dataUrl);
      scene.remove(model);
      previewMaterials.forEach((material) => material.dispose());
    }

    scene.remove(floor);
    floor.geometry.dispose();
    floorMaterial.dispose();
  } finally {
    environment?.texture.dispose();
    pmrem?.dispose();
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
}

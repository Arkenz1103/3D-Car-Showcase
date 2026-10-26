// @ts-nocheck
/**
 * Canvas generated textures for the racing mode.
 *
 * Every texture here is authored once and shared by all users of the material
 * (road, gantry banners, checkpoint gates, street lamps, nitro flame), so the
 * circuit needs a handful of textures instead of one per fixture.
 */
import { CanvasTexture, ClampToEdgeWrapping, RepeatWrapping, SRGBColorSpace } from "three";

const FONT_DISPLAY = '"Arial Black", "Segoe UI", Impact, sans-serif';
const FONT_MONO = '"JetBrains Mono", "Consolas", monospace';

function finish(texture: CanvasTexture, repeatX = 1, repeatY = 1) {
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  return { canvas, context };
}

/**
 * Weathered night asphalt: a dark base, aggregate speckle and a couple of
 * tar-seam streaks. The companion roughness map adds variation so the clearcoat
 * reflections of the car do not slide over a perfectly flat surface.
 */
export function makeAsphaltTextures() {
  const size = 512;
  const { canvas, context } = makeCanvas(size, size);
  context.fillStyle = "#3f434a";
  context.fillRect(0, 0, size, size);

  for (let i = 0; i < 140; i++) {
    const radius = 24 + Math.random() * 70;
    context.fillStyle = `rgba(${18 + Math.random() * 40},${20 + Math.random() * 40},${24 + Math.random() * 44},0.35)`;
    context.beginPath();
    context.arc(Math.random() * size, Math.random() * size, radius, 0, Math.PI * 2);
    context.fill();
  }
  for (let i = 0; i < 9000; i++) {
    const shade = 60 + Math.random() * 120;
    context.fillStyle = `rgba(${shade},${shade + 4},${shade + 8},${0.12 + Math.random() * 0.34})`;
    const r = 0.6 + Math.random() * 1.8;
    context.fillRect(Math.random() * size, Math.random() * size, r, r);
  }
  context.strokeStyle = "rgba(14,15,18,0.5)";
  context.lineWidth = 1.6;
  for (let i = 0; i < 8; i++) {
    context.beginPath();
    let x = Math.random() * size;
    let y = Math.random() * size;
    context.moveTo(x, y);
    for (let segment = 0; segment < 5; segment++) {
      x += (Math.random() - 0.5) * 70;
      y += (Math.random() - 0.5) * 70;
      context.lineTo(x, y);
    }
    context.stroke();
  }
  const map = finish(new CanvasTexture(canvas));

  const rough = makeCanvas(256, 256);
  rough.context.fillStyle = "#e8e8e8";
  rough.context.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) {
    const value = 120 + Math.random() * 120;
    rough.context.fillStyle = `rgba(${value},${value},${value},0.5)`;
    rough.context.beginPath();
    rough.context.arc(Math.random() * 256, Math.random() * 256, 8 + Math.random() * 46, 0, Math.PI * 2);
    rough.context.fill();
  }
  const roughnessMap = finish(new CanvasTexture(rough.canvas));

  return { map, roughnessMap };
}

/** Ground plate that surrounds the circuit, tiled far more aggressively. */
export function makeGroundTexture() {
  const size = 256;
  const { canvas, context } = makeCanvas(size, size);
  context.fillStyle = "#22252b";
  context.fillRect(0, 0, size, size);
  for (let i = 0; i < 2200; i++) {
    const shade = 26 + Math.random() * 60;
    context.fillStyle = `rgba(${shade},${shade + 3},${shade + 6},0.5)`;
    context.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  return finish(new CanvasTexture(canvas), 1, 1);
}

/** Classic chequered flag pattern used for the start line and finish gantry. */
export function makeChequerTexture() {
  const cell = 32;
  const columns = 12;
  const rows = 2;
  const { canvas, context } = makeCanvas(columns * cell, rows * cell);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      context.fillStyle = (x + y) % 2 === 0 ? "#f4f6f8" : "#101215";
      context.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  return finish(new CanvasTexture(canvas));
}

/** Illuminated gantry / checkpoint banner: accent frame, headline and caption. */
export function makeSignTexture(headline: string, caption: string, accent: string) {
  const width = 768;
  const height = 192;
  const { canvas, context } = makeCanvas(width, height);
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "rgba(8,10,14,0.96)");
  gradient.addColorStop(1, "rgba(16,20,28,0.96)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = accent;
  context.lineWidth = 10;
  context.strokeRect(5, 5, width - 10, height - 10);

  context.textAlign = "center";
  if ("letterSpacing" in context) context.letterSpacing = "6px";
  context.fillStyle = "#ffffff";
  context.font = `700 76px ${FONT_DISPLAY}`;
  context.fillText(headline, width / 2, 96);
  context.fillStyle = accent;
  context.font = `600 30px ${FONT_MONO}`;
  context.fillText(caption, width / 2, 152);
  return finish(new CanvasTexture(canvas));
}

/** Soft radial falloff used for lamp halos and additive light sprays. */
export function makeGlowTexture() {
  const size = 128;
  const { canvas, context } = makeCanvas(size, size);
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,247,225,1)");
  gradient.addColorStop(0.24, "rgba(255,236,190,0.55)");
  gradient.addColorStop(0.6, "rgba(255,224,160,0.14)");
  gradient.addColorStop(1, "rgba(255,214,140,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return finish(new CanvasTexture(canvas));
}

/** Nitro plume: a hot blue flame cone with a bright core. */
export function makePlumeTexture() {
  const width = 128;
  const height = 256;
  const { canvas, context } = makeCanvas(width, height);
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.18, "rgba(150,220,255,0.85)");
  gradient.addColorStop(0.5, "rgba(64,140,255,0.42)");
  gradient.addColorStop(1, "rgba(24,44,120,0)");
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(width * 0.5, 0);
  context.lineTo(width * 0.92, height * 0.42);
  context.lineTo(width * 0.5, height);
  context.lineTo(width * 0.08, height * 0.42);
  context.closePath();
  context.fill();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

/** Vertical night sky gradient painted onto the backdrop dome. */
export function makeSkyTexture() {
  const { canvas, context } = makeCanvas(32, 512);
  const gradient = context.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, "#02030a");
  gradient.addColorStop(0.42, "#070d1e");
  gradient.addColorStop(0.62, "#152341");
  gradient.addColorStop(0.72, "#2b3c5c");
  gradient.addColorStop(0.8, "#0b1120");
  gradient.addColorStop(1, "#05060a");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 32, 512);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

/** Bright midday sky for the Day preset: azure zenith into a hazy horizon. */
export function makeDaySkyTexture() {
  const { canvas, context } = makeCanvas(32, 512);
  const gradient = context.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, "#1d4fa8");
  gradient.addColorStop(0.4, "#4a8ede");
  gradient.addColorStop(0.62, "#9dc6f0");
  gradient.addColorStop(0.72, "#d8e6f2");
  gradient.addColorStop(0.8, "#8b98a6");
  gradient.addColorStop(1, "#4a525c");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 32, 512);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

/** Overcast storm dome for the Rain preset — flat, wet, no stars. */
export function makeStormSkyTexture() {
  const { canvas, context } = makeCanvas(32, 512);
  const gradient = context.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, "#0a0f18");
  gradient.addColorStop(0.44, "#1b2431");
  gradient.addColorStop(0.66, "#2c3846");
  gradient.addColorStop(0.74, "#3a4753");
  gradient.addColorStop(0.84, "#1b2129");
  gradient.addColorStop(1, "#0c1016");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 32, 512);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

/** Vertical raindrop streak used by the rain point cloud. */
export function makeRainStreakTexture() {
  const width = 32;
  const height = 128;
  const { canvas, context } = makeCanvas(width, height);
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "rgba(190,220,255,0)");
  gradient.addColorStop(0.4, "rgba(205,230,255,0.55)");
  gradient.addColorStop(0.85, "rgba(225,240,255,0.85)");
  gradient.addColorStop(1, "rgba(190,220,255,0)");
  context.fillStyle = gradient;
  context.fillRect(width * 0.36, 0, width * 0.28, height);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

export function disposeTextures(textures: { dispose?: () => void }[]) {
  for (const texture of textures) texture?.dispose?.();
}

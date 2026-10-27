import { Color } from "three";

export interface NeonPalette {
  underglow: string;
  interior: string;
}

const PALETTES: Record<string, NeonPalette> = {
  red: { underglow: "#FF2BD6", interior: "#B6A3FF" },
  yellow: { underglow: "#FFB52E", interior: "#B8F2FF" },
  blue: { underglow: "#27D8FF", interior: "#B8F4FF" },
  neutral: { underglow: "#C83DFF", interior: "#E8C0FF" },
};

/** Pick practical accent colors from the active coachwork color. This only runs
 * when paint changes; no color parsing or allocation occurs in the frame loop. */
export function getNeonPalette(bodyHex = "#CE1318"): NeonPalette {
  const body = new Color(bodyHex);
  const hsl = { h: 0, s: 0, l: 0 };
  body.getHSL(hsl);

  // Black, silver and white have little saturation in HSL, so keep them in
  // the ultraviolet family without misclassifying deep, saturated blue paint.
  if (hsl.s < 0.16) return PALETTES.neutral;
  if (hsl.h < 0.055 || hsl.h > 0.94) return PALETTES.red;
  if (hsl.h >= 0.08 && hsl.h <= 0.19) return PALETTES.yellow;
  if (hsl.h >= 0.53 && hsl.h <= 0.74) return PALETTES.blue;

  // Unmapped colors get a vivid complementary hue, with a softer same-hue
  // cabin tint so the interior and underbody stay coordinated.
  const complementary = new Color().setHSL((hsl.h + 0.5) % 1, 0.88, 0.58);
  const interior = new Color().setHSL((hsl.h + 0.5) % 1, 0.5, 0.78);
  return {
    underglow: `#${complementary.getHexString()}`,
    interior: `#${interior.getHexString()}`,
  };
}

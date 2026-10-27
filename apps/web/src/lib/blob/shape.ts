import type { BOT_BODIES } from "@sirathic/server/projects";

const SAMPLES = 64;
const ANGLES = Array.from({ length: SAMPLES }, (_, index) => (index / SAMPLES) * Math.PI * 2);

export type Point = { x: number; y: number };
export type Silhouette = { radii: readonly number[]; rot: number; cx: number; cy: number };

export const clamp = (value: number) => Math.min(1, Math.max(0, value));
export const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
export const rounded = (value: number) => Math.round(value * 100) / 100;

export const circle = (radius: number, pose: Partial<Silhouette> = {}): Silhouette => ({
  radii: ANGLES.map(() => radius),
  rot: 0,
  cx: 0,
  cy: 0,
  ...pose,
});

export const blend = (from: Silhouette, to: Silhouette, t: number): Silhouette => {
  const turn = Math.atan2(Math.sin(to.rot - from.rot), Math.cos(to.rot - from.rot));
  return {
    radii: from.radii.map((radius, index) => lerp(radius, to.radii[index], t)),
    rot: from.rot + turn * t,
    cx: lerp(from.cx, to.cx, t),
    cy: lerp(from.cy, to.cy, t),
  };
};

export const pathOf = ({ radii, rot, cx, cy }: Silhouette, scale: number) => {
  const points = radii.map((radius, index) => ({
    x: (radius * Math.cos(ANGLES[index] + rot) + cx) * scale,
    y: (radius * Math.sin(ANGLES[index] + rot) + cy) * scale,
  }));
  const at = (index: number) => points[(index + SAMPLES) % SAMPLES];
  const curves = points.map((p1, index) => {
    const p0 = at(index - 1);
    const p2 = at(index + 1);
    const p3 = at(index + 2);
    return `C${rounded(p1.x + (p2.x - p0.x) / 6)} ${rounded(p1.y + (p2.y - p0.y) / 6)} ${rounded(p2.x - (p3.x - p1.x) / 6)} ${rounded(p2.y - (p3.y - p1.y) / 6)} ${rounded(p2.x)} ${rounded(p2.y)}`;
  });
  return `M${rounded(points[0].x)} ${rounded(points[0].y)}${curves.join("")}Z`;
};

export const radiusAt = (radii: readonly number[], angle: number) => {
  const turns = ((angle / (Math.PI * 2)) % 1) + 1;
  const position = (turns % 1) * SAMPLES;
  const index = Math.floor(position);
  return lerp(radii[index % SAMPLES], radii[(index + 1) % SAMPLES], position - index);
};

export const polyPath = (points: readonly Point[]) =>
  `${points.map(({ x, y }, index) => `${index === 0 ? "M" : "L"}${rounded(x)} ${rounded(y)}`).join("")}Z`;

export const hullOfCircles = (
  [x1, y1, r1]: readonly [number, number, number],
  [x2, y2, r2]: readonly [number, number, number],
) => {
  const base = Math.atan2(y2 - y1, x2 - x1);
  const spread = Math.acos(Math.min(1, Math.max(-1, (r1 - r2) / Math.hypot(x2 - x1, y2 - y1))));
  const steps = Array.from({ length: 49 }, (_, index) => index / 48);
  return [
    ...steps.map((k) => {
      const angle = base + spread + (Math.PI * 2 - 2 * spread) * k;
      return { x: x1 + Math.cos(angle) * r1, y: y1 + Math.sin(angle) * r1 };
    }),
    ...steps.map((k) => {
      const angle = base - spread + 2 * spread * k;
      return { x: x2 + Math.cos(angle) * r2, y: y2 + Math.sin(angle) * r2 };
    }),
  ];
};

export const profileOf = (polygon: readonly Point[]) =>
  ANGLES.map((angle) => {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    return polygon.reduce((best, a, index) => {
      const b = polygon[(index + 1) % polygon.length];
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) return best;
      const along = (a.x * ey - a.y * ex) / den;
      const across = (a.x * dy - a.y * dx) / den;
      return along > best && across >= 0 && across <= 1 ? along : best;
    }, 0);
  });

const peaked = (radii: readonly number[], peak: number) => {
  const max = Math.max(...radii);
  return radii.map((radius) => (radius * peak) / max);
};

const roundedPolygon = (sides: number, radius: number, corner: number, turnDegrees: number) =>
  profileOf(
    Array.from(
      { length: sides },
      (_, side) => (turnDegrees * Math.PI) / 180 + (side / sides) * Math.PI * 2,
    ).flatMap((angle) => {
      const x = Math.cos(angle) * (radius - corner);
      const y = Math.sin(angle) * (radius - corner);
      return Array.from({ length: 11 }, (_, step) => {
        const turn = angle - Math.PI / sides + ((2 * Math.PI) / sides) * (step / 10);
        return { x: x + Math.cos(turn) * corner, y: y + Math.sin(turn) * corner };
      });
    }),
  );

const cloud = ANGLES.map((angle) => {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  return [
    [-0.44, 0.2, 0.54],
    [0.46, 0.2, 0.5],
    [0.02, 0.3, 0.6],
    [-0.24, -0.3, 0.48],
    [0.3, -0.24, 0.44],
  ].reduce((best, [x, y, r]) => {
    const b = dx * x + dy * y;
    const disc = b * b - (x * x + y * y - r * r);
    return disc < 0 ? best : Math.max(best, b + Math.sqrt(disc));
  }, 0);
});

export const BODIES = {
  circle: circle(1).radii,
  pebble: peaked(
    ANGLES.map(
      (angle) => 1 + 0.075 * Math.cos(2 * angle + 0.5) + 0.035 * Math.cos(3 * angle + 2.1),
    ),
    1.02,
  ),
  squircle: peaked(
    ANGLES.map(
      (angle) =>
        (Math.abs(Math.cos(angle)) ** 4.2 + Math.abs(Math.sin(angle)) ** 4.2) ** (-1 / 4.2),
    ),
    1.15,
  ),
  capsule: profileOf(hullOfCircles([-0.42, 0, 0.62], [0.42, 0, 0.62])),
  triangle: roundedPolygon(3, 1.12, 0.34, -90),
  hexagon: roundedPolygon(6, 1.04, 0.26, 0),
  cloud: peaked(cloud, 1.02),
  drop: peaked(profileOf(hullOfCircles([0, 0.28, 0.66], [0, -0.96, 0.05])), 1.04),
} satisfies Record<(typeof BOT_BODIES)[number], readonly number[]>;

const SEEDED = Object.values(BODIES);

export const bodyOf = (chosen: string | null, seed: string) =>
  Object.entries(BODIES).find(([name]) => name === chosen)?.[1] ??
  SEEDED[
    [...seed].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7) % SEEDED.length
  ];

import { EGG, HEXAGON, TRIANGLE } from "@/lib/blob/profiles";
import {
  circle,
  clamp,
  hullOfCircles,
  polyPath,
  profileOf,
  rounded,
  type Silhouette,
} from "@/lib/blob/shape";

const TAU = Math.PI * 2;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutQuint = (t: number) => 1 - (1 - t) ** 5;

const randomFrom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const hueColor = (hue: number) => {
  const h = ((hue % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * 0.62 - 1)) * 0.55;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const sextant = Math.floor(h / 60);
  const [r, g, b] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][sextant];
  const hex = (value: number) =>
    Math.round((value + 0.62 - c / 2) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
};

const ringRandom = randomFrom(0xa11ce);
const RINGS = Array.from({ length: 6 }, (_, index) => ({
  a: 1.3 + ringRandom() * 0.1,
  k: 0.05 + ringRandom() * 0.4,
  tilt: (index / 6) * Math.PI + ringRandom() * 0.5,
  speed: 3 + ringRandom() * 0.7,
  phase: ringRandom() * TAU,
  sweep: 0.6 + ringRandom() * 0.25,
  hue: (index * 360) / 6 + ringRandom() * 30,
  hueSpan: 60 + ringRandom() * 60,
  width: 0.05 + ringRandom() * 0.012,
  cx: 0,
  cy: 0.1,
}));

type Ring = (typeof RINGS)[number];

const SWOOSH: Ring[] = [0, 1, 2, 3].map((index) => ({
  a: 0.78 + index * 0.2,
  k: 0.05 + index * 0.02,
  tilt: -0.62 + index * 0.05,
  speed: 0.3,
  phase: 0.06 * index,
  sweep: 0.4,
  hue: 95 + index * 62,
  hueSpan: 100,
  width: 0.05,
  cx: 0,
  cy: -0.12,
}));

const cometRandom = randomFrom(0xc0e7);
const COMET: Ring[] = [0, 1, 2, 3].map((index) => {
  const d = index - 1.5;
  return {
    a: 0.85 * (1 + d * 0.03),
    k: (0.15 / 0.85) * (1 + d * 0.16),
    tilt: (34 * Math.PI) / 180 + d * 0.035,
    speed: 210 / 360,
    phase: -index * 0.045 + cometRandom() * 0.012,
    sweep: 0.34,
    hue: index * 85 + cometRandom() * 20,
    hueSpan: 80,
    width: 0.095,
    cx: 0,
    cy: 0,
  };
});

type Arc = { id: string; ring: Ring; t: number; opacity: number };

export const arcFrame = ({ id, ring, t, opacity }: Arc, scale: number) => {
  const spin = ring.phase + t * ring.speed * TAU;
  const cu = Math.cos(ring.tilt);
  const su = Math.sin(ring.tilt);
  const kz = Math.sqrt(Math.max(0, 1 - ring.k * ring.k));
  const sides = { front: "", back: "" };
  let wasBehind: boolean | null = null;
  for (let step = 0; step <= 64; step++) {
    const angle = spin + (step / 64) * ring.sweep * TAU;
    const x = ring.a * (Math.cos(angle) * cu - Math.sin(angle) * su * ring.k) + ring.cx;
    const y = ring.a * (Math.cos(angle) * su + Math.sin(angle) * cu * ring.k) + ring.cy;
    const behind = Math.sin(angle) * kz < 0;
    const side = behind ? "back" : "front";
    sides[side] += `${behind === wasBehind ? "L" : "M"}${rounded(x * scale)} ${rounded(y * scale)}`;
    wasBehind = behind;
  }
  const gx = cu * ring.a * scale;
  const gy = su * ring.a * scale;
  return {
    id,
    ...sides,
    width: ring.width * scale,
    opacity,
    from: { x: rounded(ring.cx * scale - gx), y: rounded(ring.cy * scale - gy) },
    to: { x: rounded(ring.cx * scale + gx), y: rounded(ring.cy * scale + gy) },
    stops: [ring.hue, ring.hue + ring.hueSpan / 2, ring.hue + ring.hueSpan].map(hueColor),
  };
};

const particleRandom = randomFrom(0xbeef);
const PARTICLES = Array.from({ length: 5 }, (_, index) => ({
  birth: index * 0.2,
  angle: particleRandom() * TAU,
  rho: 0.58 + particleRandom() * 0.18,
}));

type Dot = { x: number; y: number; r: number; opacity: number; d?: string; rot?: number };

const particles = (t: number) =>
  PARTICLES.flatMap<Dot>(({ birth, angle, rho }) => {
    const age = t - birth;
    if (age < 0 || age > 0.62) return [];
    const reach = rho * 0.75 ** (age * 10);
    const turn = angle + (age * 100 * Math.PI) / 180;
    return [
      {
        x: Math.cos(turn) * reach,
        y: Math.sin(turn) * reach,
        r: 0.04 + 0.028 * clamp(age / 0.55),
        opacity: clamp(age / 0.06) * clamp((0.62 - age) / 0.08) * clamp(1 - reach / 0.8),
      },
    ];
  });

export type Pose = {
  sil: Silhouette;
  mark: number;
  dots: Dot[];
  arcs: Arc[];
  notif: { x: number; y: number; r: number; notch: number } | null;
  dotsBehind: boolean;
};

const pose = (over: Partial<Pose>): Pose => ({
  sil: circle(1),
  mark: 1,
  dots: [],
  arcs: [],
  notif: null,
  dotsBehind: false,
  ...over,
});

const outline = (radii: readonly number[], over: Partial<Silhouette> = {}) => ({
  ...circle(1),
  radii,
  ...over,
});

const triangle = (rot: number) =>
  outline(TRIANGLE, { rot, cx: -0.213 * Math.sin(rot), cy: 0.213 * Math.cos(rot) });

const DOT_X = [-0.557, -0.013, 0.532];
const DOT_R = 0.165;
const pulse = (t: number, index: number) => {
  const phase = ((((t - index * 0.5) / 1.5) % 1) + 1) % 1;
  return clamp((phase < 0.5 ? 0.5 - 0.5 * Math.cos(phase * TAU) : 0) * 2);
};

const ITALIC_BAR = profileOf(hullOfCircles([0, -0.2535, 0.1345], [0, 0.2535, 0.1345]));
const UPRIGHT_BAR = profileOf(hullOfCircles([0, -0.3175, 0.132], [0, 0.3175, 0.075]));
const TEAR = polyPath(hullOfCircles([0, 0, 0.118], [0, 0.172, 0.012]));
const NOTIF_ANGLE = (-42 * Math.PI) / 180;

export const POSES = {
  ready: (_: number, body: readonly number[]) => pose({ sil: outline(body) }),
  egg: () => pose({ sil: outline(EGG) }),
  hexagon: () => pose({ sil: outline(HEXAGON) }),
  opening: (t: number, body: readonly number[]) =>
    pose({
      sil: outline(body),
      arcs: RINGS.slice(0, 3).map((ring, index) => ({
        id: `o${index}`,
        ring,
        t,
        opacity: clamp((t - index * 0.06) / 0.14) * clamp((1.22 - t) / 0.34),
      })),
    }),
  thinking: (t: number) => {
    const emerge = 0.3 + 0.7 * easeOutCubic(clamp(t / 0.3));
    return pose({
      sil: circle(DOT_R * (1 + 0.25 * pulse(t, 1)), { cx: DOT_X[1] }),
      mark: 0,
      dots: [0, 2].map((index) => ({
        x: DOT_X[index] * emerge,
        y: 0,
        r: DOT_R * (1 + 0.25 * pulse(t, index)),
        opacity: 0.55 + 0.45 * pulse(t, index),
      })),
    });
  },
  searching: (t: number) => {
    const rot = -TAU * 1.25 * t * easeInOutCubic(clamp(t / 0.35));
    const back = easeInOutCubic(clamp((t - 1.6) / 0.9));
    const fade = clamp(t / 0.8) * clamp((3.6 - t) / 0.9);
    const from = triangle(rot);
    return pose({
      sil: {
        radii: from.radii.map((radius) => radius + (1 - radius) * back),
        rot,
        cx: from.cx * (1 - back),
        cy: from.cy * (1 - back),
      },
      arcs: RINGS.map((ring, index) => ({
        id: `r${index}`,
        ring,
        t,
        opacity: fade * clamp((t - index * 0.13) / 0.3),
      })),
    });
  },
  working: (t: number) =>
    pose({
      sil: triangle(0),
      arcs: SWOOSH.map((ring, index) => ({
        id: `s${index}`,
        ring: { ...ring, cx: 0.45 - t * 0.42 },
        t,
        opacity: clamp(t / 0.35) * clamp((2.2 - t) / 0.5),
      })),
    }),
  writing: (t: number) => {
    const collapse = 1 - 0.871 * easeOutQuint(clamp(t / 0.55));
    const regrow = easeOutQuint(clamp((t - 1.85) / 0.6));
    return pose({
      sil: circle(collapse + (1 - collapse) * regrow, {
        cy: Math.sin(clamp(t / 1.7) * Math.PI) * 0.035,
      }),
      mark: clamp((t - 2) / 0.35),
      arcs: COMET.map((ring, index) => ({
        id: `c${index}`,
        ring,
        t,
        opacity: clamp((t - 0.15) / 0.25) * clamp((1.95 - t) / 0.3),
      })),
    });
  },
  asking: (t: number, body: readonly number[]) => {
    const p = clamp(t / 0.45);
    const r = 0.15 * (p < 1 ? 1 + 0.14 * Math.sin(p * Math.PI) * (1 - p * 0.35) : 1);
    return pose({
      sil: outline(body),
      notif: {
        x: Math.cos(NOTIF_ANGLE) * 1.003,
        y: Math.sin(NOTIF_ANGLE) * 1.003,
        r,
        notch: r + 0.054,
      },
    });
  },
  done: (t: number) => {
    const collapse = 1 - 0.834 * easeOutQuint(clamp(t / 0.7));
    const regrow = easeOutQuint(clamp((t - 1.7) / 0.7));
    return pose({
      sil: circle(collapse + (1 - collapse) * regrow),
      mark: clamp((t - 1.85) / 0.4),
      dots: particles(t),
      dotsBehind: true,
    });
  },
  stopped: () =>
    pose({
      sil: outline(UPRIGHT_BAR, { cy: -0.1875 }),
      mark: 0,
      dots: [{ x: -0.012, y: 0.526, r: 0.113, opacity: 1 }],
    }),
  failed: (t: number) => {
    const travel = easeInOutCubic(clamp(t / 1.5)) * 0.82 - 0.087;
    const settle = clamp((t - 1.6) / 0.4);
    const x = travel * (1 - settle) + 0.1 * settle;
    const buzz = Math.sin(t * 2.5 * TAU) * 0.005;
    const tilt = (17.7 * Math.PI) / 180;
    return pose({
      sil: outline(ITALIC_BAR, { rot: tilt, cx: x, cy: -0.325 - buzz }),
      mark: 0,
      dots: [
        {
          x: x - Math.sin(tilt) * 0.58,
          y: -0.325 + Math.cos(tilt) * 0.58 + buzz * 2.8,
          r: 0.118,
          d: TEAR,
          rot: 17.7,
          opacity: 1,
        },
      ],
    });
  },
  paused: (t: number) =>
    pose({ sil: circle(0.1585, { cy: 0.11 + Math.sin(t * (TAU / 0.6)) * 0.19 }), mark: 0 }),
};

export type BlobState = keyof typeof POSES;

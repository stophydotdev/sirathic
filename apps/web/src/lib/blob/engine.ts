import { blend, clamp, lerp, pathOf, radiusAt, rounded } from "@/lib/blob/shape";
import { arcFrame, type BlobState, easeOutQuint, type Pose, POSES } from "@/lib/blob/states";

const SCALE = 100;

type Course =
  | { kind: "settles"; at: number }
  | { kind: "moves" }
  | { kind: "then"; state: BlobState; at: number };

const TIMING = {
  ready: { morph: 0.45, course: { kind: "settles", at: 0.45 } },
  egg: { morph: 0.4, course: { kind: "settles", at: 0.4 } },
  hexagon: { morph: 0.4, course: { kind: "settles", at: 0.4 } },
  opening: { morph: 0.3, course: { kind: "then", state: "ready", at: 1.3 } },
  thinking: { morph: 0.4, course: { kind: "moves" } },
  searching: { morph: 0.6, course: { kind: "then", state: "searching", at: 3.4 } },
  working: { morph: 0.5, course: { kind: "then", state: "working", at: 2.2 } },
  writing: { morph: 0.45, course: { kind: "then", state: "writing", at: 2.4 } },
  asking: { morph: 0.5, course: { kind: "settles", at: 0.5 } },
  done: { morph: 0.4, course: { kind: "then", state: "ready", at: 2.4 } },
  stopped: { morph: 0.45, course: { kind: "settles", at: 0.45 } },
  failed: { morph: 0.45, course: { kind: "settles", at: 2 } },
  paused: { morph: 0.5, course: { kind: "settles", at: 2.4 } },
} satisfies Record<BlobState, { morph: number; course: Course }>;

export const restingOf = (state: BlobState) => {
  const { course } = TIMING[state];
  return course.kind === "then" && course.state !== state ? course.state : state;
};

const SHINE = Array.from({ length: 13 }, (_, index) => ((-160 + index * 3.75) * Math.PI) / 180);

const shineOf = ({ sil, mark }: Pose) =>
  mark > 0.01
    ? {
        d: SHINE.map((angle, index) => {
          const reach = 0.7 * radiusAt(sil.radii, angle - sil.rot);
          const x = rounded((Math.cos(angle) * reach + sil.cx) * SCALE);
          const y = rounded((Math.sin(angle) * reach + sil.cy) * SCALE);
          return `${index === 0 ? "M" : "L"}${x} ${y}`;
        }).join(""),
        opacity: 0.85 * mark,
      }
    : null;

const blendPose = (from: Pose, to: Pose, t: number): Pose => ({
  sil: blend(from.sil, to.sil, t),
  mark: lerp(from.mark, to.mark, t),
  dots: [
    ...from.dots.map((dot) => ({ ...dot, opacity: dot.opacity * (1 - t) })),
    ...to.dots.map((dot) => ({ ...dot, opacity: dot.opacity * t })),
  ],
  arcs: [
    ...from.arcs.map((arc) => ({ ...arc, id: `a${arc.id}`, opacity: arc.opacity * (1 - t) })),
    ...to.arcs.map((arc) => ({ ...arc, id: `b${arc.id}`, opacity: arc.opacity * t })),
  ],
  notif: t < 0.5 ? from.notif : to.notif,
  dotsBehind: t < 0.5 ? from.dotsBehind : to.dotsBehind,
});

export const blobMotion = (body: readonly number[], initial: BlobState) => {
  let current = initial;
  let previous: { state: BlobState; since: number } | null = null;
  let frozen: Pose | null = null;
  let since = 0;

  const posed = (state: BlobState, t: number) => POSES[state](Math.max(0, t), body);

  const composed = (now: number) => {
    const pose = posed(current, now - since);
    const k = (now - since) / TIMING[current].morph;
    if (k >= 1) return pose;
    const origin = frozen ?? (previous && posed(previous.state, now - previous.since));
    return origin ? blendPose(origin, pose, easeOutQuint(clamp(k))) : pose;
  };

  const enter = (state: BlobState, now: number) => {
    frozen = previous && now - since < TIMING[current].morph ? composed(now) : null;
    previous = { state: current, since };
    current = state;
    since = now;
  };

  return {
    set: (state: BlobState, now: number) => {
      if (state !== current) enter(state, now);
    },
    still: (now: number) => {
      const { morph, course } = TIMING[current];
      return course.kind === "settles" && now - since >= Math.max(morph, course.at);
    },
    frame: (now: number) => {
      const { course } = TIMING[current];
      if (course.kind === "then" && now - since >= course.at) enter(course.state, now);
      const pose = composed(now);
      const fit = pose.notif
        ? radiusAt(pose.sil.radii, Math.atan2(pose.notif.y, pose.notif.x) - pose.sil.rot)
        : 1;
      return {
        body: pathOf(pose.sil, SCALE),
        shine: shineOf(pose),
        dotsBehind: pose.dotsBehind,
        dots: pose.dots
          .filter((dot) => dot.opacity > 0.01)
          .map(({ x, y, r, opacity, d, rot }) => ({
            x: x * SCALE,
            y: y * SCALE,
            r: r * SCALE,
            opacity,
            d,
            rot,
          })),
        arcs: pose.arcs.filter((arc) => arc.opacity > 0.01).map((arc) => arcFrame(arc, SCALE)),
        notif: pose.notif && {
          x: pose.notif.x * fit * SCALE,
          y: pose.notif.y * fit * SCALE,
          r: pose.notif.r * SCALE,
          notch: pose.notif.notch * SCALE,
        },
      };
    },
  };
};

export type BlobFrame = ReturnType<ReturnType<typeof blobMotion>["frame"]>;

import { type BlobFrame, blobMotion, restingOf } from "@sirathic/app/blob/engine";
import { bodyOf } from "@sirathic/app/blob/shape";
import type { BlobState } from "@sirathic/app/blob/states";
import type { BOT_COLORS } from "@sirathic/server/projects";
import { type FC, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "react-native-reanimated";
import Svg, { Circle, Defs, G, LinearGradient, Mask, Path, Rect, Stop } from "react-native-svg";
import { withUniwind } from "uniwind";

const Picture = withUniwind(Svg);

export const BOT_TINTS = {
  white: "accent-zinc-100",
  brown: "accent-[#8b5e3c]",
  red: "accent-red-500",
  orange: "accent-orange-500",
  yellow: "accent-amber-400",
  green: "accent-emerald-400",
  teal: "accent-teal-500",
  blue: "accent-blue-500",
  violet: "accent-violet-500",
  pink: "accent-pink-500",
  gray: "accent-neutral-400",
} as const satisfies Record<(typeof BOT_COLORS)[number], string>;

export const tintOf = (color: string | null) =>
  Object.entries(BOT_TINTS).find(([name]) => name === color)?.[1] ?? BOT_TINTS.teal;

const BUSY = new Set<BlobState>(["thinking", "searching", "working", "writing"]);

const SITE_CYCLE: readonly (readonly [BlobState, number])[] = [
  ["ready", 2.4],
  ["thinking", 2.6],
  ["ready", 3.4],
  ["failed", 2.4],
  ["asking", 2.2],
  ["stopped", 2],
  ["paused", 2.4],
  ["egg", 1.8],
  ["hexagon", 1.6],
  ["working", 2],
  ["searching", 3.4],
  ["done", 2.6],
  ["writing", 2.4],
];

const useBlob = (body: readonly number[], state: BlobState, start: number, still: boolean) => {
  const motion = useMemo(() => blobMotion(body, "ready"), [body]);
  const [frame, setFrame] = useState<BlobFrame>(() => motion.frame(0));
  const raf = useRef(0);
  const previous = useRef(state);

  const play = useCallback(
    (next: BlobState) => {
      cancelAnimationFrame(raf.current);
      if (still) {
        setFrame(blobMotion(body, restingOf(next)).frame(1));
        return;
      }
      const clock = () => performance.now() / 1000;
      motion.set(next, clock());
      const tick = () => {
        const now = clock();
        setFrame(motion.frame(now));
        if (!motion.still(now)) raf.current = requestAnimationFrame(tick);
      };
      tick();
    },
    [motion, body, still],
  );

  useEffect(() => {
    const finished = state === "ready" && BUSY.has(previous.current);
    previous.current = state;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf.current);
    };
    if (state !== "ready" || still) {
      play(finished ? "done" : state);
      return stop;
    }
    const run = (index: number) => {
      const [next, seconds] = SITE_CYCLE[index % SITE_CYCLE.length] ?? ["ready", 2];
      play(next);
      timer = setTimeout(() => run(index + 1), seconds * 1000);
    };
    if (finished) {
      play("done");
      timer = setTimeout(() => run(start), 2600);
    } else run(start);
    return stop;
  }, [play, state, start, still]);

  return frame;
};

const BOX = 160;

export const BotAvatar: FC<{
  color: string | null;
  body: string | null;
  seed: string;
  state?: BlobState;
  size: number;
}> = ({ color, body, seed, state = "ready", size }) => {
  const id = useId().replace(/\W/gu, "");
  const reduced = useReducedMotion();
  const frame = useBlob(
    useMemo(() => bodyOf(body, seed), [body, seed]),
    state,
    [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % SITE_CYCLE.length,
    reduced,
  );
  const area = { x: -BOX, y: -BOX, width: BOX * 2, height: BOX * 2 };
  const dots = frame.dots.map((dot, index) =>
    dot.d ? (
      <Path
        key={index}
        d={dot.d}
        fill="currentColor"
        opacity={dot.opacity}
        transform={`translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(100)`}
      />
    ) : (
      <Circle
        key={index}
        cx={dot.x}
        cy={dot.y}
        r={dot.r}
        fill="currentColor"
        opacity={dot.opacity}
      />
    ),
  );
  const rings = (side: "front" | "back") =>
    frame.arcs.map((arc) => (
      <Path
        key={arc.id}
        d={arc[side]}
        fill="none"
        strokeLinecap="round"
        stroke={`url(#${id}${arc.id})`}
        strokeWidth={arc.width}
        opacity={arc.opacity}
      />
    ));

  return (
    <Picture
      width={size}
      height={size}
      viewBox="-115 -115 230 230"
      colorClassName={tintOf(color)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <Mask id={`${id}body`} maskUnits="userSpaceOnUse" {...area}>
          <Path d={frame.body} fill="#fff" />
          {frame.notif && (
            <Circle cx={frame.notif.x} cy={frame.notif.y} r={frame.notif.notch} fill="#000" />
          )}
        </Mask>
        <Mask id={`${id}behind`} maskUnits="userSpaceOnUse" {...area}>
          <Rect {...area} fill="#fff" />
          <Path d={frame.body} fill="#000" />
        </Mask>
        {frame.arcs.map((arc) => (
          <LinearGradient
            key={arc.id}
            id={`${id}${arc.id}`}
            gradientUnits="userSpaceOnUse"
            x1={arc.from.x}
            y1={arc.from.y}
            x2={arc.to.x}
            y2={arc.to.y}
          >
            {arc.stops.map((stop, index) => (
              <Stop key={index} offset={index / (arc.stops.length - 1)} stopColor={stop} />
            ))}
          </LinearGradient>
        ))}
      </Defs>
      <G mask={`url(#${id}behind)`}>
        {rings("back")}
        {frame.dotsBehind && dots}
      </G>
      <G mask={`url(#${id}body)`}>
        <Rect {...area} fill="currentColor" />
        {frame.shine && (
          <Path
            d={frame.shine.d}
            fill="none"
            stroke="#fff"
            strokeWidth={13}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={frame.shine.opacity}
          />
        )}
      </G>
      {!frame.dotsBehind && dots}
      {frame.notif && (
        <Circle cx={frame.notif.x} cy={frame.notif.y} r={frame.notif.r} fill="#2496e8" />
      )}
      {rings("front")}
    </Picture>
  );
};

"use client";

import { type BlobFrame, blobMotion, restingOf } from "@sirathic/app/blob/engine";
import { bodyOf } from "@sirathic/app/blob/shape";
import type { BlobState } from "@sirathic/app/blob/states";
import { cn } from "@/lib/utils";
import type { BOT_COLORS } from "@sirathic/server/projects";
import { type FC, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

type BotColor = (typeof BOT_COLORS)[number];

export const BOT_TINTS = {
  white: { text: "text-zinc-100" },
  brown: { text: "text-[#8b5e3c]" },
  red: { text: "text-red-500" },
  orange: { text: "text-orange-500" },
  yellow: { text: "text-amber-400" },
  green: { text: "text-emerald-400" },
  teal: { text: "text-teal-500" },
  blue: { text: "text-blue-500" },
  violet: { text: "text-violet-500" },
  pink: { text: "text-pink-500" },
  gray: { text: "text-neutral-400" },
} as const satisfies Record<BotColor, { text: string }>;

export const tintOf = (color: string | null) =>
  Object.entries(BOT_TINTS).find(([name]) => name === color)?.[1] ?? BOT_TINTS.teal;

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

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

const useBlob = (body: readonly number[], state: BlobState, start: number) => {
  const motion = useMemo(() => blobMotion(body, "ready"), [body]);
  const [frame, setFrame] = useState<BlobFrame>(() => motion.frame(0));
  const raf = useRef(0);
  const previous = useRef(state);

  const play = useCallback(
    (next: BlobState) => {
      cancelAnimationFrame(raf.current);
      if (reduced()) {
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
    [motion, body],
  );

  useEffect(() => {
    const finished = state === "ready" && BUSY.has(previous.current);
    previous.current = state;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf.current);
    };
    if (state !== "ready" || reduced()) {
      play(finished ? "done" : state);
      return stop;
    }
    const run = (index: number) => {
      const [next, seconds] = SITE_CYCLE[index % SITE_CYCLE.length];
      play(next);
      timer = setTimeout(() => run(index + 1), seconds * 1000);
    };
    if (finished) {
      play("done");
      timer = setTimeout(() => run(start), 2600);
    } else run(start);
    return stop;
  }, [play, state, start]);

  return frame;
};

const BOX = 160;

export const BotAvatar: FC<{
  color: string | null;
  body: string | null;
  seed: string;
  state?: BlobState;
  className?: string;
}> = ({ color, body, seed, state = "ready", className }) => {
  const id = useId().replace(/\W/g, "");
  const frame = useBlob(
    bodyOf(body, seed),
    state,
    [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % SITE_CYCLE.length,
  );
  const area = { x: -BOX, y: -BOX, width: BOX * 2, height: BOX * 2 };
  const dots = frame.dots.map((dot, index) =>
    dot.d ? (
      <path
        key={index}
        d={dot.d}
        fill="currentColor"
        opacity={dot.opacity}
        transform={`translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(100)`}
      />
    ) : (
      <circle
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
      <path
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
    <svg
      aria-hidden
      viewBox="-115 -115 230 230"
      overflow="visible"
      className={cn("size-6 shrink-0", tintOf(color).text, className)}
    >
      <defs>
        <mask id={`${id}body`} maskUnits="userSpaceOnUse" {...area}>
          <path d={frame.body} fill="#fff" />
          {frame.notif && <circle cx={frame.notif.x} cy={frame.notif.y} r={frame.notif.notch} />}
        </mask>
        <mask id={`${id}behind`} maskUnits="userSpaceOnUse" {...area}>
          <rect {...area} fill="#fff" />
          <path d={frame.body} />
        </mask>
        {frame.arcs.map((arc) => (
          <linearGradient
            key={arc.id}
            id={`${id}${arc.id}`}
            gradientUnits="userSpaceOnUse"
            x1={arc.from.x}
            y1={arc.from.y}
            x2={arc.to.x}
            y2={arc.to.y}
          >
            {arc.stops.map((stop, index) => (
              <stop key={index} offset={index / (arc.stops.length - 1)} stopColor={stop} />
            ))}
          </linearGradient>
        ))}
      </defs>
      <g mask={`url(#${id}behind)`}>
        {rings("back")}
        {frame.dotsBehind && dots}
      </g>
      <g mask={`url(#${id}body)`}>
        <rect {...area} fill="currentColor" />
        {frame.shine && (
          <path
            d={frame.shine.d}
            fill="none"
            stroke="#fff"
            strokeWidth={13}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={frame.shine.opacity}
          />
        )}
      </g>
      {!frame.dotsBehind && dots}
      {frame.notif && (
        <circle cx={frame.notif.x} cy={frame.notif.y} r={frame.notif.r} fill="#2496e8" />
      )}
      {rings("front")}
    </svg>
  );
};

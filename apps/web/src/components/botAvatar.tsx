"use client";

import { type BlobFrame, blobMotion, restingOf } from "@sirathic/app/blob/engine";
import { bodyOf } from "@sirathic/app/blob/shape";
import type { BlobState } from "@sirathic/app/blob/states";
import { cn } from "@/lib/utils";
import type { BOT_COLORS } from "@sirathic/server/projects";
import { useReducedMotion } from "motion/react";
import { type FC, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

type BotColor = (typeof BOT_COLORS)[number];

export const BOT_TINTS = {
  white: { text: "text-zinc-100", bubble: "bg-foreground text-background" },
  brown: { text: "text-[#8b5e3c]", bubble: "bg-[#8b5e3c] text-white" },
  red: { text: "text-red-500", bubble: "bg-red-500 text-white" },
  orange: { text: "text-orange-500", bubble: "bg-orange-500 text-orange-950" },
  yellow: { text: "text-amber-400", bubble: "bg-amber-400 text-amber-950" },
  green: { text: "text-emerald-400", bubble: "bg-emerald-400 text-emerald-950" },
  teal: { text: "text-teal-500", bubble: "bg-teal-500 text-teal-950" },
  blue: { text: "text-blue-500", bubble: "bg-blue-500 text-white" },
  violet: { text: "text-violet-500", bubble: "bg-violet-500 text-white" },
  pink: { text: "text-pink-500", bubble: "bg-pink-500 text-white" },
  gray: { text: "text-neutral-400", bubble: "bg-neutral-400 text-neutral-950" },
} as const satisfies Record<BotColor, { text: string; bubble: string }>;

export const tintOf = (color: string | null) =>
  Object.entries(BOT_TINTS).find(([name]) => name === color)?.[1] ?? BOT_TINTS.teal;

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const BUSY = new Set<BlobState>(["thinking", "searching", "working", "writing"]);

const LOOKS = [
  [-1, 0, 1.4],
  [0, 0, 1.6],
  [1, 0.1, 1.2],
  [-0.7, -0.7, 0.9],
  [0, 0, 2.4],
  [0.8, 0.4, 1],
  [0, 0, 2.2],
] as const;
const TURN_SECONDS = 0.38;
const LOOK_SECONDS = LOOKS.reduce((sum, [, , seconds]) => sum + seconds, 0);
const LOOK_KEYS = LOOKS.flatMap(([x, y, seconds], index) => {
  const start = LOOKS.slice(0, index).reduce((sum, [, , held]) => sum + held, 0);
  return [
    { at: (start + TURN_SECONDS) / LOOK_SECONDS, x, y, spline: "0.65 0 0.35 1" },
    { at: (start + seconds) / LOOK_SECONDS, x, y, spline: "0 0 1 1" },
  ];
});

const track = (place: (x: number, y: number) => string) => ({
  values: [place(0, 0), ...LOOK_KEYS.map(({ x, y }) => place(x, y))].join(";"),
  keyTimes: [0, ...LOOK_KEYS.map(({ at }) => Math.min(1, Number(at.toFixed(4))))].join(";"),
  keySplines: LOOK_KEYS.map(({ spline }) => spline).join(";"),
  calcMode: "spline",
  repeatCount: "indefinite",
});

const SHADE_X = (x: number) => String(x * 55);
const SHADE_Y = (_: number, y: number) => String(y * 45 - 10);
const LEAN = (x: number, y: number) => `${x * 5} ${y * 3}`;
const GLEAM = (x: number, y: number) => `${x * 16} ${y * 10}`;

type Look = { kind: "roam"; seconds: number } | { kind: "fixed"; x: number; y: number };

const ROAM = { kind: "roam", seconds: LOOK_SECONDS } as const;
const SCAN = { kind: "roam", seconds: LOOK_SECONDS / 2 } as const;
const AHEAD = { kind: "fixed", x: 0, y: 0 } as const;
const DOWN = { kind: "fixed", x: 0, y: 0.85 } as const;

const LOOK_OF = {
  ready: ROAM,
  egg: ROAM,
  hexagon: ROAM,
  opening: ROAM,
  done: ROAM,
  thinking: SCAN,
  searching: SCAN,
  working: SCAN,
  writing: SCAN,
  asking: AHEAD,
  stopped: AHEAD,
  failed: DOWN,
  paused: DOWN,
} satisfies Record<BlobState, Look>;

const useBlob = (body: readonly number[], state: BlobState) => {
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
    play(finished ? "done" : state);
    return () => cancelAnimationFrame(raf.current);
  }, [play, state]);

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
  const outline = bodyOf(body, seed);
  const resting = useMemo(() => blobMotion(outline, "ready").frame(1), [outline]);
  const frame = useBlob(outline, state);
  const look: Look = useReducedMotion() ? AHEAD : LOOK_OF[state];
  const begin = `-${([...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % LOOK_SECONDS).toFixed(2)}s`;
  const area = { x: -BOX, y: -BOX, width: BOX * 2, height: BOX * 2 };
  const animate = (place: (x: number, y: number) => string, seconds: number) => ({
    ...track(place),
    dur: `${seconds}s`,
    begin,
  });
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
          <path d={resting.body} fill="#fff" />
          {frame.notif && <circle cx={frame.notif.x} cy={frame.notif.y} r={frame.notif.notch} />}
        </mask>
        <mask id={`${id}behind`} maskUnits="userSpaceOnUse" {...area}>
          <rect {...area} fill="#fff" />
          <path d={resting.body} />
        </mask>
        <radialGradient
          id={`${id}shade`}
          gradientUnits="userSpaceOnUse"
          r={175}
          cx={look.kind === "fixed" ? SHADE_X(look.x) : 0}
          cy={look.kind === "fixed" ? SHADE_Y(look.x, look.y) : -10}
        >
          {look.kind === "roam" && (
            <>
              <animate attributeName="cx" {...animate(SHADE_X, look.seconds)} />
              <animate attributeName="cy" {...animate(SHADE_Y, look.seconds)} />
            </>
          )}
          <stop offset={0} stopColor="#fff" stopOpacity={0.16} />
          <stop offset={0.45} stopColor="#fff" stopOpacity={0} />
          <stop offset={0.7} stopColor="#000" stopOpacity={0.18} />
          <stop offset={1} stopColor="#000" stopOpacity={0.55} />
        </radialGradient>
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
      <g transform={look.kind === "fixed" ? `translate(${LEAN(look.x, look.y)})` : undefined}>
        {look.kind === "roam" && (
          <animateTransform
            attributeName="transform"
            type="translate"
            {...animate(LEAN, look.seconds)}
          />
        )}
        <g transform="translate(0 100)">
          <g>
            {look.kind === "roam" && (
              <animateTransform
                attributeName="transform"
                type="scale"
                values="1 1;1 1;1.05 0.91;1 1"
                keyTimes="0;0.97;0.985;1"
                dur="7.3s"
                begin={begin}
                repeatCount="indefinite"
              />
            )}
            <g transform="translate(0 -100)" mask={`url(#${id}body)`}>
              <rect {...area} fill="currentColor" />
              <rect {...area} fill={`url(#${id}shade)`} />
              <path
                d={resting.shine?.d}
                fill="none"
                stroke="#fff"
                strokeWidth={13}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={resting.shine?.opacity}
                transform={
                  look.kind === "fixed" ? `translate(${GLEAM(look.x, look.y)})` : undefined
                }
              >
                {look.kind === "roam" && (
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    {...animate(GLEAM, look.seconds)}
                  />
                )}
              </path>
            </g>
          </g>
        </g>
      </g>
      {frame.notif && (
        <circle cx={frame.notif.x} cy={frame.notif.y} r={frame.notif.r} fill="#2496e8" />
      )}
      {rings("front")}
    </svg>
  );
};

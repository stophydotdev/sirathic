export const IDLE_MS = 3 * 60_000;
export const HOLD_MS = 10 * 60_000;
export const MAKE_ROOM_IDLE_MS = 60_000;
export const RESTORE_MS = 30 * 60_000;

type Activity = { controllers: number; holdUntil: number; lastUsed: number };

export const closable = (activity: Activity, now: number, idleMs: number) =>
  activity.controllers === 0 && activity.holdUntil <= now && now - activity.lastUsed >= idleMs;

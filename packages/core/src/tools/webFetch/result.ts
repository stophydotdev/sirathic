import type { FetchFailure, FetchFailureReason } from "../../types"

export function fail(
  url: string,
  reason: FetchFailureReason,
  extra?: { status?: number; message?: string },
): FetchFailure {
  return { ok: false, url, reason, ...extra }
}

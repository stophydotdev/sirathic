import { describe, expect, test } from "bun:test"
import type { RawSource } from "../../packages/core/src/types"
import { numberSources } from "../../packages/core/src/source"

describe("answer evidence sources", () => {
  test("keeps enough fetched pages for the quality research profile", () => {
    const raw: RawSource[] = Array.from({ length: 8 }, (_, index) => ({
      kind: "web",
      label: `Source ${index + 1}`,
      url: `https://example.com/${index + 1}`,
      domain: "example.com",
      faviconUrl: "https://example.com/favicon.ico",
      text: `Evidence ${index + 1}`,
    }))

    expect(numberSources(raw)).toHaveLength(8)
  })
})

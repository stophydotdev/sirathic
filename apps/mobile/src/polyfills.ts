import { TextDecoderStream, TextEncoderStream } from "@stardazed/streams-text-encoding";
import structuredClone from "@ungap/structured-clone";
import { fetch } from "expo/fetch";

export function installPolyfills() {
  Object.assign(globalThis, { fetch, TextEncoderStream, TextDecoderStream });
  if (!("structuredClone" in globalThis)) {
    Object.assign(globalThis, { structuredClone });
  }
}

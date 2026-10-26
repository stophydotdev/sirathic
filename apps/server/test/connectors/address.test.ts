import { expect, test } from "bun:test";
import { isPrivateAddress, publicUrl } from "../../src/connectors/address";

test.each([
  "127.0.0.1",
  "10.1.2.3",
  "172.20.0.5",
  "192.168.1.1",
  "169.254.169.254",
  "100.100.1.1",
  "0.0.0.0",
  "::1",
  "fd12::1",
  "fe80::1",
  "::ffff:10.0.0.1",
  "::ffff:7f00:1",
  "::ffff:a9fe:a9fe",
  "192.0.2.5",
])("%s is private", (address) => {
  expect(isPrivateAddress(address)).toBe(true);
});

test.each(["1.1.1.1", "104.18.32.7", "172.32.0.1", "192.0.78.22", "2606:4700::1111"])(
  "%s is public",
  (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  },
);

test.each([
  "http://mcp.example.com/mcp",
  "https://127.0.0.1/mcp",
  "https://[::1]/mcp",
  "https://[::ffff:127.0.0.1]/mcp",
  "not a url",
])("%s is refused", async (raw) => {
  await expect(publicUrl(raw)).rejects.toThrow();
});

import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { StatusError } from "../http";

const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3],
] as const) {
  blocked.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}

export const isPrivateAddress = (address: string) =>
  blocked.check(address, isIP(address) === 6 ? "ipv6" : "ipv4");

export async function publicUrl(raw: string) {
  const url = URL.parse(raw);
  if (url?.protocol !== "https:") throw new StatusError(400, "use an https address");
  const host = url.hostname.replaceAll(/^\[|\]$/gu, "");
  const addresses = isIP(host)
    ? [host]
    : await lookup(host, { all: true }).then(
        (found) => found.map((entry) => entry.address),
        () => [],
      );
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new StatusError(400, "that address is not on the public internet");
  }
  return url;
}

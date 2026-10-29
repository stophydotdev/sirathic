const AD_AND_TRACKER_HOSTS = [
  "doubleclick.net",
  "googlesyndication.com",
  "googletagmanager.com",
  "googletagservices.com",
  "google-analytics.com",
  "googleadservices.com",
  "adservice.google.com",
  "adnxs.com",
  "amazon-adsystem.com",
  "facebook.net",
  "ads-twitter.com",
  "hotjar.com",
  "scorecardresearch.com",
  "criteo.com",
  "criteo.net",
  "rubiconproject.com",
  "pubmatic.com",
  "openx.net",
  "casalemedia.com",
  "adsrvr.org",
  "3lift.com",
  "taboola.com",
  "outbrain.com",
  "pub.network",
  "primis.tech",
  "ntv.io",
  "confiant-integrations.net",
  "html-load.cc",
  "html-load.com",
  "hubvisor.io",
  "bounceexchange.com",
  "intentiq.com",
  "dianomi.com",
  "webcontentassessor.com",
  "moatads.com",
  "permutive.app",
  "permutive.com",
  "quantserve.com",
  "chartbeat.com",
  "chartbeat.net",
  "parsely.com",
  "sail-horizon.com",
  "onesignal.com",
  "clarity.ms",
  "fullstory.com",
  "mouseflow.com",
  "quantummetric.com",
  "segment.com",
  "mixpanel.com",
  "amplitude.com",
  "nr-data.net",
  "liadm.com",
  "hs-analytics.net",
  "hsadspixel.net",
];

const PRIVATE_HOSTS = [
  "*://localhost*",
  "*://*.localhost*",
  "*://*.internal*",
  "*://*.local/*",
  "*://*.local:*",
  "*://*.localdomain*",
  "*://*.lan/*",
  "*://*.home.arpa*",
  "*://0.*",
  "*://10.*",
  "*://127.*",
  "*://169.254.*",
  "*://192.168.*",
  ...Array.from({ length: 16 }, (_, index) => `*://172.${16 + index}.*`),
  ...Array.from({ length: 64 }, (_, index) => `*://100.${64 + index}.*`),
  "*://[*",
];

export const BLOCKED_URLS = [
  ...AD_AND_TRACKER_HOSTS.flatMap((host) => [`*://${host}/*`, `*://*.${host}/*`]),
  "*/gtm.js?id=*",
  "*/gtag/js?id=*",
  ...PRIVATE_HOSTS,
];

const PRIVATE_IPV4 =
  /^(?:0|10|127)\.|^169\.254\.|^172\.(?:1[6-9]|2\d|3[01])\.|^192\.168\.|^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./u;
const INTERNAL_NAME = /(?:^|\.)(?:localhost|local|internal|localdomain|lan|home\.arpa)$/u;

export const isPrivateUrl = (raw: string) => {
  const url = URL.parse(raw);
  if (!url || !/^(?:https?|wss?):$/u.test(url.protocol)) return false;
  const host = url.hostname.toLowerCase();
  return (
    host.startsWith("[") ||
    PRIVATE_IPV4.test(host) ||
    INTERNAL_NAME.test(host) ||
    !host.includes(".")
  );
};

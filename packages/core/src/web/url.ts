const TRACKING_PARAM = /^(utm_\w+|fbclid|gclid|msclkid|mc_cid|mc_eid|ref_src|traffic_source)$/u;

export const cleanUrl = (raw: string) => {
  const url = new URL(raw);
  url.hash = "";
  url.search = new URLSearchParams(
    [...url.searchParams].filter(([key]) => !TRACKING_PARAM.test(key)),
  ).toString();
  return url.href;
};

export const hostOf = (url: string) => new URL(url).hostname.toLowerCase().replace(/^www\./u, "");

export const isOnSite = (host: string, site: string) => host === site || host.endsWith(`.${site}`);

import openNext from "./.open-next/worker.js";

const API_PATHS = /^\/(?:api|trpc|auth)(?:\/|$)/u;

export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!API_PATHS.test(url.pathname)) return openNext.fetch(request, env, ctx);
    const headers = new Headers(request.headers);
    headers.delete("host");
    return fetch(new URL(`${url.pathname}${url.search}`, env.API_ORIGIN), {
      method: request.method,
      headers,
      body: request.body,
      redirect: "manual",
    });
  },
};

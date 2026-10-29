FROM oven/bun:1.4.4-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates tini xvfb xauth x11vnc fonts-liberation fonts-noto-color-emoji \
  && curl -fsSL -o /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
  && apt-get install -y --no-install-recommends /tmp/chrome.deb \
  && rm /tmp/chrome.deb \
  && find /opt/google/chrome/locales -type f ! -name 'en-US*' -delete \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /repo
COPY package.json bun.lock ./
COPY apps/browser/package.json apps/browser/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/env/package.json packages/env/
RUN bun install --frozen-lockfile --production --filter @sirathic/browser

COPY apps/browser/chromePolicy.json /etc/opt/chrome/policies/managed/sirathic.json
COPY apps/browser/src apps/browser/src
RUN mkdir -p /data/logins /tmp/.X11-unix && chmod 1777 /tmp/.X11-unix
WORKDIR /repo/apps/browser

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["tini", "--"]
CMD ["bun", "src/index.ts"]

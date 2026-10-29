FROM oven/bun:1.4.4-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates tini xvfb xauth fonts-liberation fonts-noto-color-emoji \
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

COPY apps/browser/src apps/browser/src
WORKDIR /repo/apps/browser

ENV NODE_ENV=production
ENV PORT=8080
ENV DISPLAY=:99
EXPOSE 8080

ENTRYPOINT ["tini", "--"]
CMD ["sh", "-c", "Xvfb :99 -screen 0 1280x800x24 -nolisten tcp >/dev/null 2>&1 & exec bun src/index.ts"]

FROM oven/bun:1.4.4 AS build
WORKDIR /repo

COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/
COPY apps/browser/package.json apps/browser/
COPY apps/web/package.json apps/web/
COPY packages/app/package.json packages/app/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/env/package.json packages/env/
RUN bun install --frozen-lockfile --filter @sirathic/server

COPY tsconfig.json ./
COPY packages packages
COPY apps/server/src apps/server/src
COPY apps/browser/src/protocol.ts apps/browser/src/
RUN bun build --compile --minify --sourcemap apps/server/src/index.ts --outfile /server
RUN mkdir /onepassword && cp --parents "$(realpath "$(find node_modules -path '*@1password/sdk-core/nodejs/core_bg.wasm' | head -1)")" /onepassword

FROM gcr.io/distroless/cc-debian12:nonroot
COPY --from=build /server /server
COPY --from=build /onepassword/ /
ENV NODE_ENV=production
EXPOSE 3000
ENTRYPOINT ["/server"]

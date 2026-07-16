FROM python:3.12-slim@sha256:c3d81d25b3154142b0b42eb1e61300024426268edeb5b5a26dd7ddf64d9daf28

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=3000

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      libasound2 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libcups2 \
      libdbus-glib-1-2 \
      libdrm2 \
      libgbm1 \
      libgtk-3-0 \
      libpci3 \
      libx11-xcb1 \
      libxcomposite1 \
      libxcursor1 \
      libxdamage1 \
      libxi6 \
      libxrandr2 \
      libxss1 \
      libxt6 \
      libxtst6 \
    && rm -rf /var/lib/apt/lists/*

COPY infra/camoufox/requirements.lock /app/requirements.lock
RUN pip install --no-cache-dir --require-hashes -r /app/requirements.lock \
    && python -m camoufox fetch

COPY infra/camoufox/server.py /app/server.py

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --start-period=45s --retries=5 \
  CMD python -c 'import os,socket; s=socket.create_connection(("127.0.0.1", int(os.environ.get("PORT", "3000"))), 2); s.close()'

CMD ["python", "/app/server.py"]

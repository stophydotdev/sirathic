FROM searxng/searxng@sha256:0872beb1d495d41f2dda73d7aea83746657afdd2be3010eb1b11f5a541555c9e

ENV GRANIAN_BLOCKING_THREADS=32

COPY --chown=searxng:searxng searxng/settings.yml /opt/sirathic/settings.yml
COPY --chown=searxng:searxng scripts/searxng/render_settings.py /opt/sirathic/render_settings.py
COPY scripts/searxng/entrypoint.sh /opt/sirathic/entrypoint.sh

RUN chmod 0555 /opt/sirathic/entrypoint.sh \
    && mkdir -p /etc/searxng \
    && chown searxng:searxng /etc/searxng

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

ENTRYPOINT ["/opt/sirathic/entrypoint.sh"]

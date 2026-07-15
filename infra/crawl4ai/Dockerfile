FROM unclecode/crawl4ai@sha256:be486aa04e6761ecb012062caf558cb059465b87ec4ad6466db44ca25dd9e4f8

COPY --chown=appuser:appuser config.yml /opt/sirathic/config.yml
COPY --chown=appuser:appuser render_config.py /opt/sirathic/render_config.py
COPY --chown=appuser:appuser entrypoint.sh /opt/sirathic/entrypoint.sh

USER appuser
RUN chmod 0555 /opt/sirathic/entrypoint.sh

HEALTHCHECK --interval=15s --timeout=3s --start-period=45s --retries=5 \
  CMD curl -fsS http://127.0.0.1:11235/health >/dev/null || exit 1

ENTRYPOINT ["/opt/sirathic/entrypoint.sh"]
CMD ["supervisord", "-c", "supervisord.conf"]


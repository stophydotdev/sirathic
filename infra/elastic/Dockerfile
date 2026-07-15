FROM docker.elastic.co/elasticsearch/elasticsearch:9.4.3@sha256:851ff5f9615ab7d2f00931114f6db32850f0208ec9fe7e841f135ac78f5f13d5

USER root
COPY --chown=1000:0 infra/elastic /opt/sirathic/elastic
RUN chmod 0755 /opt/sirathic/elastic/entrypoint.sh /opt/sirathic/elastic/init.sh

ENTRYPOINT ["/opt/sirathic/elastic/entrypoint.sh"]

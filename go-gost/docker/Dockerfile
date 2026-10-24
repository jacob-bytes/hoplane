# Node agent image. The release job builds it from the same UPX-compressed
# binaries it publishes (hoplane-agent-amd64 / hoplane-agent-arm64 next to this file); run
# with --network host so forwards can listen on any port.
FROM debian:bookworm-slim

# nftables: traffic counters and inbound whitelists; dsniff: tcpkill.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates tzdata nftables dsniff tini \
  && rm -rf /var/lib/apt/lists/*

ARG TARGETARCH
ARG VERSION=dev
# Artifacts lose the exec bit on upload.
COPY --chmod=755 gost-${TARGETARCH} /usr/local/bin/hoplane_agent
COPY --chmod=755 entrypoint.sh /usr/local/bin/hoplane-agent-entrypoint

ENV HOPLANE_AGENT_CONTAINER=1 \
    HOPLANE_AGENT_IMAGE_VERSION=${VERSION}

VOLUME /etc/hoplane_agent
WORKDIR /etc/hoplane_agent
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/hoplane-agent-entrypoint"]

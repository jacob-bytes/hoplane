FROM --platform=$BUILDPLATFORM golang:1.25-bookworm AS builder
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
ARG TARGETOS
ARG TARGETARCH
# owner/repo whose releases the panel installs nodes and upgrades from.
ARG GITHUB_REPO
RUN CGO_ENABLED=0 GOOS=${TARGETOS:-linux} env ${TARGETARCH:+GOARCH=${TARGETARCH}} go build -ldflags="${GITHUB_REPO:+-X 'go-backend/internal/http/handler.githubRepo=${GITHUB_REPO}'}" -o /out/paneld ./cmd/paneld

FROM debian:bookworm-slim AS geoip
# GeoLite2-Country from the pinned P3TERX mirror; update the URL and checksum
# together. Attribution: GeoLite2 data created by MaxMind, available from
# https://www.maxmind.com.
ARG GEOIP_COUNTRY_URL=https://github.com/P3TERX/GeoLite.mmdb/releases/download/2026.10.28/GeoLite2-Country.mmdb
ARG GEOIP_COUNTRY_SHA256=54e327d9fe9214e568c5b8f8ce97a7f7e7087b7de10b0560640417695d153797
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates wget \
    && wget -qO /GeoLite2-Country.mmdb "${GEOIP_COUNTRY_URL}" \
    && echo "${GEOIP_COUNTRY_SHA256}  /GeoLite2-Country.mmdb" | sha256sum -c - \
    && rm -rf /var/lib/apt/lists/*

FROM docker:27-cli AS dockercli

FROM debian:bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates wget && rm -rf /var/lib/apt/lists/*
COPY --from=builder /out/paneld /app/paneld
COPY --from=dockercli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=dockercli /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/docker-compose
COPY --from=geoip /GeoLite2-Country.mmdb /usr/share/hoplane/GeoLite2-Country.mmdb

ENV SERVER_ADDR=:6365
EXPOSE 6365
ENTRYPOINT ["/app/paneld"]

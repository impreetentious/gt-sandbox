FROM debian:bookworm-slim

ARG GAMBIT_VERSION=16.6.0

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        bison \
        build-essential \
        ca-certificates \
        curl \
        flex \
        libboost-filesystem-dev \
        libboost-program-options-dev \
        libboost-system-dev \
        libgmp-dev \
        libreadline-dev \
        libxml2-dev \
        pkg-config \
    && rm -rf /var/lib/apt/lists/*

RUN curl --fail --location --silent --show-error \
        "https://github.com/gambitproject/gambit/releases/download/v${GAMBIT_VERSION}/gambit-${GAMBIT_VERSION}.tar.gz" \
        --output /tmp/gambit.tar.gz \
    && tar --extract --gzip --file /tmp/gambit.tar.gz --directory /tmp \
    && cd "/tmp/gambit-${GAMBIT_VERSION}" \
    && ./configure --disable-gui --prefix=/opt/gambit \
    && make --jobs=2 \
    && make install \
    && rm -rf /tmp/gambit.tar.gz "/tmp/gambit-${GAMBIT_VERSION}"

ENV PATH="/opt/gambit/bin:${PATH}"

CMD ["gambit-enummixed", "--help"]

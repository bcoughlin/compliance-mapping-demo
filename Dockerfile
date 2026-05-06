# syntax=docker/dockerfile:1.6
#
# Multi-stage build for the Compliance Mapping Demo.
#
# Stage 1 — deps: install Node dependencies cleanly.
# Stage 2 — builder: produce the Next.js standalone server bundle.
# Stage 3 — runner: minimal Debian image carrying Node 20, Python 3,
#                   and Semgrep, plus the bundled app and the static
#                   assets the agent reads at runtime.

# ----------------------------------------------------------------------------
FROM node:20-bookworm-slim AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --prefer-offline

# ----------------------------------------------------------------------------
FROM node:20-bookworm-slim AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Tell Next.js we're building for production — strict, no telemetry.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ----------------------------------------------------------------------------
FROM node:20-bookworm-slim AS runner

WORKDIR /app

# Runtime tools the /api/run route shells out to:
#   - python3            — the AST call-graph script
#   - semgrep            — taint-mode scanner derived from registry rules
# Pinning a Python venv pattern keeps the install reproducible without
# tripping PEP 668 system-package locks on Debian Bookworm.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
        ca-certificates \
        tini \
 && python3 -m venv /opt/semgrep-venv \
 && /opt/semgrep-venv/bin/pip install --no-cache-dir --upgrade pip \
 && /opt/semgrep-venv/bin/pip install --no-cache-dir semgrep==1.157.0 \
 && ln -s /opt/semgrep-venv/bin/semgrep /usr/local/bin/semgrep \
 && apt-get purge -y python3-pip \
 && apt-get autoremove -y \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# Run as non-root. --create-home gives Semgrep a writable $HOME so it
# can drop its log + cache directory there.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs --create-home --shell /usr/sbin/nologin nextjs \
 && mkdir -p /home/nextjs/.semgrep \
 && chown -R nextjs:nodejs /home/nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Next.js standalone bundle — minimal node_modules + server.js.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Runtime assets the /api/run* routes read off disk. These aren't part
# of the Next.js module graph; they have to be copied explicitly.
COPY --from=builder --chown=nextjs:nodejs /app/registry ./registry
COPY --from=builder --chown=nextjs:nodejs /app/sample_codebase ./sample_codebase
COPY --from=builder --chown=nextjs:nodejs /app/semgrep ./semgrep
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

USER nextjs

EXPOSE 8080

# tini reaps zombie subprocesses (semgrep, python) cleanly.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]

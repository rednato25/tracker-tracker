#!/usr/bin/env bash
#
# e2e/docker/validate-candidate.sh
#
# Docker-only candidate-image validation for the reviewed migration runner and
# the P01 Compose path. Every database is disposable, every credential here is
# synthetic, and no external service is contacted.
#
# Requires: docker, docker compose, curl, psql (through the postgres container),
# pnpm and Node on the host for the frozen P02a fixture.
#
# The image under test must be built from the commit being validated. This
# script never pulls or inspects the published latest image.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

IMAGE="${CANDIDATE_IMAGE:-tracker-tracker:ci}"
PG_IMAGE="${PG_IMAGE:-postgres:18-alpine}"
DB_USER="tt"
DB_PASSWORD="tt"
SESSION_SECRET="ci-docker-validation-session-secret-0123456789abcdef"
NETWORK="tt-ci-net-$$"
DB_CONTAINER="tt-ci-db-$$"
PG17_CONTAINER="tt-ci-pg17-$$"
TMP="$(mktemp -d)"
COMPOSE_PROJECT="tt-ci-compose-$$"
MANAGED=()
COMPOSE_DIR="$TMP/compose"
COMPOSE_PORT=$((32000 + ($$ % 2000)))
STARTED_PORT=""

sanitize() {
  sed -E 's#([A-Za-z][A-Za-z0-9+.-]*://)[^[:space:]]+#\1[redacted]#g'
}

dump_logs() {
  echo "::group::Sanitized container logs"
  for container in "${MANAGED[@]}"; do
    echo "--- $container ---"
    docker logs --tail 200 "$container" 2>&1 | sanitize || true
  done
  echo "--- $DB_CONTAINER ---"
  docker logs --tail 200 "$DB_CONTAINER" 2>&1 | sanitize || true
  echo "--- $PG17_CONTAINER ---"
  docker logs --tail 200 "$PG17_CONTAINER" 2>&1 | sanitize || true
  if [ -f "$COMPOSE_DIR/docker-compose.yml" ]; then
    echo "--- compose ---"
    docker compose --project-name "$COMPOSE_PROJECT" --env-file "$COMPOSE_DIR/.env" \
      -f "$COMPOSE_DIR/docker-compose.yml" -f "$COMPOSE_DIR/override.yml" \
      logs --no-color --tail 200 2>&1 | sanitize || true
  fi
  echo "::endgroup::"
}

cleanup() {
  for container in "${MANAGED[@]}"; do
    docker rm -f "$container" >/dev/null 2>&1 || true
  done
  if [ -f "$COMPOSE_DIR/docker-compose.yml" ]; then
    docker compose --project-name "$COMPOSE_PROJECT" --env-file "$COMPOSE_DIR/.env" \
      -f "$COMPOSE_DIR/docker-compose.yml" -f "$COMPOSE_DIR/override.yml" \
      down -v --remove-orphans >/dev/null 2>&1 || true
  fi
  docker rm -f "$DB_CONTAINER" "$PG17_CONTAINER" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}

on_exit() {
  local code=$?
  if [ "$code" -ne 0 ]; then
    dump_logs
  fi
  cleanup
  exit "$code"
}
trap on_exit EXIT

fail() {
  echo "::error::$*"
  exit 1
}

psql_on() {
  local container="$1"
  local database="$2"
  local query="$3"
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$database" -Atc "$query"
}

psql_tcp() {
  local container="$1"
  local database="$2"
  local query="$3"
  docker exec -i -e PGPASSWORD="$DB_PASSWORD" "$container" \
    psql -h 127.0.0.1 -U "$DB_USER" -d "$database" -Atc "$query"
}

psql_query() {
  psql_on "$DB_CONTAINER" "$1" "$2"
}

create_database() {
  psql_query postgres "CREATE DATABASE \"$1\""
}

assert_equal() {
  local expected="$1"
  local actual="$2"
  local label="$3"
  [ "$expected" = "$actual" ] || fail "$label: expected '$expected', got '$actual'"
}

app_port() {
  docker port "$1" 3000/tcp | head -n1 | awk -F: '{print $NF}'
}

start_app() {
  local name="$1"
  local database="$2"
  local database_host="${3:-$DB_CONTAINER}"
  docker run -d --name "$name" --network "$NETWORK" -p 127.0.0.1::3000 \
    -e DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${database_host}:5432/${database}" \
    -e NODE_ENV=production \
    -e SESSION_SECRET="$SESSION_SECRET" \
    -e TZ=UTC \
    "$IMAGE" >/dev/null
  MANAGED+=("$name")
  local port=""
  for _ in $(seq 1 50); do
    port="$(app_port "$name" 2>/dev/null || true)"
    [ -n "$port" ] && break
    sleep 0.2
  done
  [ -n "$port" ] || fail "could not resolve a host port for $name"
  # Command substitution would run the function in a subshell, losing MANAGED
  # entries used by cleanup and failure logs. Hand the port back via a global.
  STARTED_PORT="$port"
}

wait_health() {
  local name="$1"
  local port="$2"
  local status
  for _ in $(seq 1 75); do
    status="$(docker inspect -f '{{.State.Status}}' "$name" 2>/dev/null || echo missing)"
    if [ "$status" = "exited" ] || [ "$status" = "missing" ]; then
      fail "$name stopped before becoming healthy"
    fi
    if curl -fsS --max-time 2 "http://127.0.0.1:${port}/api/health" |
      grep -q '"status":"ok"'; then
      return 0
    fi
    sleep 2
  done
  fail "$name did not become healthy"
}

wait_exit() {
  local name="$1"
  local status
  for _ in $(seq 1 75); do
    status="$(docker inspect -f '{{.State.Status}}' "$name" 2>/dev/null || echo missing)"
    if [ "$status" = "exited" ]; then return 0; fi
    [ "$status" = "missing" ] && fail "$name disappeared before exiting"
    sleep 1
  done
  fail "$name was still running; the migration failure did not stop startup"
}

assert_log() {
  local name="$1"
  local pattern="$2"
  # Docker can report the container exited just before the log driver flushes.
  # Retry the exact assertion for a short bounded window; do not relax it.
  for _ in $(seq 1 20); do
    if docker logs "$name" 2>&1 | grep -Eq "$pattern"; then return 0; fi
    sleep 0.5
  done
  fail "$name logs did not contain /$pattern/"
}

remove_app() {
  docker rm -f "$1" >/dev/null 2>&1 || true
}

echo "Candidate image: $IMAGE"
docker image inspect "$IMAGE" >/dev/null 2>&1 || fail "candidate image not present locally"

# ── Isolated PostgreSQL 18 ────────────────────────────────────────────────────
docker network create "$NETWORK" >/dev/null
docker run -d --name "$DB_CONTAINER" --network "$NETWORK" -p 127.0.0.1::5432 \
  -e POSTGRES_USER="$DB_USER" \
  -e POSTGRES_PASSWORD="$DB_PASSWORD" \
  -e POSTGRES_DB=postgres \
  "$PG_IMAGE" >/dev/null

postgres_ready=0
for _ in $(seq 1 60); do
  # Query the actual database rather than relying on pg_isready's socket
  # heuristic; this also proves the POSTGRES_USER/POSTGRES_DB initialization
  # finished before any app container starts.
  if psql_tcp "$DB_CONTAINER" postgres 'select 1' >/dev/null 2>&1; then
    postgres_ready=1
    break
  fi
  sleep 1
done
if [ "$postgres_ready" -ne 1 ]; then
  docker inspect -f 'status={{.State.Status}} exit={{.State.ExitCode}} error={{.State.Error}}' \
    "$DB_CONTAINER" 2>&1 || true
  fail "PostgreSQL did not become ready"
fi
PG_HOST_PORT="$(docker port "$DB_CONTAINER" 5432/tcp | head -n1 | awk -F: '{print $NF}')"

# ── 1. Fresh database startup and health ──────────────────────────────────────
echo "::group::fresh database startup"
create_database tt_fresh
start_app tt-ci-fresh tt_fresh
FRESH_PORT="$STARTED_PORT"
wait_health tt-ci-fresh "$FRESH_PORT"
assert_equal 7 "$(psql_query tt_fresh 'select count(*) from schema_migrations')" "fresh ledger rows"
assert_equal 1 "$(psql_query tt_fresh "select count(*) from schema_migrations where version='0000_baseline' and baseline")" "fresh baseline row"
assert_equal 1 "$(psql_query tt_fresh "select count(*) from schema_migrations where version='0001_digest_settings'")" "fresh digest migration row"
assert_equal 1 "$(psql_query tt_fresh "select count(*) from schema_migrations where version='0002_quiet_hours'")" "fresh quiet-hours migration row"
assert_equal 1 "$(psql_query tt_fresh "select count(*) from schema_migrations where version='0003_rank_goals'")" "fresh rank-goals migration row"
assert_equal 1 "$(psql_query tt_fresh "select count(*) from schema_migrations where version='0004_prowlarr'")" "fresh Prowlarr migration row"
assert_equal 1 "$(psql_query tt_fresh "select count(*) from schema_migrations where version='0005_integration_tokens'")" "fresh integration-token migration row"
assert_equal 1 "$(psql_query tt_fresh "select count(*) from schema_migrations where version='0006_recruitment_state'")" "fresh recruitment-state migration row"
assert_equal 20 "$(psql_query tt_fresh "select count(*) from pg_tables where schemaname='public' and tablename <> 'schema_migrations'")" "fresh application tables"
echo "fresh startup healthy with one baseline ledger row"
echo "::endgroup::"

# ── 2. Managed restart: no duplicate ledger row and no-op path ───────────────
echo "::group::managed restart"
create_database tt_managed
start_app tt-ci-managed-1 tt_managed
MANAGED_PORT="$STARTED_PORT"
wait_health tt-ci-managed-1 "$MANAGED_PORT"
remove_app tt-ci-managed-1
start_app tt-ci-managed-2 tt_managed
MANAGED_PORT="$STARTED_PORT"
wait_health tt-ci-managed-2 "$MANAGED_PORT"
assert_equal 7 "$(psql_query tt_managed 'select count(*) from schema_migrations')" "managed ledger rows"
assert_log tt-ci-managed-2 '"path": *"noop"'
echo "managed restart healthy with a no-op migration path"
echo "::endgroup::"

# ── 3. Unknown schema: fail closed without mutation or startup ───────────────
echo "::group::unknown schema refusal"
create_database tt_unknown
psql_query tt_unknown "CREATE TABLE unexpected_schema_probe (id integer)" >/dev/null
start_app tt-ci-unknown tt_unknown
UNKNOWN_PORT="$STARTED_PORT"
wait_exit tt-ci-unknown
assert_equal "" "$(psql_query tt_unknown "select coalesce(to_regclass('public.schema_migrations')::text, '')")" "unknown schema ledger"
assert_equal 1 "$(psql_query tt_unknown "select count(*) from pg_tables where schemaname='public' and tablename='unexpected_schema_probe'")" "unknown schema table preserved"
assert_log tt-ci-unknown 'ADOPTION_FINGERPRINT_MISMATCH|does not match the approved baseline'
echo "unknown schema refused before DDL and before the server"
echo "::endgroup::"

# ── 4. Database ahead: fail closed without mutation or startup ───────────────
echo "::group::database ahead refusal"
create_database tt_ahead
start_app tt-ci-ahead-1 tt_ahead
AHEAD_PORT="$STARTED_PORT"
wait_health tt-ci-ahead-1 "$AHEAD_PORT"
remove_app tt-ci-ahead-1
psql_query tt_ahead "INSERT INTO schema_migrations (version, checksum, app_version, baseline) VALUES ('0005_future', repeat('0', 64), 'ci', false)" >/dev/null
start_app tt-ci-ahead-2 tt_ahead
AHEAD_PORT="$STARTED_PORT"
wait_exit tt-ci-ahead-2
assert_equal 8 "$(psql_query tt_ahead 'select count(*) from schema_migrations')" "ahead ledger rows"
assert_equal 0 "$(psql_query tt_ahead "select count(*) from pg_tables where schemaname='public' and tablename='0005_future'")" "ahead migration table"
assert_log tt-ci-ahead-2 'DATABASE_AHEAD|ahead of this application'
echo "database ahead refused without applying the unknown version"
echo "::endgroup::"

# ── 5. Concurrent startup: one ledger, both healthy ─────────────────────────
echo "::group::concurrent startup"
create_database tt_concurrent
start_app tt-ci-concurrent-1 tt_concurrent
CONCURRENT_1_PORT="$STARTED_PORT"
start_app tt-ci-concurrent-2 tt_concurrent
CONCURRENT_2_PORT="$STARTED_PORT"
wait_health tt-ci-concurrent-1 "$CONCURRENT_1_PORT"
wait_health tt-ci-concurrent-2 "$CONCURRENT_2_PORT"
assert_equal 7 "$(psql_query tt_concurrent 'select count(*) from schema_migrations')" "concurrent ledger rows"
echo "both concurrent containers healthy with one ledger row"
echo "::endgroup::"

# ── 6. Frozen seeded P02a baseline adoption ─────────────────────────────────
echo "::group::P02a adoption"
create_database tt_p02a
P02A_DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:${PG_HOST_PORT}/tt_p02a" \
  P02A_ALLOW_DESTRUCTIVE=1 \
  P02A_ALLOW_REMOTE=1 \
  env -u NODE_ENV pnpm exec tsx e2e/fixtures/db-baseline-v1/seed.ts >/dev/null
P02A_DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:${PG_HOST_PORT}/tt_p02a" \
  P02A_ALLOW_REMOTE=1 env -u NODE_ENV pnpm exec tsx e2e/fixtures/db-baseline-v1/verify.ts --schema-only >/dev/null
start_app tt-ci-p02a tt_p02a
P02A_PORT="$STARTED_PORT"
wait_health tt-ci-p02a "$P02A_PORT"
assert_equal 7 "$(psql_query tt_p02a 'select count(*) from schema_migrations')" "P02a ledger rows"
assert_equal 2 "$(psql_query tt_p02a 'select count(*) from trackers')" "P02a seeded trackers"
assert_equal "p02a-fixture" "$(psql_query tt_p02a 'select username from app_settings limit 1')" "P02a settings"
echo "unmanaged P02a baseline adopted with seeded rows preserved"
echo "::endgroup::"

# ── 7. Unsupported PostgreSQL major: reject before DDL and startup ──────────
echo "::group::unsupported PostgreSQL major"
docker run -d --name "$PG17_CONTAINER" --network "$NETWORK" \
  -e POSTGRES_USER="$DB_USER" \
  -e POSTGRES_PASSWORD="$DB_PASSWORD" \
  -e POSTGRES_DB=postgres \
  postgres:17-alpine >/dev/null
pg17_ready=0
for _ in $(seq 1 60); do
  if psql_tcp "$PG17_CONTAINER" postgres 'select 1' >/dev/null 2>&1; then
    pg17_ready=1
    break
  fi
  sleep 1
done
[ "$pg17_ready" -eq 1 ] || fail "PostgreSQL 17 did not become ready"
psql_on "$PG17_CONTAINER" postgres 'CREATE DATABASE "tt_pg17"' >/dev/null
start_app tt-ci-pg17 tt_pg17 "$PG17_CONTAINER"
PG17_PORT="$STARTED_PORT"
wait_exit tt-ci-pg17
assert_equal "" "$(psql_on "$PG17_CONTAINER" tt_pg17 "select coalesce(to_regclass('public.schema_migrations')::text, '')")" "PG17 ledger"
assert_equal 0 "$(psql_on "$PG17_CONTAINER" tt_pg17 "select count(*) from pg_tables where schemaname='public'")" "PG17 application tables"
assert_log tt-ci-pg17 'UNSUPPORTED_POSTGRES|PostgreSQL 18 is required'
echo "PostgreSQL 17 refused before DDL and before the server"
echo "::endgroup::"

# ── 8. P01 Compose/Quick Start path with an explicit candidate override ─────
echo "::group::Compose candidate override"
mkdir -p "$COMPOSE_DIR"
cp docker-compose.yml "$COMPOSE_DIR/docker-compose.yml"
cp -R postgres "$COMPOSE_DIR/postgres"
cat > "$COMPOSE_DIR/override.yml" <<EOF
services:
  tracker-tracker-app:
    image: ${IMAGE}
EOF
cat > "$COMPOSE_DIR/.env" <<EOF
POSTGRES_USER=${DB_USER}
POSTGRES_PASSWORD=${DB_PASSWORD}
SESSION_SECRET=${SESSION_SECRET}
TZ=UTC
PORT=${COMPOSE_PORT}
EOF
docker compose --project-name "$COMPOSE_PROJECT" --env-file "$COMPOSE_DIR/.env" \
  -f "$COMPOSE_DIR/docker-compose.yml" -f "$COMPOSE_DIR/override.yml" \
  up -d --wait --wait-timeout 180 --pull never
assert_equal "$IMAGE" "$(docker inspect tracker-tracker-app --format '{{.Config.Image}}')" "Compose candidate image"
curl -fsS --max-time 5 "http://127.0.0.1:${COMPOSE_PORT}/api/health" | grep -q '"status":"ok"' ||
  fail "Compose app health check failed"
assert_equal 7 "$(docker exec tracker-tracker-db psql -U "$DB_USER" -d tracker_tracker -Atc 'select count(*) from schema_migrations')" "Compose ledger rows"
echo "Compose Quick Start healthy with the explicit candidate image"
docker compose --project-name "$COMPOSE_PROJECT" --env-file "$COMPOSE_DIR/.env" \
  -f "$COMPOSE_DIR/docker-compose.yml" -f "$COMPOSE_DIR/override.yml" down -v --remove-orphans >/dev/null
echo "::endgroup::"

echo "Docker candidate validation passed."

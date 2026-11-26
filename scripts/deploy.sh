#!/usr/bin/env bash
set -euo pipefail
umask 077

image_tag="${1:-}"

if [[ ! "$image_tag" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: bash deploy.sh <40-character commit SHA>" >&2
  exit 1
fi

if [[ "$(id -un)" != "ubuntu" ]]; then
  echo "Run this script as the ubuntu user." >&2
  exit 1
fi

app_dir="/home/ubuntu/filmflicks"
cd "$app_dir"

exec 9>.deploy.lock
flock -n 9 || {
  echo "Another deployment is running." >&2
  exit 1
}

for file in .env.production docker-compose.production.yml; do
  if [[ ! -f "$file" ]]; then
    echo "Missing required file: $file" >&2
    exit 1
  fi
done

if ! grep -q '^IMAGE_TAG=' .env.production; then
  echo ".env.production must contain an IMAGE_TAG= line." >&2
  exit 1
fi

candidate_file=$(mktemp "$app_dir/.compose.XXXXXX.yml")
trap 'rm -f -- "$candidate_file"' EXIT

curl --fail --silent --show-error --location \
  --connect-timeout 10 --max-time 60 \
  "https://raw.githubusercontent.com/DagmawiDelelegne/FilmFlicks/$image_tag/docker-compose.production.yml" \
  --output "$candidate_file"

compose=(
  sudo -n env "IMAGE_TAG=$image_tag"
  docker compose
  --project-name filmflicks-production
  --project-directory "$app_dir"
  --env-file .env.production
  -f "$candidate_file"
)

"${compose[@]}" config --quiet
"${compose[@]}" pull backend frontend

mkdir -p backups
backup_dir=$(mktemp -d "backups/$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")

cp .env.production "$backup_dir/.env.production"
cp docker-compose.production.yml "$backup_dir/docker-compose.production.yml"

echo "Backing up the database to $backup_dir/database.dump"

"${compose[@]}" exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "$backup_dir/database.dump"

"${compose[@]}" exec -T postgres pg_restore --list \
  < "$backup_dir/database.dump" > /dev/null

"${compose[@]}" run --rm --no-deps backend python create_tables.py

if "${compose[@]}" up -d --no-deps --wait --wait-timeout 180 backend frontend; then
  sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$image_tag/" .env.production
  mv "$candidate_file" docker-compose.production.yml
  echo "Deployment succeeded: $image_tag"
  exit 0
fi

echo "New containers failed their startup checks. Restoring the previous app version." >&2

rollback=(
  sudo -n env -u IMAGE_TAG
  docker compose
  --project-name filmflicks-production
  --project-directory "$app_dir"
  --env-file "$backup_dir/.env.production"
  -f "$backup_dir/docker-compose.production.yml"
)

if "${rollback[@]}" up -d --no-deps --wait --wait-timeout 180 backend frontend; then
  echo "Previous app version restarted." >&2
else
  echo "Rollback also failed. Recovery files are in $backup_dir" >&2
fi

exit 1
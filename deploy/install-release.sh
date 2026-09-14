#!/usr/bin/env bash
# Run only on ECS after checking the existing services, ports and project directory.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo 'Run as root'; exit 1; }
[ "$#" = 1 ] || { echo 'Provide release ID'; exit 1; }
release_id="$1"
[[ "$release_id" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$ ]] || exit 1
base=/opt/fs
release="$base/releases/$release_id"
archive="$base/incoming/$release_id.tar.gz"
[ -f "$base/.managed-by-feishu-progress-board" ] || { echo 'Inspect /opt/fs and establish project ownership first'; exit 1; }
[ -f "$base/shared/.env" ] || { echo 'Missing project environment'; exit 1; }
[ -x "$base/runtime/bin/node" ] || { echo 'Missing isolated Node runtime'; exit 1; }
[ -f "$archive" ] && [ ! -e "$release" ] || { echo 'Missing archive or release already exists'; exit 1; }
command -v nginx >/dev/null
nginx -t
if ss -lntH '( sport = :18081 )' | grep -q .; then
  systemctl is-active --quiet fs || { echo 'Backend port belongs to another service'; exit 1; }
fi
getent passwd fs >/dev/null || useradd --system --home-dir "$base" --shell /usr/sbin/nologin fs
install -d -m 755 "$base/releases" "$base/logs"
install -d -o fs -g fs -m 700 "$base/data"
chown root:fs "$base/shared/.env"
chmod 640 "$base/shared/.env"
chown fs:fs "$base/logs"
install -d -m 755 "$release"
tar -xzf "$archive" -C "$release" --no-same-owner
export PATH="$base/runtime/bin:$PATH"
node -e 'const [a,b]=process.versions.node.split(".").map(Number);if(a<22||(a===22&&b<13))process.exit(1)'
(cd "$release" && npm ci --omit=dev --no-audit --no-fund)
chmod -R a+rX "$release"
previous=""
if [ -e "$base/current" ]; then previous="$(readlink -f "$base/current")"; fi
if [ -n "$previous" ] && [ -e "$base/current" ]; then
  case "$previous" in "$base/releases/"*) ;; *) echo 'Unexpected current release target'; exit 1;; esac
fi
backup="$base/backups/$release_id"
install -d -m 700 "$backup"
[ ! -f /etc/nginx/conf.d/fs.conf ] || cp -p /etc/nginx/conf.d/fs.conf "$backup/fs.conf"
[ ! -f /etc/systemd/system/fs.service ] || cp -p /etc/systemd/system/fs.service "$backup/fs.service"
rollback() {
  trap - ERR
  echo 'Restoring only fs configuration after failure'
  if [ -n "$previous" ] && [ -d "$previous" ]; then ln -sfn "$previous" "$base/current"; else rm -f "$base/current"; fi
  if [ -f "$backup/fs.conf" ]; then cp -p "$backup/fs.conf" /etc/nginx/conf.d/fs.conf; else rm -f /etc/nginx/conf.d/fs.conf; fi
  if [ -f "$backup/fs.service" ]; then cp -p "$backup/fs.service" /etc/systemd/system/fs.service; systemctl daemon-reload; systemctl restart fs || true; else systemctl disable --now fs || true; rm -f /etc/systemd/system/fs.service; systemctl daemon-reload; fi
  nginx -t && systemctl reload nginx || true
  exit 1
}
trap rollback ERR
ln -sfn "$release" "$base/current"
install -m 644 "$release/deploy/fs.service" /etc/systemd/system/fs.service
install -m 644 "$release/deploy/fs.nginx.conf" /etc/nginx/conf.d/fs.conf
nginx -t
systemctl daemon-reload
systemctl enable fs
systemctl restart fs
for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:18081/healthz >/dev/null; then break; fi
  sleep 1
done
curl -fsS http://127.0.0.1:18081/healthz
systemctl enable nginx
if systemctl is-active --quiet nginx; then systemctl reload nginx; else systemctl start nginx; fi
for attempt in $(seq 1 15); do
  if curl -fsS -H 'Host: 47.93.156.196' http://127.0.0.1/healthz >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS -H 'Host: 47.93.156.196' http://127.0.0.1/healthz
systemctl is-enabled fs
systemctl is-active fs
trap - ERR
echo 'fs installed; verify live task API and report group delivery separately.'

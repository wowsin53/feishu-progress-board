#!/usr/bin/env bash
set -u
pwd
ls -ld /opt /opt/fs /etc/nginx /etc/nginx/conf.d 2>/dev/null || true
cat /etc/os-release
uname -m
systemctl list-units --type=service --state=running --no-pager
ss -lntp
if command -v nginx >/dev/null; then
  nginx -t
  nginx -T 2>&1 | awk '/^# configuration file/ || /^[[:space:]]*(listen|server_name|root|include)[[:space:]]/'
fi
command -v node || true
node --version 2>/dev/null || true
command -v npm || true
systemctl status fs --no-pager 2>/dev/null || true
df -h /opt

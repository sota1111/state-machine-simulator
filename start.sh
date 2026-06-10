#!/bin/bash
set -e

# Remove default nginx config that uses port 80
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# Start supervisord (manages both nginx and uvicorn)
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf

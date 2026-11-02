#!/bin/sh
set -eu

if [ -z "${API_URL}" ]; then
  if [ -z "${API_ADDRESS}" ]; then
    echo "oakestra-dashboard: set API_URL (e.g. https://oakestra.example/api) or API_ADDRESS (host:port of the system manager)" >&2
    exit 1
  fi
  API_URL="http://${API_ADDRESS}/api"
fi
export API_URL

case "${ADDONS_POLL_INTERVAL_MS}" in
  '' | *[!0-9]*)
    echo "oakestra-dashboard: ADDONS_POLL_INTERVAL_MS must be a number of milliseconds" >&2
    exit 1
    ;;
esac

# Explicit variable lists: nginx's own $variables in the template must survive untouched.
envsubst '${API_URL} ${UI_ADDONS_URL} ${ADDONS_POLL_INTERVAL_MS} ${GRAFANA_URL} ${ADDONS_MANAGER_URL} ${MARKETPLACE_URL}' \
  < /etc/oakestra/config.json.template > /usr/share/nginx/html/config.json
envsubst '${ADDONS_MANAGER_ADDRESS} ${MARKETPLACE_ADDRESS} ${DNS_RESOLVER}' \
  < /etc/oakestra/nginx.conf.template > /etc/nginx/conf.d/default.conf

exec "$@"

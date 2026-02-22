#!/bin/sh
# Generates /env-config.js with runtime environment variables so the
# prebuilt image can be configured without rebuilding.
cat > /usr/share/nginx/html/env-config.js <<EOF
window._env_ = {
  VITE_SUPABASE_URL: "${VITE_SUPABASE_URL}",
  VITE_SUPABASE_PUBLISHABLE_KEY: "${VITE_SUPABASE_PUBLISHABLE_KEY}",
  VITE_SUPABASE_PROJECT_ID: "${VITE_SUPABASE_PROJECT_ID}"
};
EOF
exec "$@"

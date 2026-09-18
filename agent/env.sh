# Sourced at the top of every shell call in the sandbox (see AGENTS.md).
# The sandbox's only way out is the HTTP proxy in its environment, and Node's
# fetch ignores that proxy unless told.
export NODE_USE_ENV_PROXY=1
if ! command -v isocan >/dev/null 2>&1; then
  echo "installing isocan, once for this sandbox…"
  npm install -g --no-fund --no-audit --loglevel=error github:dglazkov/isocan#release
fi

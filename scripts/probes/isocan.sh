# Spike question 5: isocan in the sandbox, as the agent whose badge only the
# egress proxy holds. Node's fetch ignores the sandbox's proxy unless told.
# Arguments arrive as variables set on the first line by the caller.
HOME_URL=https://dev.isocan.io CANVAS=prj_rdloVvVJHY THREAD=thr__4RiqRsD7E
export NODE_USE_ENV_PROXY=1
set +e
step() { echo; echo "### $1"; shift; local t0=$(date +%s%N); "$@" 2>&1 | cut -c1-300 | tail -12; echo "### exit ${PIPESTATUS[0]}, took $(( ($(date +%s%N) - t0) / 1000000 )) ms"; }
step fetch node -e "fetch('$HOME_URL/api/badges').then(r=>console.log(r.status)).catch(e=>console.log('failed:', e.cause?.code ?? e.message))"
step install npm install -g --no-fund --no-audit --loglevel=error github:dglazkov/isocan#release
step version isocan --version
step direct isocan direct $HOME_URL
step whoami isocan --canvas $CANVAS whoami
step reply isocan --canvas $CANVAS comment reply $THREAD "From Google's sandbox, with no badge in it."
echo "spike" > /tmp/spike.md
step add isocan --canvas $CANVAS add /tmp/spike.md
step ls isocan --canvas $CANVAS ls
echo; echo "### what the sandbox holds"
ls -la ~/.isocan 2>/dev/null

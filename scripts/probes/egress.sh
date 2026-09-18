# What stands between the sandbox and dev.isocan.io when a credential is attached?
echo "### proxy and trust settings"; env | grep -i -E "proxy|ca_cert|ssl_cert|node_extra|node_options" | cut -c1-160
echo "### curl: who signs dev.isocan.io here"
curl -sv -o /dev/null -m 8 https://dev.isocan.io/ 2>&1 | grep -i -E "issuer|subject:|HTTP/|SSL certificate|error|proxy" | head -8
echo "### curl: /api/badges with no header of our own (200 means the proxy added the badge)"
curl -s -m 8 -o /tmp/badges.json -w "%{http_code}\n" https://dev.isocan.io/api/badges; head -c 300 /tmp/badges.json | sed -E 's/"secret":"[^"]*"/"secret":"<hidden>"/g'; echo
echo "### curl: the same with a placeholder bearer of our own"
curl -s -m 8 -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer placeholder.placeholder" https://dev.isocan.io/api/badges
echo "### node fetch, as the isocan CLI would"
node -e "fetch('https://dev.isocan.io/api/badges').then(async r=>console.log(r.status)).catch(e=>console.log('failed:', e.cause?.code ?? e.cause?.message ?? e.message))"
echo "### node fetch with the system trust store"
node --use-system-ca -e "fetch('https://dev.isocan.io/api/badges').then(async r=>console.log(r.status)).catch(e=>console.log('failed:', e.cause?.code ?? e.cause?.message ?? e.message))" 2>&1 | tail -2

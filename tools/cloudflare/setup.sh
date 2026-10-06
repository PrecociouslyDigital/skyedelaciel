#!/usr/bin/env bash
# Sets up Cloudflare for the site: the Pages project and its domain, the www
# redirect, the Access application that keeps scheduled pages to the author,
# and the credentials CI deploys with. Each step looks before it creates, so a
# second run changes nothing except the deploy token, which it rotates.
#
# Needs `cf auth login` and `gh auth login` first. Never run it under `set -x`:
# the deploy token passes through a pipe here, and tracing would print it.
set -euo pipefail
cd "$(dirname "$0")/../.."

# On Windows, PowerShell's `bash` is WSL's, which cannot see these tools.
for tool in node cf gh; do
    if ! command -v "$tool" >/dev/null; then
        echo "setup.sh needs $tool on PATH. On Windows, run it with Git Bash:" >&2
        echo '  & "C:\Program Files\Git\bin\bash.exe" tools/cloudflare/setup.sh' >&2
        exit 1
    fi
done

PRODUCTION_BRANCH=release
APP_NAME="Scheduled pages"
REDIRECT_REF=www-to-apex
REDIRECT_LIST=pages_dev_to_apex

# Prints a JavaScript expression's value over the JSON on stdin, bound to
# `it`. Prints nothing when the value is undefined.
query() {
    node -e '
        let input = "";
        process.stdin.on("data", (chunk) => (input += chunk));
        process.stdin.on("end", () => {
            const it = JSON.parse(input);
            const out = eval(process.argv[1]);
            if (out !== undefined)
                process.stdout.write(typeof out === "string" ? out : JSON.stringify(out));
        });
    ' "$1"
}

project=$(sed -n 's/^name = "\(.*\)"$/\1/p' wrangler.toml)
host=$(sed -n 's/^export const SITE_HOST = "\(.*\)";$/\1/p' src/components/mdx/links/sources.ts)
prefix=$(node --input-type=module -e '
    const { SCHEDULED_PREFIX } = await import("./src/content/schedule.ts");
    process.stdout.write(SCHEDULED_PREFIX);
')
account=$(cf zones list | query "it.find((zone) => zone.name === '$host').account.id")
author=$(cf auth whoami | query "it.email")

# 1. The project, deployed to by upload from CI rather than built by Pages.
if ! cf pages get "$project" >/dev/null 2>&1; then
    cf pages create --name "$project" --production-branch "$PRODUCTION_BRANCH" >/dev/null
fi
# Read back rather than assumed: a name another project once held may have
# been given a suffixed subdomain.
subdomain=$(cf pages get "$project" | query "it.subdomain")

# 2. The apex. A domain added through the API, unlike the dashboard, gets no
# DNS record of its own, and waits as pending until one points it at Pages.
if [ "$(cf pages domains list --project-name "$project" |
    query "it.some((domain) => domain.name === '$host')")" != true ]; then
    cf pages domains create "$project" --name "$host" >/dev/null
fi
if [ "$(cf dns records list --zone "$host" |
    query "it.some((record) => record.name === '$host' && record.type === 'CNAME')")" != true ]; then
    cf dns records create --zone "$host" --body "{
        \"type\": \"CNAME\", \"name\": \"$host\", \"content\": \"$subdomain\", \"proxied\": true
    }" >/dev/null
fi

# 3. www, which already points at the apex through the proxy, redirects there.
# The zone's other redirect rules are kept as they are; a zone with none yet
# answers with an error rather than an empty list, hence the fallback.
redirect=$(cat <<JSON
{
    "ref": "$REDIRECT_REF",
    "description": "www.$host to $host",
    "expression": "(http.host eq \"www.$host\")",
    "action": "redirect",
    "action_parameters": {
        "from_value": {
            "status_code": 301,
            "target_url": { "expression": "concat(\"https://$host\", http.request.uri.path)" },
            "preserve_query_string": true
        }
    }
}
JSON
)
others=$({ cf rulesets account-rulesets phases get http_request_dynamic_redirect --zone "$host" |
    query "it.rules.filter((rule) => rule.ref !== '$REDIRECT_REF').map(
        ({ ref, description, expression, action, action_parameters, enabled }) =>
            ({ ref, description, expression, action, action_parameters, enabled }))"; } 2>/dev/null ||
    echo '[]')
cf rulesets account-rulesets phases update http_request_dynamic_redirect --zone "$host" \
    --body "{\"rules\": $(printf '%s' "$others" | query "[...it, $redirect]")}" >/dev/null

# 4. The project's own pages.dev address redirects to the site, since Pages
# cannot turn it off. Only that host: with subdomains included, as
# Cloudflare's guide has it, every preview would redirect to production too.
# Account-level, as pages.dev is not a zone of this account: a list holding
# the redirect, and a rule that applies the list.
list=$(cf rules lists list | query "it.find((list) => list.name === '$REDIRECT_LIST')?.id")
if [ -z "$list" ]; then
    list=$(cf rules lists create --body "{
        \"name\": \"$REDIRECT_LIST\", \"kind\": \"redirect\",
        \"description\": \"$subdomain to $host\"
    }" | query "it.id")
fi
cf rules lists items update "$list" --body "[{
    \"redirect\": {
        \"source_url\": \"$subdomain/\",
        \"target_url\": \"https://$host/\",
        \"status_code\": 301,
        \"include_subdomains\": false,
        \"subpath_matching\": true,
        \"preserve_path_suffix\": true,
        \"preserve_query_string\": true
    }
}]" >/dev/null
apply_list=$(cat <<JSON
{
    "ref": "$REDIRECT_LIST",
    "description": "Redirects in the $REDIRECT_LIST list",
    "expression": "http.request.full_uri in \$$REDIRECT_LIST",
    "action": "redirect",
    "action_parameters": {
        "from_list": { "name": "$REDIRECT_LIST", "key": "http.request.full_uri" }
    }
}
JSON
)
others=$({ cf rulesets account-rulesets phases get http_request_redirect |
    query "it.rules.filter((rule) => rule.ref !== '$REDIRECT_LIST').map(
        ({ ref, description, expression, action, action_parameters, enabled }) =>
            ({ ref, description, expression, action, action_parameters, enabled }))"; } 2>/dev/null ||
    echo '[]')
cf rulesets account-rulesets phases update http_request_redirect \
    --body "{\"rules\": $(printf '%s' "$others" | query "[...it, $apply_list]")}" >/dev/null

# 5. One Access application for the scheduled prefix, wherever the project is
# served: the site, the project's own pages.dev address, and every preview.
# Without the last two, the prefix would be open by another name.
otp=$(cf zero-trust identity-providers list | query "it.find((idp) => idp.type === 'onetimepin')?.id")
if [ -z "$otp" ]; then
    otp=$(cf zero-trust identity-providers create \
        --body '{"type": "onetimepin", "name": "One-time PIN", "config": {}}' | query "it.id")
fi
app=$(cat <<JSON
{
    "name": "$APP_NAME",
    "type": "self_hosted",
    "destinations": [
        { "type": "public", "uri": "$host/$prefix" },
        { "type": "public", "uri": "$subdomain/$prefix" },
        { "type": "public", "uri": "*.$subdomain" }
    ],
    "allowed_idps": ["$otp"],
    "auto_redirect_to_identity": true,
    "session_duration": "24h",
    "policies": [
        { "name": "Author", "decision": "allow", "include": [{ "email": { "email": "$author" } }] }
    ]
}
JSON
)
existing=$(cf zero-trust access applications list | query "it.find((app) => app.name === '$APP_NAME')?.id")
if [ -n "$existing" ]; then
    cf zero-trust access applications update "$existing" --body "$app" >/dev/null
else
    cf zero-trust access applications create --body "$app" >/dev/null
fi

# 6. CI's credentials. The token goes straight from Cloudflare into GitHub,
# never into a variable or a file, and the tokens it replaces are revoked
# only once it is in place.
token_name="$project deploy"
superseded=$(cf accounts tokens list |
    query "it.filter((token) => token.name === '$token_name').map((token) => token.id).join(' ')")
pages_write=$(cf accounts tokens permission-groups list |
    query "it.find((group) => group.name === 'Pages Write').id")
cf accounts tokens create --name "$token_name" --policies "[{
    \"effect\": \"allow\",
    \"resources\": { \"com.cloudflare.api.account.$account\": \"*\" },
    \"permission_groups\": [{ \"id\": \"$pages_write\" }]
}]" | query "it.value ?? process.exit(1)" | gh secret set CLOUDFLARE_API_TOKEN
for id in $superseded; do
    cf accounts tokens delete "$id" --force >/dev/null
done
printf '%s' "$account" | gh variable set CLOUDFLARE_ACCOUNT_ID

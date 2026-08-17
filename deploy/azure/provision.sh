#!/usr/bin/env bash
#
# Provision Collega's Azure footprint: PostgreSQL Flexible Server, App Service (API),
# and Static Web Apps (Blazor WASM client). Implements SPEC/50-azure-deployment.md —
# read that first; this script is the executable form of §4–§6, not a replacement for it.
#
#   cp deploy/azure/provision.env.example deploy/azure/provision.env   # then edit
#   ./deploy/azure/provision.sh --dry-run     # print every az command, change nothing
#   ./deploy/azure/provision.sh               # provision
#   ./deploy/azure/provision.sh --deploy-api --deploy-client   # ...and push code once
#
# Re-running is safe: every resource is created only if absent, and the token signing key
# is generated once (regenerating it would log every user out).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/deploy/azure/provision.env}"

DRY_RUN=false
DEPLOY_API=false
DEPLOY_CLIENT=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --deploy-api) DEPLOY_API=true ;;
    --deploy-client) DEPLOY_CLIENT=true ;;
    -h|--help) sed -n '3,15p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

# ---------------------------------------------------------------- helpers --

note() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[33m  ! %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

# Runs an az command, or prints a redacted form of it under --dry-run. Credentials
# reach az through argv, so the dry-run printer must mask them: a dry run is the one
# mode whose output people paste into tickets and chat windows.
run() {
  if $DRY_RUN; then
    printf '  [dry-run] %s\n' "$(redact "$@")"
  else
    "$@"
  fi
}

# Masks secret-bearing arguments: the value following a credential flag, and the
# right-hand side of a KEY=VALUE app setting whose key names a secret.
redact() {
  local out=() mask_next=false arg
  for arg in "$@"; do
    if $mask_next; then
      out+=("<redacted>")
      mask_next=false
      continue
    fi
    case "$arg" in
      --admin-password|--deployment-token|--password)
        out+=("$arg"); mask_next=true ;;
      ConnectionStrings__*=*|SiteAdmin__Password=*|Auth__TokenSigningKey=*|Ai__ApiKey=*)
        out+=("${arg%%=*}=<redacted>") ;;
      *)
        out+=("$arg") ;;
    esac
  done
  printf '%s' "${out[*]}"
}

# Existence probes return false under --dry-run for the resources we would have
# created, so a dry run shows the full create path rather than a half-skipped one.
exists() {
  if $DRY_RUN; then return 1; fi
  "$@" >/dev/null 2>&1
}

require_var() {
  local name="$1"
  local value="${!name:-}"
  [[ -n "$value" && "$value" != "CHANGE-ME" ]] || die "$name is unset (or still CHANGE-ME) in $ENV_FILE"
}

# ------------------------------------------------------------- preflight ---

note "Preflight"

command -v az >/dev/null || die "Azure CLI not found. Install it (brew install azure-cli) and run: az login"
command -v dotnet >/dev/null || die ".NET SDK not found; global.json pins 8.0.118 with latestFeature roll-forward"

az account show >/dev/null 2>&1 || die "Not signed in. Run: az login"

[[ -f "$ENV_FILE" ]] || die "missing $ENV_FILE — copy provision.env.example and fill it in"
# shellcheck source=/dev/null
set -a; source "$ENV_FILE"; set +a

for v in LOC SWA_LOC RG PG_SERVER PG_DB PG_ADMIN API_PLAN API_APP API_SKU SWA_NAME \
         PG_PASSWORD SITEADMIN_EMAIL SITEADMIN_PASSWORD; do
  require_var "$v"
done

SUBSCRIPTION="$(az account show --query name -o tsv)"
SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
echo "  subscription : $SUBSCRIPTION ($SUBSCRIPTION_ID)"
echo "  resource grp : $RG in $LOC   (Static Web App in $SWA_LOC)"
echo "  api          : $API_APP on $API_PLAN ($API_SKU)"
echo "  database     : $PG_SERVER / $PG_DB"
[[ -n "${AI_API_KEY:-}" ]] || warn "AI_API_KEY is empty — AI idea assist will run dark (supported; the API still boots)"

if ! $DRY_RUN; then
  read -r -p "  Proceed against this subscription? [y/N] " confirm
  [[ "$confirm" == "y" || "$confirm" == "Y" ]] || die "aborted"
fi

# A fresh subscription has these providers unregistered; registration is idempotent
# and async, and the creates below fail with a clear message if it hasn't landed yet.
note "Registering resource providers (no-op if already registered)"
for ns in Microsoft.DBforPostgreSQL Microsoft.Web; do
  run az provider register --namespace "$ns" --wait
done

# ------------------------------------------------------- resource group ----

note "Resource group: $RG"
if [[ "$(az group exists --name "$RG" 2>/dev/null)" == "true" ]]; then
  echo "  already exists"
else
  run az group create --name "$RG" --location "$LOC" -o none
fi

# ------------------------------------------------------------ database ----

note "PostgreSQL Flexible Server: $PG_SERVER"
if exists az postgres flexible-server show --resource-group "$RG" --name "$PG_SERVER"; then
  echo "  already exists — leaving tier, storage and firewall as-is"
else
  # --public-access 0.0.0.0 is the "allow other Azure services" rule (App Service),
  # not the public internet. For production prefer VNet integration — spec §8.
  run az postgres flexible-server create \
    --name "$PG_SERVER" --resource-group "$RG" --location "$LOC" \
    --admin-user "$PG_ADMIN" --admin-password "$PG_PASSWORD" \
    --tier Burstable --sku-name Standard_B1ms \
    --version 16 --storage-size 32 \
    --public-access 0.0.0.0 \
    --yes -o none
fi

note "Database: $PG_DB"
if exists az postgres flexible-server db show --resource-group "$RG" --server-name "$PG_SERVER" --database-name "$PG_DB"; then
  echo "  already exists"
else
  run az postgres flexible-server db create \
    --resource-group "$RG" --server-name "$PG_SERVER" --database-name "$PG_DB" -o none
fi

PG_HOST="$PG_SERVER.postgres.database.azure.com"
CONN="Host=$PG_HOST;Port=5432;Database=$PG_DB;Username=$PG_ADMIN;Password=$PG_PASSWORD;Ssl Mode=Require;Trust Server Certificate=true"

# ----------------------------------------------------------------- api ----

note "App Service plan: $API_PLAN ($API_SKU, Linux)"
if exists az appservice plan show --resource-group "$RG" --name "$API_PLAN"; then
  echo "  already exists"
else
  run az appservice plan create \
    --name "$API_PLAN" --resource-group "$RG" --location "$LOC" \
    --is-linux --sku "$API_SKU" -o none
fi

note "Web app: $API_APP"
if exists az webapp show --resource-group "$RG" --name "$API_APP"; then
  echo "  already exists"
else
  run az webapp create \
    --name "$API_APP" --resource-group "$RG" --plan "$API_PLAN" \
    --runtime "DOTNETCORE:8.0" -o none
fi
run az webapp update --name "$API_APP" --resource-group "$RG" --https-only true -o none

API_URL="https://$API_APP.azurewebsites.net"

# The signing key must survive restarts: if it is unset the API generates a random one
# per process and every restart or scale-out invalidates all issued tokens.
note "Auth token signing key"
EXISTING_KEY=""
if ! $DRY_RUN; then
  EXISTING_KEY="$(az webapp config appsettings list --name "$API_APP" --resource-group "$RG" \
    --query "[?name=='Auth__TokenSigningKey'].value | [0]" -o tsv 2>/dev/null || true)"
fi
if [[ -n "$EXISTING_KEY" && "$EXISTING_KEY" != "null" ]]; then
  echo "  already set — preserving it (regenerating would log every user out)"
  SIGNING_KEY="$EXISTING_KEY"
else
  SIGNING_KEY="$(openssl rand -base64 32)"
  echo "  generated a new 32-byte key"
fi

note "Application settings"
SETTINGS=(
  "ASPNETCORE_ENVIRONMENT=Production"
  "ConnectionStrings__DefaultConnection=$CONN"
  "SiteAdmin__Email=$SITEADMIN_EMAIL"
  "SiteAdmin__Password=$SITEADMIN_PASSWORD"
  "Auth__TokenSigningKey=$SIGNING_KEY"
)
[[ -n "${AI_API_KEY:-}" ]] && SETTINGS+=("Ai__ApiKey=$AI_API_KEY")

if $DRY_RUN; then
  echo "  [dry-run] az webapp config appsettings set --name $API_APP --resource-group $RG --settings <5-6 settings, values redacted>"
else
  az webapp config appsettings set --name "$API_APP" --resource-group "$RG" \
    --settings "${SETTINGS[@]}" -o none
fi

# ------------------------------------------------------------ frontend ----

note "Static Web App: $SWA_NAME ($SWA_LOC, Free)"
if exists az staticwebapp show --resource-group "$RG" --name "$SWA_NAME"; then
  echo "  already exists"
else
  # Deliberately no --source: the repo already has .github/workflows/deploy-client.yml,
  # and --source would make Azure generate a second, competing workflow.
  run az staticwebapp create \
    --name "$SWA_NAME" --resource-group "$RG" --location "$SWA_LOC" --sku Free -o none
fi

if $DRY_RUN; then
  SWA_HOST="<swa-host>.azurestaticapps.net"
else
  SWA_HOST="$(az staticwebapp show --name "$SWA_NAME" --resource-group "$RG" --query defaultHostname -o tsv)"
fi

note "CORS: allow https://$SWA_HOST on the API"
run az webapp config appsettings set --name "$API_APP" --resource-group "$RG" \
  --settings "Cors__AllowedOrigins__0=https://$SWA_HOST" -o none

# The WASM client reads its API base URL at runtime from this file, so it is a repo
# edit that must be committed — not a build input the pipeline can inject.
CLIENT_CONFIG="$REPO_ROOT/src/Collega.Client/wwwroot/appsettings.Production.json"
note "Client API base URL"
if grep -q "REPLACE-WITH-API-APP-NAME" "$CLIENT_CONFIG"; then
  if $DRY_RUN; then
    echo "  [dry-run] would set Api.BaseUrl to $API_URL in $CLIENT_CONFIG"
  else
    tmp="$(mktemp)"
    sed "s|https://REPLACE-WITH-API-APP-NAME.azurewebsites.net|$API_URL|" "$CLIENT_CONFIG" > "$tmp"
    mv "$tmp" "$CLIENT_CONFIG"
    echo "  set to $API_URL — COMMIT THIS FILE, the client is broken without it"
  fi
else
  echo "  already points at $(grep -o 'https://[^"]*' "$CLIENT_CONFIG" | head -1)"
fi

# ------------------------------------------------- optional first deploy ---

if $DEPLOY_API; then
  note "Publishing and deploying the API"
  run dotnet publish "$REPO_ROOT/src/Collega.API/Collega.API.csproj" -c Release -o "$REPO_ROOT/publish"
  if ! $DRY_RUN; then
    (cd "$REPO_ROOT/publish" && zip -qr "$REPO_ROOT/collega-api.zip" .)
  fi
  run az webapp deploy --name "$API_APP" --resource-group "$RG" \
    --type zip --src-path "$REPO_ROOT/collega-api.zip" -o none
fi

if $DEPLOY_CLIENT; then
  note "Publishing and deploying the client"
  run dotnet publish "$REPO_ROOT/src/Collega.Client/Collega.Client.csproj" -c Release -o "$REPO_ROOT/client-publish"
  if $DRY_RUN; then
    echo "  [dry-run] npx @azure/static-web-apps-cli deploy ./client-publish/wwwroot --deployment-token <token>"
  else
    token="$(az staticwebapp secrets list --name "$SWA_NAME" --resource-group "$RG" --query properties.apiKey -o tsv)"
    npx --yes @azure/static-web-apps-cli deploy "$REPO_ROOT/client-publish/wwwroot" --deployment-token "$token"
  fi
fi

# ----------------------------------------------------------------- next ----

note "Done"
cat <<EOF

  API       : $API_URL
  Frontend  : https://$SWA_HOST
  Database  : $PG_HOST / $PG_DB

  GitHub Actions setup (SPEC/50-azure-api-cicd.md) — both pipelines trigger on 'main':

    gh variable set AZURE_WEBAPP_NAME --body "$API_APP"
    az webapp deployment list-publishing-profiles --name $API_APP --resource-group $RG --xml \\
      | gh secret set AZURE_WEBAPP_PUBLISH_PROFILE
    az staticwebapp secrets list --name $SWA_NAME --resource-group $RG --query properties.apiKey -o tsv \\
      | gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN

  Then verify (spec §7):

    curl -i $API_URL/api/v1/organizations      # 401 means up and auth is wired; 404/500 means not
    az webapp log tail --name $API_APP --resource-group $RG

  Cost control: az postgres flexible-server stop --resource-group $RG --name $PG_SERVER
  Teardown    : az group delete --name $RG --yes --no-wait

EOF

#!/usr/bin/env bash
# Apply SaaS Keycloak login theme (white background) on a running instance.
# Usage: npm run keycloak:bootstrap
#        KEYCLOAK_URL=http://localhost:8090 ./keycloak/bootstrap/bootstrap-keycloak.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Load only auth/social keys (full `source .env` breaks on unquoted spaces).
if [[ -f "${ROOT}/.env" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^(KEYCLOAK|GOOGLE|FACEBOOK|FRONTEND|AUTH_KEYCLOAK)_?[A-Z0-9_]*= ]] || continue
    key="${line%%=*}"
    val="${line#*=}"
    val="${val%$'\r'}"
    # Strip matching single/double quotes
    if [[ "$val" =~ ^\".*\"$ || "$val" =~ ^\'.*\'$ ]]; then
      val="${val:1:-1}"
    fi
    export "$key=$val"
  done <"${ROOT}/.env"
fi

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8090}"
KEYCLOAK_ADMIN_URL="${KEYCLOAK_ADMIN_URL:-$KEYCLOAK_URL}"
KEYCLOAK_ADMIN_USER="${KEYCLOAK_ADMIN_USER:-admin}"
KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-saas-realm}"
KEYCLOAK_LOGIN_THEME="${KEYCLOAK_LOGIN_THEME:-saas-light}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}"
GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}"
FACEBOOK_CLIENT_ID="${FACEBOOK_CLIENT_ID:-}"
FACEBOOK_CLIENT_SECRET="${FACEBOOK_CLIENT_SECRET:-}"

echo "==> Waiting for Keycloak at ${KEYCLOAK_ADMIN_URL}…"
for i in $(seq 1 60); do
  if curl -sf "${KEYCLOAK_ADMIN_URL}/realms/master" >/dev/null 2>&1; then
    echo "    ready (${i})"
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    echo "Keycloak not reachable after 60 attempts" >&2
    exit 1
  fi
  sleep 2
done

echo "==> Obtaining admin token…"
TOKEN="$(
  curl -sf -X POST "${KEYCLOAK_ADMIN_URL}/realms/master/protocol/openid-connect/token" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -d "client_id=admin-cli" \
    -d "username=${KEYCLOAK_ADMIN_USER}" \
    -d "password=${KEYCLOAK_ADMIN_PASSWORD}" \
    -d "grant_type=password" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])"
)"

echo "==> Configuring realm '${KEYCLOAK_REALM}' (theme + registration + token TTL 1h)…"
TMP_REALM="$(mktemp)"
TMP_PATCH="$(mktemp)"
trap 'rm -f "$TMP_REALM" "$TMP_PATCH"' EXIT

curl -sf -H "Authorization: Bearer ${TOKEN}" \
  "${KEYCLOAK_ADMIN_URL}/admin/realms/${KEYCLOAK_REALM}" >"$TMP_REALM"

python3 - "$TMP_REALM" "$TMP_PATCH" "$KEYCLOAK_LOGIN_THEME" <<'PY'
import json, sys
src, dst, theme = sys.argv[1], sys.argv[2], sys.argv[3]
with open(src, encoding="utf-8") as f:
    realm = json.load(f)
realm["loginTheme"] = theme
realm["registrationAllowed"] = True
realm["resetPasswordAllowed"] = True
realm["loginWithEmailAllowed"] = True
realm["duplicateEmailsAllowed"] = False
# Access token + aligned session idle = 1 hour
realm["accessTokenLifespan"] = 3600
realm["accessTokenLifespanForImplicitFlow"] = 3600
realm["ssoSessionIdleTimeout"] = 3600
realm["ssoSessionMaxLifespan"] = 36000
realm["clientSessionIdleTimeout"] = 3600
realm["clientSessionMaxLifespan"] = 36000
with open(dst, "w", encoding="utf-8") as f:
    json.dump(realm, f)
print(f"loginTheme -> {theme}")
print("registrationAllowed -> True")
print("accessTokenLifespan -> 3600s (1h)")
print("ssoSessionIdleTimeout -> 3600s (1h)")
PY

HTTP="$(
  curl -s -o /tmp/kc-bootstrap-out -w '%{http_code}' -X PUT \
    -H "Authorization: Bearer ${TOKEN}" \
    -H 'Content-Type: application/json' \
    --data-binary @"${TMP_PATCH}" \
    "${KEYCLOAK_ADMIN_URL}/admin/realms/${KEYCLOAK_REALM}"
)"

if [[ "$HTTP" != "204" && "$HTTP" != "200" ]]; then
  echo "Failed to update realm (HTTP ${HTTP}):" >&2
  cat /tmp/kc-bootstrap-out >&2 || true
  exit 1
fi

echo "==> Restricting assignable roles to USER + ADMIN (ADMIN composites account/realm-management)…"
python3 - "$KEYCLOAK_ADMIN_URL" "$KEYCLOAK_REALM" "$TOKEN" <<'PY'
import json, sys, urllib.request, urllib.error

base, realm, token = sys.argv[1], sys.argv[2], sys.argv[3]
KEEP = {"USER", "ADMIN"}
ADMIN_CLIENTS = ("account", "realm-management", "broker")

def req(method, path, data=None):
    url = f"{base}{path}"
    body = None if data is None else json.dumps(data).encode()
    r = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(r, timeout=30) as res:
            raw = res.read()
            return res.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")

def client_uuid(client_id):
    st, data = req("GET", f"/admin/realms/{realm}/clients?clientId={client_id}")
    if st != 200 or not data:
        return None
    return data[0]["id"]

# default-roles-* → USER only (no account client roles)
default_name = f"default-roles-{realm}"
st, default_role = req("GET", f"/admin/realms/{realm}/roles/{default_name}")
if st != 200:
    print(f"    skip default role ({st})")
    raise SystemExit(0)

did = default_role["id"]
_, composites = req("GET", f"/admin/realms/{realm}/roles-by-id/{did}/composites")
composites = composites or []
to_remove = [c for c in composites if c.get("name") != "USER"]
if to_remove:
    req("DELETE", f"/admin/realms/{realm}/roles-by-id/{did}/composites", to_remove)
    print(f"    removed from default: {[c['name'] for c in to_remove]}")

_, composites = req("GET", f"/admin/realms/{realm}/roles-by-id/{did}/composites")
names = {c.get("name") for c in (composites or [])}
if "USER" not in names:
    _, user_role = req("GET", f"/admin/realms/{realm}/roles/USER")
    req("POST", f"/admin/realms/{realm}/roles-by-id/{did}/composites", [user_role])
    print("    USER added to default roles")
else:
    print("    default roles = USER only")

# ADMIN = composite of USER + all account/realm-management/broker client roles
_, admin_role = req("GET", f"/admin/realms/{realm}/roles/ADMIN")
_, user_role = req("GET", f"/admin/realms/{realm}/roles/USER")
admin_composites = [user_role]
for client_id in ADMIN_CLIENTS:
    cid = client_uuid(client_id)
    if not cid:
        print(f"    missing client {client_id}")
        continue
    _, croles = req("GET", f"/admin/realms/{realm}/clients/{cid}/roles")
    admin_composites.extend(croles or [])

_, current = req("GET", f"/admin/realms/{realm}/roles-by-id/{admin_role['id']}/composites")
if current:
    req("DELETE", f"/admin/realms/{realm}/roles-by-id/{admin_role['id']}/composites", current)
st, _ = req("POST", f"/admin/realms/{realm}/roles-by-id/{admin_role['id']}/composites", admin_composites)
print(f"    ADMIN composites set ({len(admin_composites)} roles) HTTP {st}")

# Drop leftover custom realm roles (keep USER/ADMIN/default-roles-*)
_, all_roles = req("GET", f"/admin/realms/{realm}/roles")
for role in all_roles or []:
    name = role.get("name") or ""
    if name in KEEP or name.startswith("default-roles-"):
        continue
    st, body = req("DELETE", f"/admin/realms/{realm}/roles/{name}")
    print(f"    delete {name}: HTTP {st}")

# Normalize user mappings: realm USER/ADMIN only; strip direct client role assignments
_, users = req("GET", f"/admin/realms/{realm}/users?max=500")
for user in users or []:
    uid, uname = user["id"], user.get("username")
    _, roles = req("GET", f"/admin/realms/{realm}/users/{uid}/role-mappings/realm")
    roles = roles or []
    remove = [r for r in roles if r.get("name") not in KEEP]
    if remove:
        req("DELETE", f"/admin/realms/{realm}/users/{uid}/role-mappings/realm", remove)
    have = {r.get("name") for r in roles} - {r.get("name") for r in remove}
    if "USER" not in have:
        req("POST", f"/admin/realms/{realm}/users/{uid}/role-mappings/realm", [user_role])
    if uname == "admin" and "ADMIN" not in have:
        req("POST", f"/admin/realms/{realm}/users/{uid}/role-mappings/realm", [admin_role])

    # Remove direct client-role assignments (they come via ADMIN composite instead)
    for client_id in ADMIN_CLIENTS:
        cid = client_uuid(client_id)
        if not cid:
            continue
        _, assigned = req(
            "GET",
            f"/admin/realms/{realm}/users/{uid}/role-mappings/clients/{cid}",
        )
        if assigned:
            req(
                "DELETE",
                f"/admin/realms/{realm}/users/{uid}/role-mappings/clients/{cid}",
                assigned,
            )
            print(f"    user {uname}: removed direct {client_id} roles {[r['name'] for r in assigned]}")
    print(f"    user {uname}: realm roles cleaned")

_, all_roles = req("GET", f"/admin/realms/{realm}/roles")
print("    remaining realm roles:", [r.get("name") for r in (all_roles or [])])
_, after = req("GET", f"/admin/realms/{realm}/roles-by-id/{admin_role['id']}/composites")
print("    ADMIN implies:", sorted({c.get("name") for c in (after or [])})[:8], "...")
PY

AUTH_KEYCLOAK_SECRET="${AUTH_KEYCLOAK_SECRET:-saas-web-secret-change-me}"

echo "==> Configuring unified saas-web client, social IdPs and redirects…"
python3 - "$KEYCLOAK_ADMIN_URL" "$KEYCLOAK_REALM" "$TOKEN" \
  "$KEYCLOAK_URL" "$FRONTEND_URL" \
  "$GOOGLE_CLIENT_ID" "$GOOGLE_CLIENT_SECRET" \
  "$FACEBOOK_CLIENT_ID" "$FACEBOOK_CLIENT_SECRET" \
  "$AUTH_KEYCLOAK_SECRET" <<'PY'
import json, sys, urllib.request, urllib.error

base, realm, token = sys.argv[1], sys.argv[2], sys.argv[3]
public_keycloak_url, frontend_url = sys.argv[4].rstrip("/"), sys.argv[5].rstrip("/")
google_id, google_secret = sys.argv[6], sys.argv[7]
facebook_id, facebook_secret = sys.argv[8], sys.argv[9]
client_secret = sys.argv[10]

def req(method, path, data=None):
    url = f"{base}{path}"
    body = None if data is None else json.dumps(data).encode()
    r = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(r, timeout=30) as res:
            raw = res.read()
            return res.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")

def find_client(client_id):
    st, data = req("GET", f"/admin/realms/{realm}/clients?clientId={client_id}")
    if st != 200 or not data:
        return None
    return data[0]

def delete_legacy_client():
    old = find_client("saas-api")
    if old:
        st, _ = req("DELETE", f"/admin/realms/{realm}/clients/{old['id']}")
        print(f"    deleted legacy saas-api client HTTP {st}")

def update_client():
    client = find_client("saas-web")
    if not client:
        print("    saas-web client not found; skip")
        return
    cid = client["id"]
    client["publicClient"] = False
    client["serviceAccountsEnabled"] = False
    client["standardFlowEnabled"] = True
    client["directAccessGrantsEnabled"] = True
    callback = f"{frontend_url}/api/auth/callback/keycloak"
    client["redirectUris"] = sorted({f"{frontend_url}/*", callback})
    client["webOrigins"] = sorted({frontend_url})
    attrs = client.get("attributes") or {}
    attrs["post.logout.redirect.uris"] = f"{frontend_url}/*##{frontend_url}/"
    client["attributes"] = attrs
    st, _ = req("PUT", f"/admin/realms/{realm}/clients/{cid}", client)
    print(f"    saas-web: confidential, redirects updated HTTP {st}")
    # Set client secret via dedicated endpoint
    st2, body = req("POST", f"/admin/realms/{realm}/clients/{cid}/client-secret", {})
    # Now retrieve the generated secret
    st3, secret_data = req("GET", f"/admin/realms/{realm}/clients/{cid}/client-secret")
    kc_secret = secret_data.get("value", "") if isinstance(secret_data, dict) else ""
    if client_secret and client_secret != kc_secret:
        # Keycloak doesn't allow setting an arbitrary secret via API;
        # we must use whatever it generates, or set it via realm import.
        # Workaround: re-import with the desired secret using the internal representation.
        client["secret"] = client_secret
        st4, _ = req("PUT", f"/admin/realms/{realm}/clients/{cid}", client)
        # Verify
        st5, verify = req("GET", f"/admin/realms/{realm}/clients/{cid}/client-secret")
        final_secret = verify.get("value", "") if isinstance(verify, dict) else ""
        if final_secret == client_secret:
            print(f"    saas-web: secret set to desired value")
        else:
            print(f"    saas-web: WARNING secret={final_secret} (wanted {client_secret})")
            print(f"    → Update AUTH_KEYCLOAK_SECRET={final_secret} in .env")
    else:
        print(f"    saas-web: secret OK")

def update_idp(alias, client_id, client_secret, enabled_when_secret=True):
    st, idp = req("GET", f"/admin/realms/{realm}/identity-provider/instances/{alias}")
    if st != 200 or not isinstance(idp, dict):
        print(f"    {alias}: not found (HTTP {st})")
        return
    cfg = idp.get("config") or {}
    cfg["clientId"] = client_id
    cfg["clientSecret"] = client_secret
    idp["config"] = cfg
    idp["enabled"] = bool(client_id and client_secret) if enabled_when_secret else True
    st, _ = req(
        "PUT",
        f"/admin/realms/{realm}/identity-provider/instances/{alias}",
        idp,
    )
    status = "enabled" if idp["enabled"] else "disabled"
    print(f"    {alias}: credentials synced ({status}) HTTP {st}")
    print(
        f"    {alias} redirect URI: "
        f"{public_keycloak_url}/realms/{realm}/broker/{alias}/endpoint"
    )

delete_legacy_client()
update_client()
update_idp("google", google_id, google_secret)
update_idp("facebook", facebook_id, facebook_secret)
PY

curl -sf -X POST -H "Authorization: Bearer ${TOKEN}" \
  "${KEYCLOAK_ADMIN_URL}/admin/realms/${KEYCLOAK_REALM}/clear-realm-cache" >/dev/null 2>&1 || true
curl -sf -X POST -H "Authorization: Bearer ${TOKEN}" \
  "${KEYCLOAK_ADMIN_URL}/admin/realms/${KEYCLOAK_REALM}/clear-user-cache" >/dev/null 2>&1 || true

VERIFY="$(
  curl -sf -H "Authorization: Bearer ${TOKEN}" \
    "${KEYCLOAK_ADMIN_URL}/admin/realms/${KEYCLOAK_REALM}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('loginTheme'), d.get('registrationAllowed'), d.get('accessTokenLifespan'))"
)"

echo "==> Done. loginTheme/registrationAllowed/accessTokenLifespan=${VERIFY}"
echo "    Theme dir must be mounted: ./keycloak/themes → /opt/keycloak/themes"
echo "    Registration: enabled (frontend button → Keycloak /registrations)"
echo "    Access token TTL: 3600s (1h) — reconnect after bootstrap to get a new token"

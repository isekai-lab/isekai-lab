locals { private_hostname = "${var.worker_name}.${var.workers_dev_subdomain}.workers.dev" }

resource "cloudflare_zero_trust_access_identity_provider" "email_otp" {
  account_id = var.account_id
  name       = "Email one-time PIN"
  type       = "onetimepin"
  config     = {}
}
resource "cloudflare_zero_trust_access_policy" "owner_only" {
  account_id = var.account_id
  name       = "Private games: owner only"
  decision   = "allow"
  include    = [{ email = { email = var.owner_email } }]
}
# Hostname targeting protects the URL before the Worker exists; a Worker target
# requires a Worker UUID, which would create an unprotected first-upload window.
resource "cloudflare_zero_trust_access_application" "private_games" {
  account_id                = var.account_id
  name                      = "Private games"
  type                      = "self_hosted"
  domain                    = local.private_hostname
  allowed_idps              = [cloudflare_zero_trust_access_identity_provider.email_otp.id]
  auto_redirect_to_identity = true
  app_launcher_visible      = false
  session_duration          = "24h"
  policies                  = [{ id = cloudflare_zero_trust_access_policy.owner_only.id, precedence = 1 }]
}

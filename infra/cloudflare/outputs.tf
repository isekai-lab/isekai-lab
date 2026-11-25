output "private_hostname" { value = local.private_hostname }
output "account_id" {
  value     = var.account_id
  sensitive = true
}
output "access_audience" { value = cloudflare_zero_trust_access_application.private_games.aud }
output "access_team_domain" { value = var.access_team_domain }
output "worker_name" { value = var.worker_name }
output "owner_email" {
  value     = var.owner_email
  sensitive = true
}

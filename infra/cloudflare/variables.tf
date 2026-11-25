variable "account_id" {
  description = "Cloudflare account ID."
  type        = string
  sensitive   = true
}
variable "workers_dev_subdomain" {
  description = "Already-registered account workers.dev subdomain, without .workers.dev."
  type        = string
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.workers_dev_subdomain))
    error_message = "Use a lowercase workers.dev subdomain without its suffix."
  }
}
variable "worker_name" {
  description = "Worker script name. Terraform never manages this Worker or its content."
  type        = string
  default     = "tensei-private-games"
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.worker_name))
    error_message = "Use lowercase letters, digits, and hyphens."
  }
}
variable "owner_email" {
  description = "Only this Access identity may retrieve game assets."
  type        = string
  sensitive   = true
}
variable "access_team_domain" {
  description = "Existing Zero Trust team domain, e.g. example.cloudflareaccess.com."
  type        = string
  validation {
    condition     = can(regex("^[a-z0-9-]+\\.cloudflareaccess\\.com$", var.access_team_domain))
    error_message = "Use an existing <team>.cloudflareaccess.com hostname."
  }
}

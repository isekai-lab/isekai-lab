# Private Cloudflare deployment

Terraform manages only the Zero Trust Access identity provider, owner-only policy,
and hostname application. Wrangler owns the Worker script and static assets. This
prevents Terraform from racing or replacing uploaded game content.

The protected hostname is `<worker_name>.<workers_dev_subdomain>.workers.dev`.
The hostname Access application is deliberately created before the first Worker
upload: it does not require a Worker UUID. Do not upload the Worker until
`terraform apply` has succeeded.

## Local setup and deploy

If handing off execution to an agent, copy `.env.local.example` to ignored
`.env.local`, fill the token locally, and keep that file private. Use
`npm run cf:with-env -- <command> ...` to load it into the child process's
environment without putting the token in command arguments or chat. For example:

```sh
npm run cf:with-env -- terraform -chdir=infra/cloudflare plan
npm run cf:with-env -- npm run cf:deploy:private
```

For `pass`, leave `CLOUDFLARE_API_TOKEN` empty and set
`CLOUDFLARE_API_TOKEN_PASS_ENTRY` to the password-store entry in `.env.local`.
The wrapper runs `pass show` without a shell, reads only the first line, and
passes it to the child environment without saving or printing the token.
An explicitly supplied `CLOUDFLARE_API_TOKEN` takes precedence. Shell command
substitution such as `$(pass ...)` is not evaluated inside an env file.

Use an API token only through `CLOUDFLARE_API_TOKEN`; never put it in tfvars,
Wrangler config, arguments, commits, or logs. Copy `terraform.tfvars.example` to
the ignored `terraform.tfvars` and replace its dummy values.

```zsh
read -rs "CLOUDFLARE_API_TOKEN?Cloudflare API token: "
echo
export CLOUDFLARE_API_TOKEN
export CLOUDFLARE_ACCOUNT_ID='account-id'
export CLOUDFLARE_WORKERS_SUBDOMAIN='chosen-subdomain'
npm run cf:bootstrap-subdomain
terraform -chdir=infra/cloudflare init
terraform -chdir=infra/cloudflare apply
npm run cf:deploy:private
```

`cf:bootstrap-subdomain` first reads the account's workers.dev subdomain. It
registers the requested subdomain only if one does not exist, and stops rather
than changing an existing different value. It does not create or upload a
Worker. Set the same chosen subdomain in `terraform.tfvars`; use the same
account ID in its `account_id` field and `CLOUDFLARE_ACCOUNT_ID` before bootstrapping.

`cf:prepare` reads Terraform outputs and writes an ignored `infra/cloudflare/.generated/`
Wrangler config. It supplies the Access audience, expected hostname, existing
team domain, owner email, and Terraform account ID to the Worker. It is intentionally generated only
after Access exists. The generated config explicitly sets `workers_dev: true`,
`preview_urls: false`, and static
assets `run_worker_first: true`.

## Defense in depth

The Worker never uses `ctx.access` (the static-assets router does not forward
it). Before `ASSETS.fetch`, it requires the exact production hostname and a
Cloudflare Access JWT with an RS256 signature from the team JWKS, matching
issuer, audience, required `exp` and `email` claims, and exact owner email.
Malformed configuration returns 503; missing, invalid, expired, wrong-audience,
wrong-email, or unverifiable JWTs return 403. None may fetch an asset.

Run `npm run cf:check` for the game build, type check, and local cryptographic
tests. Run `npm run cf:terraform:check` after `terraform init` for HCL formatting
and provider schema validation. A real deploy needs the account's Zero Trust
organization to have been onboarded already; this configuration intentionally
does not create or alter that organization.

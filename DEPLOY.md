# Deploy — AWS App Runner

The container ships everything `/api/run` and `/api/run-map` need at runtime: Node 20, Python 3, Semgrep 1.157.0, and the registry / sample codebase / scripts directories.

## One-time setup

### 1. Create an ECR repository

```bash
aws ecr create-repository \
  --repository-name compliance-mapping-demo \
  --region us-east-1 \
  --image-scanning-configuration scanOnPush=true
```

Save the repository URI (`<account-id>.dkr.ecr.us-east-1.amazonaws.com/compliance-mapping-demo`).

### 2. Add GitHub secrets

In `Settings → Secrets and variables → Actions`, add:

| Secret | Value |
|---|---|
| `AWS_REGION` | `us-east-1` (or your region) |
| `ECR_REPOSITORY` | `compliance-mapping-demo` |
| `AWS_ACCESS_KEY_ID` | IAM user with `AmazonEC2ContainerRegistryPowerUser` |
| `AWS_SECRET_ACCESS_KEY` | matching secret |

The first push to `main` triggers `.github/workflows/deploy.yml`, which builds the Dockerfile and pushes both `:latest` and `:<short-sha>` tags to ECR.

### 3. Create the App Runner service

In the AWS console (App Runner → Create service):

1. **Source:** Container registry → Amazon ECR → pick the repo, `latest` tag.
2. **Deployment trigger:** Automatic — App Runner re-deploys whenever a new image with the chosen tag is pushed.
3. **Service name:** `compliance-mapping-demo`.
4. **Instance configuration:** 0.5 vCPU / 1 GB RAM is enough; Semgrep is the heaviest tenant of the request path and finishes in seconds against the small codebase.
5. **Port:** `8080`.
6. **Environment variables:**
   - `ANTHROPIC_API_KEY` — paste the key. App Runner stores it encrypted.
   - (Optional) `CLAUDE_MODEL` — defaults to `claude-opus-4-7`. Set to `claude-sonnet-4-6` if you want the faster fallback by default.
7. **Health check:** HTTP `/` is fine — the homepage returns 200 even before any run.
8. **Auto scaling:** 1 min, 1 max for a demo. App Runner will scale a single instance up to your max if traffic warrants.

Click create. First deploy takes ~5 minutes (image pull + warm-up).

## Iterating

Every push to `main` triggers a fresh image build and push. App Runner picks up the new image automatically (per the deployment trigger above). Watch progress under the service's **Activity** tab.

## Local development

```bash
npm install
cp .env.example .env.local      # add ANTHROPIC_API_KEY
npm run dev
```

`semgrep` and `python3` need to be on `$PATH`. On macOS:

```bash
brew install semgrep python@3.12
```

## Cost notes

App Runner bills for both **idle** (provisioned baseline) and **active** (request handling) compute. At the recommended 0.5 vCPU / 1 GB RAM with min instance = 1, expect ~$15–25 / month idle. If you set min instance = 0 and accept cold starts, idle drops to $0 but the first request after idle takes ~30s.

# GitHub OIDC → AWS Setup Guide

This documents the one-time setup required to enable GitHub Actions to deploy to each AWS account using OIDC (no static access keys).

## Why OIDC?

Instead of storing long-lived `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in GitHub Secrets:

- GitHub Actions gets a **short-lived token** per workflow run
- No secret rotation needed
- Fine-grained: scoped to specific repo, branch, and environment
- AWS CloudTrail logs show the GitHub workflow that made the call

## Architecture

```
GitHub Actions → OIDC token → AWS IAM Identity Provider → AssumeRole → Deploy
```

Each AWS account needs:

1. An **OIDC Identity Provider** (pointing to `token.actions.githubusercontent.com`)
2. An **IAM Role** with a trust policy restricting to our repo + environment

## Setup Per Account

### Step 1: Create OIDC Identity Provider (one per account)

Run in each AWS account (Dev, Staging, Prod):

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

Or via the AWS Console:

1. IAM → Identity Providers → Add provider
2. Provider type: **OpenID Connect**
3. Provider URL: `https://token.actions.githubusercontent.com`
4. Audience: `sts.amazonaws.com`

### Step 2: Create IAM Role (one per environment)

Each environment maps to an account:

| Environment | AWS Account            | Role Name (suggested)    |
| ----------- | ---------------------- | ------------------------ |
| staging     | 215310597349 (Staging) | `github-actions-staging` |
| release     | 215310597349 (Staging) | `github-actions-release` |
| production  | 562590526970 (Prod)    | `github-actions-prod`    |
| hotfix      | 562590526970 (Prod)    | `github-actions-hotfix`  |

#### Trust Policy (staging example)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::215310597349:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:trulyhq/truly-platform:environment:staging"
        }
      }
    }
  ]
}
```

> **Key:** The `sub` condition restricts which GitHub environment can assume the role.
>
> - For `staging`: `repo:trulyhq/truly-platform:environment:staging`
> - For `release`: `repo:trulyhq/truly-platform:environment:release`
> - For `production`: `repo:trulyhq/truly-platform:environment:production`
> - For `hotfix`: `repo:trulyhq/truly-platform:environment:hotfix`

#### Permissions Policy

Attach `AdministratorAccess` for now (SST needs broad permissions for CloudFormation, S3, Lambda, CloudFront, Route 53, etc.). You can scope it down later.

```bash
# Example: Create the staging role
aws iam create-role \
  --role-name github-actions-staging \
  --assume-role-policy-document file://trust-policy-staging.json

aws iam attach-role-policy \
  --role-name github-actions-staging \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

### Step 3: Configure GitHub

#### 3a. Create GitHub Environments

Go to **repo Settings → Environments** and create:

| Environment  | Protection Rules                      |
| ------------ | ------------------------------------- |
| `staging`    | None (auto-deploy on merge to main)   |
| `release`    | None (auto-deploy on push to release) |
| `production` | Optional: Required reviewers          |
| `hotfix`     | None (fast-track)                     |

#### 3b. Set Environment Variables

In each GitHub environment, add a **variable** (not secret):

| Variable       | Value                                        |
| -------------- | -------------------------------------------- |
| `AWS_ROLE_ARN` | `arn:aws:iam::<account-id>:role/<role-name>` |

Examples:

- **staging**: `arn:aws:iam::215310597349:role/github-actions-staging`
- **release**: `arn:aws:iam::215310597349:role/github-actions-release`
- **production**: `arn:aws:iam::562590526970:role/github-actions-prod`
- **hotfix**: `arn:aws:iam::562590526970:role/github-actions-hotfix`

#### 3c. Set Repository Secrets

These are shared across all environments:

| Secret                       | Purpose                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| `EXPO_TOKEN`                 | EAS Build auth (get from expo.dev/accounts/settings/access-tokens) |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Google Play submission (base64-encoded JSON)                       |

## Verification

After setup, you can test by pushing a change to `main` and watching the staging deploy workflow. The "Configure AWS credentials (OIDC)" step should succeed without any static keys.

## Quick Reference: CLI Commands

```bash
# === Staging Account (215310597349) ===
export AWS_PROFILE=truly_staging

# Create OIDC provider
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# Create staging role
cat > /tmp/trust-staging.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::215310597349:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
      },
      "StringLike": {
        "token.actions.githubusercontent.com:sub": "repo:trulyhq/truly-platform:environment:staging"
      }
    }
  }]
}
EOF

aws iam create-role --role-name github-actions-staging --assume-role-policy-document file:///tmp/trust-staging.json
aws iam attach-role-policy --role-name github-actions-staging --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

# Create release role (same account, different environment condition)
cat > /tmp/trust-release.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::215310597349:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
      },
      "StringLike": {
        "token.actions.githubusercontent.com:sub": "repo:trulyhq/truly-platform:environment:release"
      }
    }
  }]
}
EOF

aws iam create-role --role-name github-actions-release --assume-role-policy-document file:///tmp/trust-release.json
aws iam attach-role-policy --role-name github-actions-release --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

# === Prod Account (562590526970) ===
export AWS_PROFILE=truly_prod

# Create OIDC provider
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# Create prod role
cat > /tmp/trust-prod.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::562590526970:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
      },
      "StringLike": {
        "token.actions.githubusercontent.com:sub": "repo:trulyhq/truly-platform:environment:production"
      }
    }
  }]
}
EOF

aws iam create-role --role-name github-actions-prod --assume-role-policy-document file:///tmp/trust-prod.json
aws iam attach-role-policy --role-name github-actions-prod --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

# Create hotfix role
cat > /tmp/trust-hotfix.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::562590526970:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
      },
      "StringLike": {
        "token.actions.githubusercontent.com:sub": "repo:trulyhq/truly-platform:environment:hotfix"
      }
    }
  }]
}
EOF

aws iam create-role --role-name github-actions-hotfix --assume-role-policy-document file:///tmp/trust-hotfix.json
aws iam attach-role-policy --role-name github-actions-hotfix --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

## Branch Protection Rules

Configure in **repo Settings → Branches → Add rule**:

| Branch    | Rules                                                                         |
| --------- | ----------------------------------------------------------------------------- |
| `main`    | ✅ Require PR, ✅ Require CI status checks (CI / check), ❌ No direct push    |
| `release` | ✅ Require PR, ✅ Require CI status checks                                    |
| `prod`    | ✅ Require PR, ✅ Require CI status checks, (optional: ✅ Required reviewers) |

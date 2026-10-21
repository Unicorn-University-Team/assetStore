#!/usr/bin/env bash
# One-time AWS setup for automatic deploys from GitHub Actions. Run in AWS CloudShell.
#
# - the server's role gets the SSM agent permissions, so commands reach the server without SSH
# - GitHub Actions is registered as an OIDC identity provider (no AWS keys stored in GitHub)
# - role assetstore-github-deploy: only the main branch of this repository can assume it,
#   and it can only send a shell command to this one server
#
# Safe to run again: existing parts are kept or updated.
set -euo pipefail

REGION=eu-central-1
INSTANCE_ID=i-0af9c67b1566f5c8d
# GitHub puts the repository into the token's "sub" claim with its immutable ids (owner@id/repo@id),
# so a renamed or re-created repository with the same name cannot use this role. Current value:
#   gh api repos/Unicorn-University-Team/assetStore/actions/oidc/customization/sub
REPO_SUBJECT=repo:Unicorn-University-Team@339749159/assetStore@1410671778
SERVER_ROLE=assetstore-ec2
DEPLOY_ROLE=assetstore-github-deploy

ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
OIDC_ARN="arn:aws:iam::$ACCOUNT:oidc-provider/token.actions.githubusercontent.com"

aws iam attach-role-policy --role-name "$SERVER_ROLE" --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
echo "Server role $SERVER_ROLE: SSM agent permissions attached"

aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_ARN" >/dev/null 2>&1 \
  || aws iam create-open-id-connect-provider --url https://token.actions.githubusercontent.com --client-id-list sts.amazonaws.com >/dev/null
echo "GitHub OIDC provider: ok"

cat > /tmp/github-deploy-trust.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "$OIDC_ARN" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "$REPO_SUBJECT:ref:refs/heads/main"
      }
    }
  }]
}
EOF
cat > /tmp/github-deploy-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": [
        "arn:aws:ec2:$REGION:$ACCOUNT:instance/$INSTANCE_ID",
        "arn:aws:ssm:$REGION::document/AWS-RunShellScript"
      ]
    },
    { "Effect": "Allow", "Action": "ssm:GetCommandInvocation", "Resource": "*" }
  ]
}
EOF
if aws iam get-role --role-name "$DEPLOY_ROLE" >/dev/null 2>&1; then
  aws iam update-assume-role-policy --role-name "$DEPLOY_ROLE" --policy-document file:///tmp/github-deploy-trust.json
else
  aws iam create-role --role-name "$DEPLOY_ROLE" --assume-role-policy-document file:///tmp/github-deploy-trust.json >/dev/null
fi
aws iam put-role-policy --role-name "$DEPLOY_ROLE" --policy-name send-deploy-command --policy-document file:///tmp/github-deploy-policy.json
echo "Deploy role: arn:aws:iam::$ACCOUNT:role/$DEPLOY_ROLE"

echo "Waiting until the server shows up in SSM (up to 3 minutes)..."
STATUS=none
for _ in $(seq 1 18); do
  STATUS=$(aws ssm describe-instance-information --region "$REGION" --filters "Key=InstanceIds,Values=$INSTANCE_ID" \
    --query 'InstanceInformationList[0].PingStatus' --output text 2>/dev/null || echo none)
  [ "$STATUS" = Online ] && break
  sleep 10
done
echo "Server in SSM: $STATUS"
echo "DONE"

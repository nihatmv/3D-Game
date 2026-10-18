#!/usr/bin/env bash
# Build the island for the CloudFront URL, upload it to S3 and refresh CloudFront.
# Runs locally (`npm run deploy:aws`, profile `island`) and in .github/workflows/deploy-aws.yml.
set -euo pipefail

AWS_S3_BUCKET="${AWS_S3_BUCKET:-cozy-island-site-051084216535}"
AWS_CF_DISTRIBUTION_ID="${AWS_CF_DISTRIBUTION_ID:-E2VCA7RGY05VO1}"
AWS_SITE_URL="${AWS_SITE_URL:-https://d3097wwvlky50g.cloudfront.net}"
export AWS_PAGER=""
# Locally use the `island` profile; in CI the credentials come from the GitHub OIDC role.
if [ -z "${CI:-}" ]; then export AWS_PROFILE="${AWS_PROFILE:-island}"; fi

if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "AWS credentials missing or expired. Run: aws login --profile island" >&2
  exit 1
fi

# Analytics stays off: Plausible's domain belongs to the Vercel site.
VITE_SITE_URL="$AWS_SITE_URL" VITE_ANALYTICS_PROVIDER= npm run build

B="s3://$AWS_S3_BUCKET"
# Hashed file names never change content: cache for a year.
aws s3 sync dist/assets "$B/assets" --delete --only-show-errors \
  --cache-control "public,max-age=31536000,immutable"
# Fixed names (images, og.png): short cache.
aws s3 sync dist "$B" --delete --only-show-errors \
  --exclude "assets/*" --exclude "index.html" \
  --cache-control "public,max-age=3600"
# The page itself is always revalidated, so a deploy shows at once.
aws s3 cp dist/index.html "$B/index.html" --only-show-errors \
  --cache-control "no-cache" --content-type "text/html; charset=utf-8"

aws cloudfront create-invalidation --distribution-id "$AWS_CF_DISTRIBUTION_ID" \
  --paths "/*" --query 'Invalidation.Id' --output text
echo "Deployed to $AWS_SITE_URL"

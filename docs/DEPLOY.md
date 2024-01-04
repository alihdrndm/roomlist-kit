# Deploying to AWS (optional)

The repository is deploy-ready but has never been deployed. Everything below is for you, the owner, to run; nothing in the build or CI deploys anything. A deployment creates resources that **bill by the hour while they exist**, so remove the stage when you are done.

## Prerequisites

1. An AWS account you control, and credentials for it on your machine (for example `aws configure sso` or the `AWS_PROFILE` environment variable). SST uses the standard AWS credential chain; see https://sst.dev/docs/iam-credentials.
2. Docker running locally: the API image is built from `apps/api/Dockerfile` during deploy.
3. Node 24 and `pnpm install` done in the repo.

## Commands

Run these from the repo root. `dev` is the stage name; use any name you like, and pass the same one to every command.

```sh
# 1. Set the API key once per stage (choose a long random value; it is stored in your AWS account, not in the repo)
pnpm sst secret set ApiKey "<a-long-random-value>" --stage dev

# 2. Deploy. Prints the API URL and the web URL when done.
pnpm sst deploy --stage dev

# 3. Remove everything the stage created (stops all billing for it)
pnpm sst remove --stage dev
```

The stage `production` is different: its resources are protected and kept on removal (`sst.config.ts`), so `sst remove --stage production` will not delete them.

To call the deployed API directly: `curl -H "x-api-key: <your value>" <api url>/v1/formats`. Swagger UI is at `<api url>/docs`.

## What the config creates

Defined in `infra/api.ts` and `infra/web.ts`, region `us-east-1`.

| Resource | Created by | Bills continuously? |
|----------|-----------|---------------------|
| VPC with a public and a private subnet in each of two availability zones, an internet gateway, route tables, a default security group | `sst.aws.Vpc("Vpc")` | No (no NAT gateway: NAT is off by default) |
| ECS cluster | `sst.aws.Cluster("Cluster")` | No |
| Application Load Balancer, HTTP listener on port 80, target group with a health check on `/healthz` | `sst.aws.Service("Api")` | **Yes**, per hour, plus load balancer capacity units |
| One Fargate task (0.25 vCPU, 0.5 GB), its task definition, IAM roles, security groups | `sst.aws.Service("Api")` | **Yes**, per second while running |
| Container image in Amazon ECR | `sst.aws.Service("Api")` | Storage only |
| CloudWatch log group for the API | `sst.aws.Service("Api")` | Storage and ingestion only |
| Public IPv4 addresses (the load balancer's, and one per running container: the SST Service docs say each container gets one) | VPC and service | **Yes**, per address per hour |
| SSM parameter holding the `ApiKey` secret | `sst.Secret("ApiKey")` | No (standard parameters) |
| CloudFront distribution, S3 bucket for static assets, Lambda functions for server rendering and image optimisation, plus the queue and table OpenNext uses for revalidation | `sst.aws.Nextjs("Web")` | No: billed per request and per GB stored |

SST also keeps its own state in your account (an S3 bucket and SSM parameters created on first deploy); see https://sst.dev/docs/state.

There is no database and no NAT gateway.

## Pricing pages

- Load balancer: https://aws.amazon.com/elasticloadbalancing/pricing/
- Fargate: https://aws.amazon.com/fargate/pricing/
- Public IPv4 addresses (under "Public IPv4 address"): https://aws.amazon.com/vpc/pricing/
- ECR: https://aws.amazon.com/ecr/pricing/
- CloudWatch: https://aws.amazon.com/cloudwatch/pricing/
- CloudFront: https://aws.amazon.com/cloudfront/pricing/
- Lambda: https://aws.amazon.com/lambda/pricing/
- S3: https://aws.amazon.com/s3/pricing/
- SQS: https://aws.amazon.com/sqs/pricing/
- DynamoDB: https://aws.amazon.com/dynamodb/pricing/
- Systems Manager Parameter Store: https://aws.amazon.com/systems-manager/pricing/

## Known limits (see docs/DECISIONS.md, M8)

- **Next.js 16 on OpenNext is unverified.** The SST docs list OpenNext 3.9.14 for Next.js 15 and later and do not mention 16. If the web deploy fails at the OpenNext build step, check the SST and OpenNext release notes for Next.js 16 support.
- **Rate limits for web users are shared.** The API counts requests per client address behind the load balancer (`TRUST_PROXY=1`). Requests from the web app come from its Lambda functions' addresses, so web users share those limits.
- **Plain HTTP.** Without a domain the load balancer serves HTTP only. CloudFront serves the web app over HTTPS, but the web-to-API hop is HTTP. Add a domain (the `loadBalancer.domain` option) before using real guest data.

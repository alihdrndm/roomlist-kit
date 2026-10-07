// The NestJS API runs as a container, not a Lambda function: SST bundles functions
// with esbuild, which does not emit the decorator metadata Nest's dependency
// injection needs (docs/DECISIONS.md, M8).

/** The key the web app sends and the API checks. Set it with `pnpm sst secret set ApiKey <value>`. */
export const apiKey = new sst.Secret("ApiKey");

// NAT is off (the SST default): the service needs no outbound internet access.
const vpc = new sst.aws.Vpc("Vpc");
const cluster = new sst.aws.Cluster("Cluster", { vpc });

export const api = new sst.aws.Service("Api", {
  cluster,
  image: { context: ".", dockerfile: "apps/api/Dockerfile" },
  cpu: "0.25 vCPU",
  memory: "0.5 GB",
  // No `scaling`: exactly one task, no autoscaling.
  loadBalancer: {
    rules: [{ listen: "80/http", forward: "4010/http" }],
    health: { "4010/http": { path: "/healthz" } },
  },
  environment: {
    API_KEY: apiKey.value,
    NODE_ENV: "production",
    // One proxy (the load balancer) sits in front of the container. Web users all
    // arrive from the web app's Lambda addresses, so they share rate-limit
    // buckets; accepted and documented (docs/DECISIONS.md, M8).
    TRUST_PROXY: "1",
  },
});

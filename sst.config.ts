/// <reference path="./.sst/platform/config.d.ts" />

// Deploy-ready, never deployed by the build: docs/DEPLOY.md has the commands the
// owner runs. Resources live in infra/*.ts and are imported inside run(), as SST
// requires, because the `sst` global only exists while run() executes.
export default $config({
  app(input) {
    return {
      name: "roomlist-kit",
      home: "aws",
      providers: { aws: { region: "us-east-1" } },
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: input?.stage === "production",
    };
  },
  async run() {
    const { api } = await import("./infra/api");
    const { web } = await import("./infra/web");
    return { api: api.url, web: web.url };
  },
});

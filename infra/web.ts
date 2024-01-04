import { api, apiKey } from "./api";

// Both values are read only on the server (apps/web/src/env.ts); neither has the
// NEXT_PUBLIC_ prefix, so neither reaches the browser bundle.
export const web = new sst.aws.Nextjs("Web", {
  path: "apps/web",
  environment: {
    API_BASE_URL: api.url,
    API_KEY: apiKey.value,
  },
});

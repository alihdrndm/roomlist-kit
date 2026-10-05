import { z } from "zod";

// The only place in the web app that reads process.env. Server-only: never import
// this from a client component, or the API key would end up in the browser bundle.
const envSchema = z.object({
  API_BASE_URL: z.url().default("http://localhost:4010"),
  API_KEY: z.string().default(""),
});

export const env = envSchema.parse(process.env);

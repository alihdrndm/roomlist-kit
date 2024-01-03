import { z } from "zod";

// The only place in the API that reads process.env. Everything else receives
// a typed Config, so a typo in a variable name fails at boot, not at request time.
const configSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4010),
  // Empty or unset disables authentication (development only).
  API_KEY: z.string().default(""),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(5_242_880),
  MAX_ROWS: z.coerce.number().int().positive().default(5000),
  // How many reverse proxies sit in front of the API (0 = none). Needed so the
  // rate limit sees each client's own address and not the load balancer's.
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  // Chooses readable logs for development and JSON lines for production.
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      console.error(
        `Invalid configuration: ${issue.path.join(".")}: ${issue.message}`,
      );
    }
    process.exit(1);
  }
  return parsed.data;
}

/** A complete Config for tests and tools: defaults, with any field overridden. */
export function defaultConfig(overrides: Partial<Config> = {}): Config {
  return { ...configSchema.parse({}), ...overrides };
}

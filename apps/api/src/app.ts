import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule, type AppOverrides } from "./app.module.js";
import type { Config } from "./config.js";
import { ProblemFilter } from "./problem.filter.js";
import { requestIdMiddleware } from "./request-id.js";
import { setupSwagger } from "./swagger.js";

/** The message HANDOFF.md requires when no API key is configured. */
export const NO_API_KEY_WARNING =
  "API_KEY not set: authentication disabled (development only)";

/**
 * Builds the configured application (not yet listening). main.ts and the e2e
 * tests both call this, so the tests exercise exactly what production runs.
 */
export async function createApp(
  config: Config,
  overrides: AppOverrides = {},
): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register(config, overrides),
    {
      bufferLogs: true,
      // Every endpoint takes multipart/form-data, which multer reads. The default JSON and
      // form parsers are never needed; they would let a client make the server buffer and
      // parse a large body for nothing, and raise errors before the router runs.
      bodyParser: false,
    },
  );
  const logger = app.get(Logger);
  app.useLogger(logger);
  // The single error filter, for routes and for errors raised before routing (a malformed
  // URL). It is a global filter instance on purpose: APP_FILTER does not reach that layer.
  app.useGlobalFilters(app.get(ProblemFilter));

  // Behind a load balancer every request arrives from the proxy's address unless
  // Express is told how many proxies to trust; the rate limit needs the real client.
  if (config.TRUST_PROXY > 0) app.set("trust proxy", config.TRUST_PROXY);

  // Registered before Nest's own middleware (pino), so the id exists when the access log is written.
  app.use(requestIdMiddleware);
  // The deployed load balancer serves plain HTTP (no domain), so the default
  // upgrade-insecure-requests directive would make browsers fetch Swagger UI's
  // assets over HTTPS, where nothing answers.
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } },
    }),
  );
  setupSwagger(app);

  // On SIGTERM: stop accepting connections and let in-flight requests finish.
  app.enableShutdownHooks();

  if (config.API_KEY === "") logger.warn(NO_API_KEY_WARNING);
  return app;
}

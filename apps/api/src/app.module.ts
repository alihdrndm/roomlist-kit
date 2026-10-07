import { createRequire } from "node:module";
import {
  type DynamicModule,
  Module,
  StandardSchemaValidationPipe,
} from "@nestjs/common";
import { APP_GUARD, APP_PIPE } from "@nestjs/core";
import { MulterModule } from "@nestjs/platform-express";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import type { DestinationStream } from "pino";
import type { Config } from "./config.js";
import { CONFIG, ConfigModule } from "./config.module.js";
import { FormatsController } from "./formats.controller.js";
import { HealthController } from "./health.controller.js";
import { ProblemFilter } from "./problem.filter.js";
import { type RequestWithId, resolveRequestId } from "./request-id.js";
import { RoomingListsController } from "./rooming-lists.controller.js";
import { RoomingListsService } from "./rooming-lists.service.js";
import { validationError } from "./schemas.js";

/** Test hooks: capture the log lines, or lower the rate limit to reach 429 quickly. */
export type AppOverrides = {
  logStream?: DestinationStream;
  throttle?: { limit: number; ttlMs: number };
};

/** The limit from the project spec: 120 requests per minute per IP. */
export const DEFAULT_THROTTLE = { limit: 120, ttlMs: 60_000 } as const;

/**
 * Readable logs for development, if pino-pretty is installed. It is a dev dependency,
 * so a production image built with `pnpm deploy --prod` does not have it; the API
 * then logs JSON instead of failing to start because NODE_ENV was left unset.
 */
function prettyTransport():
  | { transport: { target: string } }
  | Record<string, never> {
  try {
    createRequire(import.meta.url).resolve("pino-pretty");
    return { transport: { target: "pino-pretty" } };
  } catch {
    return {};
  }
}

/** The path without its query string: a query can carry data, and logs must not. */
function pathOnly(url: string | undefined): string {
  return (url ?? "").split("?")[0] ?? "";
}

@Module({})
export class AppModule {
  static register(config: Config, overrides: AppOverrides = {}): DynamicModule {
    const throttle = overrides.throttle ?? DEFAULT_THROTTLE;
    const pinoOptions = {
      level: "info",
      // The id was set by requestIdMiddleware before pino-http runs.
      genReqId: (req: RequestWithId) =>
        req.id ?? resolveRequestId(req.headers["x-request-id"]),
      // One line per request with exactly these fields. No headers, no body, no query
      // string: a request can carry names and emails, and logs must never hold them.
      serializers: {
        req: (req: RequestWithId) => ({
          id: req.id,
          method: req.method,
          path: pathOnly(req.url),
          userAgent: req.headers["user-agent"],
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      ...(overrides.logStream === undefined && config.NODE_ENV === "development"
        ? prettyTransport()
        : {}),
    };

    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(config),
        ThrottlerModule.forRoot([
          { ttl: throttle.ttlMs, limit: throttle.limit },
        ]),
        LoggerModule.forRoot({
          pinoHttp:
            overrides.logStream === undefined
              ? pinoOptions
              : [pinoOptions, overrides.logStream],
        }),
        // Uploads are capped by MAX_UPLOAD_BYTES. With neither `dest` nor `storage`
        // set, multer keeps files in memory (file.buffer): nothing is written to disk.
        MulterModule.registerAsync({
          inject: [CONFIG],
          useFactory: (appConfig: Config) => ({
            limits: {
              fileSize: appConfig.MAX_UPLOAD_BYTES,
              files: 2,
              fields: 10,
              fieldSize: 64 * 1024,
            },
          }),
        }),
      ],
      controllers: [
        HealthController,
        RoomingListsController,
        FormatsController,
      ],
      providers: [
        RoomingListsService,
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        // Registered as a plain provider: createApp installs it with useGlobalFilters, which
        // (unlike APP_FILTER) also covers errors thrown before Nest's router runs.
        ProblemFilter,
        {
          provide: APP_PIPE,
          useValue: new StandardSchemaValidationPipe({
            exceptionFactory: (issues) => validationError(issues),
          }),
        },
      ],
    };
  }
}

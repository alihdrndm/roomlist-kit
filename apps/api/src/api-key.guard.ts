import { createHash, timingSafeEqual } from "node:crypto";
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";
import type { Config } from "./config.js";
import { CONFIG } from "./config.module.js";
import { ApiError } from "./errors.js";

export const API_KEY_HEADER = "x-api-key";

/**
 * Compares two strings in constant time. Hashing both first makes the buffers the
 * same length, which timingSafeEqual requires (it throws otherwise, and a
 * length check before it would leak how long the real key is).
 *
 * This is not password storage, so a slow password hash (bcrypt, scrypt) would add
 * nothing: the digests live for one comparison and are never stored or logged.
 * CodeQL's js/insufficient-password-hash alert on these lines was dismissed as a
 * false positive for that reason.
 */
export function keysMatch(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Protects the /v1 endpoints. When API_KEY is empty the API is open: that is the
 * development default, announced once at boot (see app.ts), never in production.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(@Inject(CONFIG) private readonly config: Config) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.config.API_KEY === "") return true;
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.header(API_KEY_HEADER);
    if (provided === undefined || !keysMatch(provided, this.config.API_KEY)) {
      // The same message for "missing" and "wrong": do not tell a caller which it was.
      throw new ApiError(
        "UNAUTHORIZED",
        `A valid ${API_KEY_HEADER} header is required.`,
      );
    }
    return true;
  }
}

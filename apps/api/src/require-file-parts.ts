import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  type Type,
} from "@nestjs/common";
import type { Observable } from "rxjs";
import { ApiError } from "./errors.js";

/** The files multer attached to the request, by field name (memory storage). */
export type UploadedParts = Partial<Record<string, Express.Multer.File[]>>;

/**
 * Runs after the multipart interceptor and before body validation, so a missing
 * file is always FILE_REQUIRED (400), never hidden behind a validation error on
 * some other field.
 */
export function requireFileParts(...names: string[]): Type<NestInterceptor> {
  @Injectable()
  class RequireFileParts implements NestInterceptor {
    intercept(
      context: ExecutionContext,
      next: CallHandler,
    ): Observable<unknown> {
      const files = context
        .switchToHttp()
        .getRequest<{ files?: UploadedParts }>().files;
      for (const name of names) {
        if ((files?.[name]?.length ?? 0) === 0) {
          throw new ApiError(
            "FILE_REQUIRED",
            `The "${name}" file part is required (send multipart/form-data).`,
          );
        }
      }
      return next.handle();
    }
  }
  return RequireFileParts;
}

/** The bytes of one uploaded part. Callers have already passed requireFileParts. */
export function partBytes(files: UploadedParts, name: string): Uint8Array {
  const file = files[name]?.[0];
  if (file === undefined)
    throw new ApiError("FILE_REQUIRED", `The "${name}" file part is required.`);
  return new Uint8Array(file.buffer);
}

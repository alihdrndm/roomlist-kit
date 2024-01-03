import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { jsonResponse } from "./openapi.js";

// Deliberately outside /v1: load balancers and Docker probe these without an API
// key, and often (every few seconds), so they are not rate limited either.
@SkipThrottle()
@ApiTags("health")
@Controller()
export class HealthController {
  // Liveness: the process is up.
  @ApiOperation({
    summary: "Liveness probe",
    description:
      "Returns 200 while the process is up. No API key needed; not rate limited.",
  })
  @ApiResponse(jsonResponse("Always ok.", "Health"))
  @Get("healthz")
  healthz(): { status: "ok" } {
    return { status: "ok" };
  }

  // Readiness: this project has no backing services, so ready == alive.
  @ApiOperation({
    summary: "Readiness probe",
    description:
      "Returns 200 when the service can take traffic. This service has no backing services, so it is ready whenever it is alive. No API key needed; not rate limited.",
  })
  @ApiResponse(jsonResponse("Always ok.", "Health"))
  @Get("readyz")
  readyz(): { status: "ok" } {
    return { status: "ok" };
  }
}

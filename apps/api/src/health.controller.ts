import { Controller, Get } from "@nestjs/common";

// Deliberately outside /v1: load balancers and Docker probe these without an API key.
@Controller()
export class HealthController {
  // Liveness: the process is up.
  @Get("healthz")
  healthz(): { status: "ok" } {
    return { status: "ok" };
  }

  // Readiness: this project has no backing services, so ready == alive.
  @Get("readyz")
  readyz(): { status: "ok" } {
    return { status: "ok" };
  }
}

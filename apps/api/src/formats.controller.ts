import { listTargets } from "@alihdrndm/roomlist-core";
import { Controller, Get, UseGuards } from "@nestjs/common";
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from "@nestjs/swagger";
import { ApiKeyGuard } from "./api-key.guard.js";
import {
  internalError,
  jsonResponse,
  rateLimited,
  unauthorized,
} from "./openapi.js";

@ApiTags("formats")
@ApiSecurity("x-api-key")
@Controller("v1/formats")
@UseGuards(ApiKeyGuard)
export class FormatsController {
  /** Every export target with what is verified and what is assumed about it. */
  @ApiOperation({
    summary: "List export targets",
    description:
      "Every target id accepted by /convert, with its media type, file extension, options and what is verified versus assumed about the format.",
  })
  @ApiResponse(jsonResponse("The export targets.", "TargetsResponse"))
  @ApiResponse(unauthorized)
  @ApiResponse(rateLimited)
  @ApiResponse(internalError)
  @Get()
  formats() {
    return { targets: listTargets() };
  }
}

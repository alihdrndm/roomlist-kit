import {
  Body,
  Controller,
  HttpCode,
  Post,
  Res,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import { ApiKeyGuard } from "./api-key.guard.js";
import {
  convertBody,
  convertFileResponse,
  diffBody,
  fileRequired,
  fileTooLarge,
  internalError,
  jsonResponse,
  problemResponse,
  rateLimited,
  unauthorized,
  validateBody,
} from "./openapi.js";
import {
  partBytes,
  requireFileParts,
  type UploadedParts,
} from "./require-file-parts.js";
// A value import, not `import type`: Nest reads the constructor parameter's type at
// runtime (emitDecoratorMetadata) to find the provider to inject.
import { RoomingListsService } from "./rooming-lists.service.js";
import {
  type ConvertBody,
  ConvertBodySchema,
  type DiffBody,
  DiffBodySchema,
  type ValidateBody,
  ValidateBodySchema,
} from "./schemas.js";

@ApiTags("rooming-lists")
@ApiSecurity("x-api-key")
@Controller("v1/rooming-lists")
@UseGuards(ApiKeyGuard)
export class RoomingListsController {
  constructor(private readonly service: RoomingListsService) {}

  @ApiOperation({
    summary: "Validate a rooming list",
    description:
      "Parses and validates the uploaded file. Returns 200 even when the list has errors: the report is the product, and `ok` is false when any issue has severity error.",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody(validateBody)
  @ApiResponse(jsonResponse("The validation report.", "ValidateReport"))
  @ApiResponse(fileRequired)
  @ApiResponse(unauthorized)
  @ApiResponse(fileTooLarge)
  @ApiResponse(
    problemResponse(
      422,
      "VALIDATION_FAILED: a part (block, options) is not valid JSON or not the expected shape, or an unknown part was sent. `errors[].path` starts with the part name.",
    ),
  )
  @ApiResponse(rateLimited)
  @ApiResponse(internalError)
  @Post("validate")
  // POST defaults to 201 in Nest; a validation report is a plain 200.
  @HttpCode(200)
  @UseInterceptors(
    FileFieldsInterceptor([{ name: "file", maxCount: 1 }]),
    requireFileParts("file"),
  )
  validate(
    @UploadedFiles() files: UploadedParts,
    @Body({ schema: ValidateBodySchema }) body: ValidateBody,
  ) {
    return this.service.validate(
      partBytes(files, "file"),
      body.block,
      body.options,
    );
  }

  @ApiOperation({
    summary: "Convert a rooming list to a PMS import file",
    description:
      "Validates the list, then writes it in the chosen target format. Fails with 422 LIST_INVALID when the list has any error-severity issue.",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody(convertBody)
  @ApiResponse(convertFileResponse)
  @ApiResponse(fileRequired)
  @ApiResponse(unauthorized)
  @ApiResponse(fileTooLarge)
  @ApiResponse(
    problemResponse(
      422,
      "VALIDATION_FAILED (unknown target, invalid part or targetOptions; see `errors`), LIST_INVALID (the list has errors) or EXPORT_PRECONDITION_FAILED (the target needs data the list lacks). The last two bodies have an `issues` member listing every issue.",
    ),
  )
  @ApiResponse(rateLimited)
  @ApiResponse(internalError)
  @Post("convert")
  @HttpCode(200)
  @UseInterceptors(
    FileFieldsInterceptor([{ name: "file", maxCount: 1 }]),
    requireFileParts("file"),
  )
  async convert(
    @UploadedFiles() files: UploadedParts,
    @Body({ schema: ConvertBodySchema }) body: ConvertBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const result = await this.service.convert(
      partBytes(files, "file"),
      body.block,
      body.options,
      body.target,
      body.targetOptions,
    );
    response.setHeader("x-roomlist-warnings", String(result.warnings));
    return new StreamableFile(result.bytes, {
      type: result.contentType,
      disposition: `attachment; filename="${result.fileName}"`,
      length: result.bytes.length,
    });
  }

  @ApiOperation({
    summary: "Compare two rooming lists",
    description:
      "Reports the guests added, removed and changed between an earlier and a later list. Fails with 422 LIST_INVALID when either list has errors.",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody(diffBody)
  @ApiResponse(
    jsonResponse("The differences between the two lists.", "DiffReport"),
  )
  @ApiResponse(fileRequired)
  @ApiResponse(unauthorized)
  @ApiResponse(fileTooLarge)
  @ApiResponse(
    problemResponse(
      422,
      "VALIDATION_FAILED (invalid options part; see `errors`) or LIST_INVALID (one or both lists have errors). LIST_INVALID bodies have an `issues` member listing every issue, each with `side` set to before or after.",
    ),
  )
  @ApiResponse(rateLimited)
  @ApiResponse(internalError)
  @Post("diff")
  @HttpCode(200)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "before", maxCount: 1 },
      { name: "after", maxCount: 1 },
    ]),
    requireFileParts("before", "after"),
  )
  diff(
    @UploadedFiles() files: UploadedParts,
    @Body({ schema: DiffBodySchema }) body: DiffBody,
  ) {
    return this.service.diff(
      partBytes(files, "before"),
      partBytes(files, "after"),
      body.options,
    );
  }
}

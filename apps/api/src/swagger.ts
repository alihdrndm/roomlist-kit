import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { registerComponents } from "./openapi.js";

/** Swagger UI at /docs and the OpenAPI JSON at /docs-json; neither needs the API key. */
export function setupSwagger(app: INestApplication): void {
  const options = new DocumentBuilder()
    .setTitle("roomlist-kit API")
    .setDescription(
      "Validate, convert and compare hotel rooming lists. Stateless: uploaded files are never stored.",
    )
    .setVersion("0.1.0")
    .addApiKey({ type: "apiKey", name: "x-api-key", in: "header" }, "x-api-key")
    .build();
  const document = SwaggerModule.createDocument(app, options);
  // Zod-derived schemas the multipart part descriptions point at (#/components/schemas/BlockContext, ...).
  registerComponents(document);
  SwaggerModule.setup("docs", app, document, { jsonDocumentUrl: "docs-json" });
}

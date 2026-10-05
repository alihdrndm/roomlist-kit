import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { loadConfig } from "./config.js";

async function bootstrap() {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule);
  // On SIGTERM Nest stops accepting new connections and lets in-flight requests finish.
  app.enableShutdownHooks();
  await app.listen(config.PORT);
}

await bootstrap();

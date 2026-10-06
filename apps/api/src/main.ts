import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

async function bootstrap() {
  const config = loadConfig();
  const app = await createApp(config);
  await app.listen(config.PORT);
}

await bootstrap();

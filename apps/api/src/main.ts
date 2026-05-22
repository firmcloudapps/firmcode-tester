import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { loadApiConfig } from "./config/api-config";
import { AppModule } from "./modules/app.module";

async function bootstrap() {
  const config = loadApiConfig();
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: config.corsAllowedOrigins
  });

  await app.listen(config.port);
}

void bootstrap();

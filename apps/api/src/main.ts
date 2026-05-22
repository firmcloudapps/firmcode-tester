import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { type NestExpressApplication } from "@nestjs/platform-express";
import { type ApiRuntimeConfig } from "@firmcode/shared";
import { loadApiConfig } from "./config/api-config";
import { AppModule } from "./modules/app.module";

type ExpressBodyParserFactory = (options: Record<string, unknown>) => unknown;

const expressBodyParser = require("express") as {
  raw: ExpressBodyParserFactory;
  json: ExpressBodyParserFactory;
  urlencoded: ExpressBodyParserFactory;
};

export async function createApiApplication(config: ApiRuntimeConfig = loadApiConfig()): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false
  });

  configureApiApplication(app, config);

  return app;
}

export function configureApiApplication(app: INestApplication, config: ApiRuntimeConfig): void {
  app.use("/webhooks/github", expressBodyParser.raw({ type: "*/*", limit: "1mb" }));
  app.use(expressBodyParser.json({ limit: "1mb" }));
  app.use(expressBodyParser.urlencoded({ extended: true, limit: "1mb" }));

  app.enableCors({
    origin: config.corsAllowedOrigins
  });
}

async function bootstrap() {
  const config = loadApiConfig();
  const app = await createApiApplication(config);

  await app.listen(config.port);
}

if (require.main === module) {
  void bootstrap();
}

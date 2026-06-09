import fs from "fs";
import path from "path";
import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { type NestExpressApplication } from "@nestjs/platform-express";
import { type ApiRuntimeConfig } from "@firmcode/shared";
import { loadApiConfig } from "./config/api-config";

import { logRuntimeEnvDiagnostics } from "./config/runtime-env-diagnostics";
import { AppModule } from "./modules/app.module";

type ExpressBodyParserFactory = (options: Record<string, unknown>) => unknown;

const expressBodyParser = require("express") as {
  raw: ExpressBodyParserFactory;
  json: ExpressBodyParserFactory;
  urlencoded: ExpressBodyParserFactory;
};

loadEnvFiles([
  path.resolve(__dirname, "../../../.env.local"),
  path.resolve(__dirname, "../../../.env")
]);

function loadEnvFiles(filePaths: string[]): void {
  for (const filePath of filePaths) {
    loadEnvFile(filePath);
  }
}

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

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
  let config: ApiRuntimeConfig;

  try {
    config = loadApiConfig();
  } catch (error) {
    logRuntimeEnvDiagnostics();
    throw error;
  }

  const app = await createApiApplication(config);

  await app.listen(config.port);
}

if (require.main === module) {
  void bootstrap();
}

import type { Provider } from "@nestjs/common";
import { type ApiRuntimeConfig } from "@firmcode/shared";
import { loadApiConfig } from "./api-config";

export const API_RUNTIME_CONFIG = Symbol("API_RUNTIME_CONFIG");

export const apiRuntimeConfigProvider: Provider<ApiRuntimeConfig> = {
  provide: API_RUNTIME_CONFIG,
  useFactory: loadApiConfig
};

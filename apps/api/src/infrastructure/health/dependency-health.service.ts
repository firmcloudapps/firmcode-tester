import { Injectable } from "@nestjs/common";
import { Socket } from "node:net";
import { loadApiConfig } from "../../config/api-config";

export type DependencyStatus = "ok" | "unavailable";

export interface DependencyHealthCheck {
  name: "database" | "redis";
  status: DependencyStatus;
  host: string;
  port: number;
  error?: string;
}

export interface ApiReadinessResponse {
  service: "api";
  status: DependencyStatus;
  dependencies: DependencyHealthCheck[];
}

@Injectable()
export class DependencyHealthService {
  async checkReadiness(): Promise<ApiReadinessResponse> {
    const config = loadApiConfig();
    const dependencies = await Promise.all([
      checkTcpUrl("database", config.database.url, 5432),
      checkTcpUrl("redis", config.queue.redisUrl, 6379)
    ]);

    return {
      service: "api",
      status: dependencies.every((dependency) => dependency.status === "ok") ? "ok" : "unavailable",
      dependencies
    };
  }
}

function checkTcpUrl(
  name: DependencyHealthCheck["name"],
  rawUrl: string,
  defaultPort: number
): Promise<DependencyHealthCheck> {
  const url = new URL(rawUrl);
  const host = url.hostname;
  const port = url.port ? Number(url.port) : defaultPort;

  return new Promise((resolve) => {
    const socket = new Socket();
    let settled = false;

    const finish = (result: DependencyHealthCheck) => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(1500);
    socket.once("connect", () => finish({ name, status: "ok", host, port }));
    socket.once("timeout", () => finish({ name, status: "unavailable", host, port, error: "connection_timeout" }));
    socket.once("error", (error: NodeJS.ErrnoException) =>
      finish({ name, status: "unavailable", host, port, error: error.code ?? "connection_error" })
    );
    socket.connect(port, host);
  });
}

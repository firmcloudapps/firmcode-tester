export interface HealthResponse {
  service: "api" | "web" | "worker";
  status: "ok";
  version: string;
}

export const createHealthResponse = (
  service: HealthResponse["service"],
  version = "0.1.0"
): HealthResponse => ({
  service,
  status: "ok",
  version
});

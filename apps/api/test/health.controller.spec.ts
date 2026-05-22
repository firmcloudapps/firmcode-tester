import { HealthController } from "../src/modules/health/health.controller";

describe("HealthController", () => {
  const dependencyHealthService = {
    checkReadiness: vi.fn()
  };

  it("returns the API health payload", () => {
    const controller = new HealthController(dependencyHealthService);

    expect(controller.getHealth()).toEqual({
      service: "api",
      status: "ok",
      version: "0.1.0"
    });
  });

  it("returns dependency readiness", async () => {
    dependencyHealthService.checkReadiness.mockResolvedValue({
      service: "api",
      status: "ok",
      dependencies: [
        { name: "database", status: "ok", host: "ep-example.us-east-2.aws.neon.tech", port: 5432 },
        { name: "redis", status: "ok", host: "redis", port: 6379 }
      ]
    });
    const controller = new HealthController(dependencyHealthService);

    await expect(controller.getReadiness()).resolves.toEqual({
      service: "api",
      status: "ok",
      dependencies: [
        { name: "database", status: "ok", host: "ep-example.us-east-2.aws.neon.tech", port: 5432 },
        { name: "redis", status: "ok", host: "redis", port: 6379 }
      ]
    });
  });
});

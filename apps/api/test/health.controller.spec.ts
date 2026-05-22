import { HealthController } from "../src/modules/health/health.controller";

describe("HealthController", () => {
  it("returns the API health payload", () => {
    const controller = new HealthController();

    expect(controller.getHealth()).toEqual({
      service: "api",
      status: "ok",
      version: "0.1.0"
    });
  });
});

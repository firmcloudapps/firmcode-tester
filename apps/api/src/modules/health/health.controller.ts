import { Controller, Get } from "@nestjs/common";
import { createHealthResponse, type HealthResponse } from "@firmcode/shared";
import { DependencyHealthService, type ApiReadinessResponse } from "../../infrastructure/health/dependency-health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly dependencyHealthService: DependencyHealthService) {}

  @Get()
  getHealth(): HealthResponse {
    return createHealthResponse("api");
  }

  @Get("ready")
  getReadiness(): Promise<ApiReadinessResponse> {
    return this.dependencyHealthService.checkReadiness();
  }
}

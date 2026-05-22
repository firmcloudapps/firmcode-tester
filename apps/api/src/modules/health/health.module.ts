import { Module } from "@nestjs/common";
import { DependencyHealthService } from "../../infrastructure/health/dependency-health.service";
import { HealthController } from "./health.controller";

@Module({
  controllers: [HealthController],
  providers: [DependencyHealthService]
})
export class HealthModule {}

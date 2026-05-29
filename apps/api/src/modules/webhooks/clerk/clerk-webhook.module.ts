import { Module } from "@nestjs/common";
import { API_RUNTIME_CONFIG, apiRuntimeConfigProvider } from "../../../config/api-config.provider";
import { ClerkWebhookController } from "./clerk-webhook.controller";
import {
  CLERK_ORGANIZATION_MEMBERSHIP_CLIENT,
  CLERK_WEBHOOK_VERIFIER,
  ClerkBackendOrganizationMembershipClient,
  ClerkBackendWebhookVerifier,
  ClerkWebhookService
} from "./clerk-webhook.service";

@Module({
  controllers: [ClerkWebhookController],
  providers: [
    apiRuntimeConfigProvider,
    {
      provide: CLERK_WEBHOOK_VERIFIER,
      useClass: ClerkBackendWebhookVerifier
    },
    {
      provide: CLERK_ORGANIZATION_MEMBERSHIP_CLIENT,
      useClass: ClerkBackendOrganizationMembershipClient
    },
    ClerkWebhookService
  ],
  exports: [ClerkWebhookService, CLERK_WEBHOOK_VERIFIER, CLERK_ORGANIZATION_MEMBERSHIP_CLIENT, API_RUNTIME_CONFIG]
})
export class ClerkWebhookModule {}

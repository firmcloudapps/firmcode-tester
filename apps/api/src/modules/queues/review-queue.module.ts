import { Module } from "@nestjs/common";
import type { ApiRuntimeConfig } from "@firmcode/shared";
import { API_RUNTIME_CONFIG, apiRuntimeConfigProvider } from "../../config/api-config.provider";
import {
  BullMqCodebaseScanQueueProducer,
  CODEBASE_SCAN_QUEUE,
  InMemoryCodebaseScanQueueProducer
} from "./codebase-scan-queue";
import { BullMqReviewQueueProducer, InMemoryReviewQueueProducer, REVIEW_QUEUE } from "./review-queue";

@Module({
  providers: [
    apiRuntimeConfigProvider,
    {
      provide: REVIEW_QUEUE,
      useFactory: (config: ApiRuntimeConfig) => {
        if (config.nodeEnv === "test") {
          return new InMemoryReviewQueueProducer();
        }

        return new BullMqReviewQueueProducer(config.queue.redisUrl);
      },
      inject: [API_RUNTIME_CONFIG]
    },
    {
      provide: CODEBASE_SCAN_QUEUE,
      useFactory: (config: ApiRuntimeConfig) => {
        if (config.nodeEnv === "test") {
          return new InMemoryCodebaseScanQueueProducer();
        }

        return new BullMqCodebaseScanQueueProducer(config.queue.redisUrl);
      },
      inject: [API_RUNTIME_CONFIG]
    }
  ],
  exports: [REVIEW_QUEUE, CODEBASE_SCAN_QUEUE]
})
export class ReviewQueueModule {}

import { Controller, Get, Inject, NotFoundException, Param } from "@nestjs/common";
import type { ReviewRunDetail } from "@firmcode/shared";
import { REVIEW_RUNS_STORE, type ReviewRunsStore } from "./review-runs.store";

@Controller("api/review-runs")
export class ReviewRunsController {
  constructor(@Inject(REVIEW_RUNS_STORE) private readonly reviewRunsStore: ReviewRunsStore) {}

  @Get(":id")
  async getReviewRunDetail(@Param("id") id: string): Promise<ReviewRunDetail> {
    const detail = await this.reviewRunsStore.getReviewRunDetail(id);

    if (detail === null) {
      throw new NotFoundException("Review run not found");
    }

    return detail;
  }
}

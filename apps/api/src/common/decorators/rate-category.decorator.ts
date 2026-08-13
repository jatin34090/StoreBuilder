import { SetMetadata } from '@nestjs/common';
import type { RateCategoryKey } from '../guards/tenant-rate-limit.guard';

/** Apply an endpoint-category rate multiplier on top of the plan base limit. */
export const RateCategory = (category: RateCategoryKey) => SetMetadata('rateCategory', category);

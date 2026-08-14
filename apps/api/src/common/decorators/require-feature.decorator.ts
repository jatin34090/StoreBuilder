import { SetMetadata } from '@nestjs/common';
import type { PlanFeature } from '../constants/plan-config';

export const FEATURE_KEY = 'requiredFeature';
export const RequireFeature = (feature: PlanFeature) => SetMetadata(FEATURE_KEY, feature);

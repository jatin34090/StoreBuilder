import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Store } from '@prisma/client';

/** Injects the resolved Store object into a controller method parameter. */
export const CurrentStore = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Store | undefined => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.store;
  },
);

/** Injects just the storeId string. */
export const CurrentStoreId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.storeId;
  },
);

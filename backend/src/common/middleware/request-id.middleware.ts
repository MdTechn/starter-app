import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { requestContext, RequestContextStore } from '../request-context';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
  }
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming =
      (req.headers['x-request-id'] as string | undefined) ||
      (req.headers['x-correlation-id'] as string | undefined);
    const requestId = incoming?.trim() || randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    const store: RequestContextStore = { requestId };
    requestContext.run(store, () => next());
  }
}

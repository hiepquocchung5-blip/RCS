import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const startedAt = Date.now();
let requests = 0;
let errors = 0;
export interface RequestWithId extends Request { requestId?: string }

export function requestContext(req: RequestWithId, res: Response, next: NextFunction): void {
  const requestId = req.header("x-request-id")?.slice(0, 128) ?? randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  requests += 1;
  const start = Date.now();
  res.on("finish", () => {
    if (res.statusCode >= 500) errors += 1;
    console.log(JSON.stringify({ level: res.statusCode >= 500 ? "error" : "info", event: "http_request", requestId, method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - start }));
  });
  next();
}

export function metrics(): string {
  return `# TYPE rcs_uptime_seconds gauge\nrcs_uptime_seconds ${Math.floor((Date.now() - startedAt) / 1000)}\n# TYPE rcs_http_requests_total counter\nrcs_http_requests_total ${requests}\n# TYPE rcs_http_errors_total counter\nrcs_http_errors_total ${errors}\n`;
}

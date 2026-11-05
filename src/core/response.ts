import type { ErrorCode, ErrorResponse, ResponseMeta, ValueResponse } from "./types";

const ERRORS: Record<ErrorCode, { status: number; message: string }> = {
  UNAUTHORIZED: { status: 401, message: "Unauthorized" },
  NOT_FOUND: { status: 404, message: "Not found" },
  METHOD_NOT_ALLOWED: { status: 405, message: "Method not allowed" },
  INTERNAL_ERROR: { status: 500, message: "Internal error" },
};

function meta(): ResponseMeta {
  return { timestamp: Math.floor(Date.now() / 1000) };
}

export function ok<T = null>(data: T = null as T): Response {
  const body: ValueResponse<T> = { success: true, message: "OK", data, meta: meta() };
  return Response.json(body);
}

export function fail(code: ErrorCode): Response {
  const { status, message } = ERRORS[code];
  const body: ErrorResponse = { success: false, message, error: { code }, meta: meta() };
  return Response.json(body, { status });
}

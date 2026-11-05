export interface PlatformErrorDetails {
  status?: number;
  errorCode?: number;
  retryAfterSeconds?: number; // Set only when the platform states a wait time
}

// Carries only fields that are safe to log. Never attach a URL, token, or payload.
export class PlatformError extends Error {
  override readonly name = "PlatformError";
  readonly platform: string;
  readonly status?: number;
  readonly errorCode?: number;
  readonly retryAfterSeconds?: number;

  constructor(platform: string, details: PlatformErrorDetails = {}) {
    super("Platform request failed");
    this.platform = platform;
    this.status = details.status;
    this.errorCode = details.errorCode;
    this.retryAfterSeconds = details.retryAfterSeconds;
  }
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: unknown,
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message: string, code = 'VALIDATION_ERROR', details?: unknown) {
    return new AppError(400, code, message, details);
  }
  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED') {
    return new AppError(401, code, message);
  }
  static forbidden(message = 'You do not have permission to perform this action', code = 'FORBIDDEN') {
    return new AppError(403, code, message);
  }
  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new AppError(404, code, message);
  }
  static conflict(message: string, code = 'CONFLICT', details?: unknown) {
    return new AppError(409, code, message, details);
  }
  static tooMany(message = 'Too many requests. Please try again later.', code = 'RATE_LIMITED') {
    return new AppError(429, code, message);
  }
  static serviceUnavailable(message: string, code = 'SERVICE_UNAVAILABLE', details?: unknown) {
    return new AppError(503, code, message, details);
  }
}

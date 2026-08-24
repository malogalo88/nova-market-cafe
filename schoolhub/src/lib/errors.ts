export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }

  static badRequest(message = "Invalid request", details?: unknown) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = "You must be signed in") {
    return new ApiError(401, message);
  }
  static forbidden(message = "You do not have permission to do that") {
    return new ApiError(403, message);
  }
  static notFound(message = "Not found") {
    return new ApiError(404, message);
  }
  static conflict(message = "That conflicts with an existing record") {
    return new ApiError(409, message);
  }
}

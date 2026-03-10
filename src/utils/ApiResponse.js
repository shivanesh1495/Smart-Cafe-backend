/**
 * Standardized API Response wrapper
 * Matches the format expected by the frontend
 */
class ApiResponse {
  constructor(success, message, data = null) {
    this.success = success;
    this.message = message;
    if (data !== null) {
      this.data = data;
    }
  }

  static success(message, data = null) {
    return new ApiResponse(true, message, data);
  }

  static error(message, data = null) {
    return new ApiResponse(false, message, data);
  }

  /**
   * Send success response
   */
  static send(res, statusCode, message, data = null) {
    return res.status(statusCode).json(ApiResponse.success(message, data));
  }

  /**
   * Send created response (201)
   */
  static created(res, message, data = null) {
    return res.status(201).json(ApiResponse.success(message, data));
  }

  /**
   * Send OK response (200)
   */
  static ok(res, message, data = null) {
    return res.status(200).json(ApiResponse.success(message, data));
  }

  /**
   * Send bad request response (400)
   */
  static badRequest(res, message, data = null) {
    return res.status(400).json(ApiResponse.error(message, data));
  }

  /**
   * Send no content response (204)
   */
  static noContent(res) {
    return res.status(204).send();
  }

  /**
   * Send too many requests response (429)
   */
  static tooManyRequests(res, message, data = null) {
    return res.status(429).json(ApiResponse.error(message, data));
  }
}

module.exports = ApiResponse;

class AppError extends Error {
  constructor(message, statusCode = 400, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

function ensure(condition, message, statusCode = 400, details = null) {
  if (!condition) {
    throw new AppError(message, statusCode, details);
  }
}

module.exports = { AppError, ensure };

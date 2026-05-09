const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error(err);

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0] || 'field';
    const message = `${field} already exists`;
    error = { message, statusCode: 409 };
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Prisma foreign key constraint
  if (err.code === 'P2003') {
    const message = 'Invalid reference - related resource does not exist';
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 };
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors || {}).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
};

module.exports = { errorHandler, notFoundHandler };
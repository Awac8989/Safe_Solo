function notFoundHandler(_req, res) {
  res.status(404).json({ message: 'Endpoint not found' });
}

function errorHandler(err, _req, res, _next) {
  // eslint-disable-next-line no-console
  console.error(err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ message: err.message || 'Internal Server Error' });
}

module.exports = { notFoundHandler, errorHandler };
// Centralized error handler middleware
function errorHandler(err, req, res, next) {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    details: err.details || undefined
  });
}

// Simple input validation middleware generator
function validateBody(requiredFields) {
  return (req, res, next) => {
    const missing = requiredFields.filter(f => req.body[f] === undefined);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
    }
    next();
  };
}

module.exports = { errorHandler, validateBody };

function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const isDev = process.env.NODE_ENV === 'development';

  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    const messages = err.errors?.map((e) => e.message) || [err.message];
    return res.status(400).json({ error: { message: 'Validation error', details: messages } });
  }

  if (isDev && status === 500) {
    console.error(err.stack || err);
  }

  res.status(status).json({
    error: {
      message: err.message || 'Internal server error',
      ...(isDev && { stack: err.stack }),
    },
  });
}

module.exports = errorHandler;

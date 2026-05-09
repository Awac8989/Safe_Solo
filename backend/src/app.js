const cors = require('cors');
const express = require('express');

const { apiRouter } = require('./routes');
const adminPortalRoutes = require('./routes/adminPortalRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
  }),
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'safesolo-backend' });
});

app.use('/api', apiRouter);
app.use('/api/admin', adminPortalRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };

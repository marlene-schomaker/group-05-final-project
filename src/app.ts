import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { apiRateLimiter } from './middleware/rate-limiter.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

import authRoutes from './modules/auth/auth.routes.js';
import accountRoutes from './modules/account/account.routes.js';
import groupsRoutes from './modules/groups/groups.routes.js';
import eventsRoutes from './modules/events/events.routes.js';
import notificationsRoutes from './modules/notifications/notifications.routes.js';
import homeRoutes from './modules/home/home.routes.js';
import supportRoutes from './modules/support/support.routes.js';
import groupInvitesRoutes from './modules/invites/invites.routes.js';

export const app = express();
const clientDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'client',
);

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: '100kb' }));
app.use(express.static(clientDir));

app.use('/api', apiRateLimiter);

app.get(['/health', '/api/health'], (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (_req, res) => {
  res.status(200).json({
    name: 'Huddle Group Scheduler API',
    status: 'Server is running',
    version: '1.0.0',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api', eventsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/group-invites', groupInvitesRoutes);
app.use('/api/support', supportRoutes);

app.use('/api/v1/auth', authRoutes);

app.use(notFoundHandler);

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  const PORT = env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

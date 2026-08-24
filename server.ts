import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { config } from './backend/src/config/env.ts';
import authRoutes from './backend/src/routes/auth.routes.ts';
import venueRoutes from './backend/src/routes/venue.routes.ts';
import showRoutes from './backend/src/routes/show.routes.ts';
import seatRoutes from './backend/src/routes/seat.routes.ts';
import bookingRoutes from './backend/src/routes/booking.routes.ts';
import waitlistRoutes from './backend/src/routes/waitlist.routes.ts';
import { realtimeService } from './backend/src/services/realtime.service.ts';
import { holdExpiryJob } from './backend/src/jobs/holdExpiryJob.ts';

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = config.port || 3000;

  // Initialize Real-time WebSockets on /ws
  realtimeService.init(server);

  // Start background TTL sweeper for seat holds
  holdExpiryJob.start();

  // Body parser middleware
  app.use(express.json());

  // API Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Ticket Booking System API',
      timestamp: new Date().toISOString(),
      phase: 5,
    });
  });

  // Mount API Sub-routers
  app.use('/api/auth', authRoutes);
  app.use('/api/venues', venueRoutes);
  app.use('/api/admin/venues', venueRoutes);
  app.use('/api/shows', showRoutes);
  app.use('/api/seats', seatRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/waitlist', waitlistRoutes);

  // Vite middleware setup for Frontend SPA
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Ticket Booking System] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[Ticket Booking System] WebSocket gateway live on ws://0.0.0.0:${PORT}/ws`);
  });
}

startServer();

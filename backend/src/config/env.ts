import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ticket_booking_db?schema=public',
  jwtSecret: process.env.JWT_SECRET || 'ticket-booking-dev-jwt-super-secret-key-32chars',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  defaultSeatHoldTTLMinutes: Number(process.env.DEFAULT_SEAT_HOLD_TTL_MINUTES) || 10,
  defaultWaitlistOfferTTLMinutes: Number(process.env.DEFAULT_WAITLIST_OFFER_TTL_MINUTES) || 15,
  sweepIntervalSeconds: Number(process.env.SWEEP_INTERVAL_SECONDS) || 15,
  emailProvider: process.env.EMAIL_PROVIDER || 'console',
  emailFrom: process.env.EMAIL_FROM || 'Ticket Booking System <no-reply@ticketbooking.com>',
  emailFromName: process.env.EMAIL_FROM_NAME || 'Ticket Booking System',
  emailFromAddress: process.env.EMAIL_FROM_ADDRESS || 'no-reply@ticketbooking.com',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT) || 587,
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
};

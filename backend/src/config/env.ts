import dotenv from 'dotenv';
dotenv.config();

export function getEmailConfig() {
  const sendgridApiKey = (process.env.SENDGRID_API_KEY || '').trim();
  const emailFromName = (process.env.EMAIL_FROM_NAME || process.env.MAIL_FROM_NAME || 'Ticket Booking System').trim();
  let emailFromAddress = (process.env.EMAIL_FROM_ADDRESS || process.env.MAIL_FROM_ADDRESS || '').trim();

  // Also parse from composite EMAIL_FROM format if provided (e.g. "Velocity Pass <tickets@domain.com>")
  const rawEmailFrom = (process.env.EMAIL_FROM || '').trim();
  if (rawEmailFrom) {
    const match = rawEmailFrom.match(/(.*?)\s*<(.+?)>/);
    if (match) {
      emailFromAddress = match[2].trim();
    } else if (rawEmailFrom.includes('@')) {
      emailFromAddress = rawEmailFrom;
    }
  }

  if (!emailFromAddress) {
    emailFromAddress = 'no-reply@ticketbooking.com';
  }

  const emailProvider = (process.env.EMAIL_PROVIDER || process.env.MAIL_MAILER || (sendgridApiKey ? 'sendgrid' : 'smtp')).toLowerCase();
  const smtpHost = process.env.SMTP_HOST || process.env.MAIL_HOST || '';
  const smtpUser = process.env.SMTP_USER || process.env.SMTP_USERNAME || process.env.MAIL_USERNAME || '';
  const smtpPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.MAIL_PASSWORD || '';
  const smtpPort = Number(process.env.SMTP_PORT || process.env.MAIL_PORT) || 587;

  return {
    sendgridApiKey,
    emailFromName,
    emailFromAddress,
    emailFrom: `"${emailFromName}" <${emailFromAddress}>`,
    emailProvider,
    smtpHost,
    smtpUser,
    smtpPass,
    smtpPort,
  };
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ticket_booking_db?schema=public',
  jwtSecret: process.env.JWT_SECRET || 'ticket-booking-dev-jwt-super-secret-key-32chars',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  defaultSeatHoldTTLMinutes: Number(process.env.SEAT_HOLD_TTL_MINUTES || process.env.DEFAULT_SEAT_HOLD_TTL_MINUTES) || 10,
  defaultWaitlistOfferTTLMinutes: Number(process.env.WAITLIST_OFFER_TTL_MINUTES || process.env.DEFAULT_WAITLIST_OFFER_TTL_MINUTES) || 15,
  seedDatabase: process.env.SEED_DATABASE !== 'false',
  sweepIntervalSeconds: Number(process.env.SWEEP_INTERVAL_SECONDS) || 15,
  get sendgridApiKey() {
    return (process.env.SENDGRID_API_KEY || '').trim();
  },
  get emailFromName() {
    return getEmailConfig().emailFromName;
  },
  get emailFromAddress() {
    return getEmailConfig().emailFromAddress;
  },
  get emailFrom() {
    return getEmailConfig().emailFrom;
  },
  get emailProvider() {
    return getEmailConfig().emailProvider;
  },
  get smtpHost() {
    return getEmailConfig().smtpHost;
  },
  get smtpPort() {
    return getEmailConfig().smtpPort;
  },
  get smtpUser() {
    return getEmailConfig().smtpUser;
  },
  get smtpPass() {
    return getEmailConfig().smtpPass;
  },
};



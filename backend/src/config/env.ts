import dotenv from 'dotenv';
dotenv.config();

const rawEmailFrom = process.env.EMAIL_FROM || process.env.EMAIL_FROM_ADDRESS || process.env.MAIL_FROM_ADDRESS || '';
let parsedFromName = process.env.EMAIL_FROM_NAME || process.env.MAIL_FROM_NAME || 'Ticket Booking System';
let parsedFromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.MAIL_FROM_ADDRESS || '';

if (rawEmailFrom) {
  const match = rawEmailFrom.match(/(.*?)\s*<(.+?)>/);
  if (match) {
    parsedFromName = match[1].trim().replace(/^["']|["']$/g, '') || parsedFromName;
    parsedFromAddress = match[2].trim();
  } else if (rawEmailFrom.includes('@')) {
    parsedFromAddress = rawEmailFrom.trim();
  }
}

const emailProvider = (process.env.EMAIL_PROVIDER || process.env.MAIL_MAILER || 'smtp').toLowerCase();
let smtpHost = process.env.SMTP_HOST || process.env.MAIL_HOST || '';
let smtpUser = process.env.SMTP_USER || process.env.SMTP_USERNAME || process.env.MAIL_USERNAME || '';
let smtpPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.MAIL_PASSWORD || '';
let smtpPort = Number(process.env.SMTP_PORT || process.env.MAIL_PORT) || 587;

if (!smtpHost) {
  if (emailProvider === 'resend' || process.env.RESEND_API_KEY) {
    smtpHost = 'smtp.resend.com';
    smtpPort = Number(process.env.SMTP_PORT) || 465;
    smtpUser = process.env.SMTP_USER || 'resend';
    smtpPass = smtpPass || process.env.RESEND_API_KEY || '';
  } else if (emailProvider === 'sendgrid' || process.env.SENDGRID_API_KEY) {
    smtpHost = 'smtp.sendgrid.net';
    smtpPort = Number(process.env.SMTP_PORT) || 587;
    smtpUser = process.env.SMTP_USER || 'apikey';
    smtpPass = smtpPass || process.env.SENDGRID_API_KEY || '';
  } else if (emailProvider === 'gmail' || smtpHost.includes('gmail')) {
    smtpHost = 'smtp.gmail.com';
    smtpPort = Number(process.env.SMTP_PORT) || 465;
  }
}

// Ensure SMTP_USER and EMAIL_FROM address alignment for deliverability (especially for Gmail)
if (!parsedFromAddress) {
  if (smtpUser && smtpUser.includes('@')) {
    parsedFromAddress = smtpUser;
  } else {
    parsedFromAddress = 'no-reply@ticketbooking.com';
  }
} else if ((emailProvider === 'gmail' || smtpHost.includes('gmail')) && smtpUser && smtpUser.includes('@') && parsedFromAddress !== smtpUser) {
  console.log(`[Config] Aligning EMAIL_FROM with authenticated Gmail user (${smtpUser}) to prevent SPF rejection and inbox drop.`);
  parsedFromAddress = smtpUser;
}

const resolvedEmailFrom = `"${parsedFromName}" <${parsedFromAddress}>`;

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
  emailProvider,
  emailFrom: resolvedEmailFrom,
  emailFromName: parsedFromName,
  emailFromAddress: parsedFromAddress,
  smtpHost,
  smtpPort,
  smtpUser,
  smtpPass,
};


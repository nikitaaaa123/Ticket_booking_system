import sgMail from '@sendgrid/mail';
import nodemailer from 'nodemailer';
import { getEmailConfig } from '../config/env.ts';
import { Booking } from '../types/index.ts';

export interface BookingEmailData {
  recipientEmail: string;
  recipientName: string;
  bookingReference: string;
  showTitle: string;
  venueName: string;
  venueAddress: string;
  startTime: string;
  seatLabels: string[];
  totalAmountFormatted: string;
  qrCodeDataURL: string;
  qrCodeBuffer?: Buffer;
}

export interface WaitlistOfferEmailData {
  recipientEmail: string;
  recipientName: string;
  showTitle: string;
  venueName: string;
  venueAddress: string;
  startTime: string;
  seatLabel: string;
  priceFormatted: string;
  expiresAt: string;
  offerToken: string;
  claimUrl: string;
}

export interface EmailDispatchResult {
  success: boolean;
  sent: boolean;
  provider: 'sendgrid' | 'smtp' | 'sandbox';
  messageId?: string;
  statusCode?: number;
  message: string;
  error?: string;
}

/**
 * Validates and normalizes recipient email addresses
 */
export function validateRecipientEmail(rawEmail?: string | null): { valid: boolean; email: string; error?: string } {
  if (!rawEmail || typeof rawEmail !== 'string') {
    return { valid: false, email: '', error: 'Please enter a valid email address.' };
  }

  const trimmed = rawEmail.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmed)) {
    return { valid: false, email: trimmed, error: 'Please enter a valid email address.' };
  }

  return { valid: true, email: trimmed };
}

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;
  private static isInitialized = false;

  public static initLogging(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    const envConfig = getEmailConfig();
    const hasSendGridKey = Boolean(envConfig.sendgridApiKey);

    console.log('[EmailService] Mailer Service Configuration:');
    console.log(`  - SendGrid Configured: ${hasSendGridKey ? 'YES' : 'NO'}`);
    console.log(`  - Sender Name (EMAIL_FROM_NAME): "${envConfig.emailFromName}"`);
    console.log(`  - Sender Address (EMAIL_FROM_ADDRESS): <${envConfig.emailFromAddress}>`);
    if (hasSendGridKey) {
      console.log('  - Active Email Provider: SENDGRID REST API');
    } else if (envConfig.smtpHost && envConfig.smtpUser && envConfig.smtpPass) {
      console.log(`  - Active Email Provider: PRODUCTION SMTP (${envConfig.smtpHost}:${envConfig.smtpPort})`);
    } else {
      console.log('  - Active Email Provider: LOCAL SANDBOX / STREAM (Console logs for local testing)');
    }
  }

  /**
   * Helper to retrieve SMTP transporter if SMTP credentials are provided
   */
  private static getTransporter(): nodemailer.Transporter {
    const envConfig = getEmailConfig();

    if (!this.transporter) {
      if (envConfig.smtpHost && envConfig.smtpUser && envConfig.smtpPass) {
        this.transporter = nodemailer.createTransport({
          host: envConfig.smtpHost,
          port: envConfig.smtpPort,
          secure: envConfig.smtpPort === 465,
          auth: {
            user: envConfig.smtpUser,
            pass: envConfig.smtpPass,
          },
          tls: {
            rejectUnauthorized: false,
          },
        });
      } else {
        // Fallback / Sandbox logging transporter
        this.transporter = nodemailer.createTransport({
          streamTransport: true,
          newline: 'unix',
          buffer: true,
        });
      }
    }
    return this.transporter;
  }

  /**
   * Render clean, responsive HTML email template with embedded/CID QR code
   */
  public static renderBookingConfirmationHTML(data: BookingEmailData): string {
    const formattedDate = new Date(data.startTime).toLocaleString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    const seatPills = data.seatLabels
      .map(
        (seat) =>
          `<span style="display:inline-block;background-color:#E2E8F0;color:#0F172A;font-weight:700;font-size:14px;padding:6px 12px;border-radius:6px;margin:3px 4px 3px 0;">${seat}</span>`
      )
      .join(' ');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Booking Confirmation: ${data.bookingReference}</title>
</head>
<body style="margin:0;padding:0;background-color:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1E293B;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#F8FAFC;padding:32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:580px;background-color:#FFFFFF;border-radius:12px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05),0 2px 4px -2px rgba(0,0,0,0.05);overflow:hidden;border:1px solid #E2E8F0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color:#0F172A;padding:32px 32px 28px;text-align:center;">
              <div style="font-size:12px;font-weight:700;letter-spacing:1px;color:#94A3B8;text-transform:uppercase;margin-bottom:8px;">Booking Confirmed</div>
              <h1 style="margin:0;font-size:24px;font-weight:800;color:#FFFFFF;line-height:1.3;">${data.showTitle}</h1>
            </td>
          </tr>

          <!-- Booking Reference Header -->
          <tr>
            <td style="background-color:#F1F5F9;padding:16px 32px;border-bottom:1px solid #E2E8F0;text-align:center;">
              <span style="font-size:13px;color:#64748B;text-transform:uppercase;font-weight:600;">Booking Reference:</span>
              <span style="font-size:18px;font-weight:800;letter-spacing:1.5px;color:#2563EB;margin-left:8px;font-family:monospace;">${data.bookingReference}</span>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#334155;">
                Hello <strong>${data.recipientName}</strong>,<br>
                Your tickets are confirmed! Please present this confirmation email or display the QR code at the venue gate for rapid check-in.
              </p>

              <!-- Event Details Table -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #E2E8F0;font-size:14px;color:#64748B;width:30%;">Date & Time</td>
                  <td style="padding:14px 18px;border-bottom:1px solid #E2E8F0;font-size:14px;color:#0F172A;font-weight:600;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #E2E8F0;font-size:14px;color:#64748B;">Venue</td>
                  <td style="padding:14px 18px;border-bottom:1px solid #E2E8F0;font-size:14px;color:#0F172A;font-weight:600;">
                    ${data.venueName}<br>
                    <span style="font-size:12px;font-weight:400;color:#64748B;">${data.venueAddress}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #E2E8F0;font-size:14px;color:#64748B;">Seats (${data.seatLabels.length})</td>
                  <td style="padding:14px 18px;border-bottom:1px solid #E2E8F0;">${seatPills}</td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;font-size:14px;color:#64748B;">Total Paid</td>
                  <td style="padding:14px 18px;font-size:16px;color:#0F172A;font-weight:800;">${data.totalAmountFormatted}</td>
                </tr>
              </table>

              <!-- QR Code Ticket Section -->
              <div style="text-align:center;padding:20px 0 10px;">
                <div style="font-size:13px;font-weight:700;color:#64748B;text-transform:uppercase;margin-bottom:12px;letter-spacing:0.5px;">Gate Entry QR Pass</div>
                <div style="display:inline-block;padding:12px;background:#FFFFFF;border:2px solid #E2E8F0;border-radius:12px;">
                  <img src="cid:qrcode-pass" alt="Ticket Entry QR Code" width="220" height="220" style="display:block;border-radius:4px;margin:0 auto;" />
                </div>
                <p style="margin:8px 0 0;font-size:12px;color:#94A3B8;">Pass ID: ${data.bookingReference} &bull; Scan on arrival</p>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F8FAFC;padding:24px 32px;border-top:1px solid #E2E8F0;text-align:center;font-size:13px;color:#94A3B8;line-height:1.5;">
              Questions about this booking? Need assistance? Visit your booking management dashboard anytime.<br>
              &copy; ${new Date().getFullYear()} Ticket Booking System. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
  }

  /**
   * Primary method to send booking confirmation email via SendGrid or fallback transport
   */
  public static async sendBookingConfirmation(data: BookingEmailData): Promise<EmailDispatchResult> {
    const envConfig = getEmailConfig();
    const emailValidation = validateRecipientEmail(data.recipientEmail);

    if (!emailValidation.valid) {
      console.warn('[EmailService] Recipient email validation failed:', {
        recipientEmail: data.recipientEmail,
        error: emailValidation.error,
      });
      return {
        success: false,
        sent: false,
        provider: 'sandbox',
        error: emailValidation.error,
        message: `Booking confirmed, but confirmation email could not be sent: ${emailValidation.error}`,
      };
    }

    const recipientEmail = emailValidation.email;
    const recipientName = (data.recipientName || 'Valued Customer').trim();
    const senderEmail = envConfig.emailFromAddress;
    const senderName = envConfig.emailFromName;
    const subject = `Confirmed: Your tickets for ${data.showTitle} [Ref: ${data.bookingReference}]`;

    const htmlContent = this.renderBookingConfirmationHTML({
      ...data,
      recipientEmail,
      recipientName,
    });

    const textContent = `
Booking Confirmed!
Booking Reference: ${data.bookingReference}

Event: ${data.showTitle}
Date & Time: ${new Date(data.startTime).toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
Venue: ${data.venueName}
${data.venueAddress ? `Address: ${data.venueAddress}\n` : ''}Seats: ${data.seatLabels.join(', ')}
Total Paid: ${data.totalAmountFormatted}

Your ticket pass with QR check-in is confirmed. Present Pass ID ${data.bookingReference} at gate entrance.
`.trim();

    // Prepare QR Code base64 data for attachment/CID inline embedding
    let qrBase64 = '';
    if (data.qrCodeBuffer && Buffer.isBuffer(data.qrCodeBuffer)) {
      qrBase64 = data.qrCodeBuffer.toString('base64');
    } else if (data.qrCodeDataURL) {
      qrBase64 = data.qrCodeDataURL.replace(/^data:image\/[a-z]+;base64,/, '');
    }

    // 1. SendGrid API Delivery Flow
    if (envConfig.sendgridApiKey) {
      const apiKey = envConfig.sendgridApiKey;

      // Safely log email recipient without logging API key
      console.log(`EMAIL RECIPIENT: ${recipientEmail}`);

      try {
        sgMail.setApiKey(apiKey);

        const fromAddress = (process.env.EMAIL_FROM_ADDRESS || envConfig.emailFromAddress || senderEmail).trim();
        const fromName = (process.env.EMAIL_FROM_NAME || envConfig.emailFromName || senderName).trim();

        const msg: sgMail.MailDataRequired = {
          to: recipientEmail,
          from: fromName ? { email: fromAddress, name: fromName } : fromAddress,
          subject,
          text: textContent,
          html: htmlContent,
          attachments: qrBase64
            ? [
                {
                  content: qrBase64,
                  filename: `ticket-${data.bookingReference}.png`,
                  type: 'image/png',
                  disposition: 'inline',
                  content_id: 'qrcode-pass',
                  contentId: 'qrcode-pass',
                } as any,
              ]
            : [],
        };

        const [response] = await sgMail.send(msg);

        console.log('[EmailService] SendGrid API Accepted Dispatch:', {
          statusCode: response.statusCode,
          recipientEmail,
          senderEmail: fromAddress,
          messageId: (response.headers && response.headers['x-message-id']) || 'sendgrid-accepted',
        });

        return {
          success: true,
          sent: true,
          provider: 'sendgrid',
          statusCode: response.statusCode,
          messageId: (response.headers && response.headers['x-message-id']) as string,
          message: 'Booking confirmed and confirmation email sent.',
        };
      } catch (error: any) {
        const statusCode = error.code || error.response?.statusCode || error.response?.status || 500;
        const errorBody = error.response?.body || error.response?.data;
        const errorMessage = error.message || 'SendGrid API delivery failed';

        console.error('[EmailService] SendGrid API Error delivering confirmation email:', {
          senderEmail,
          recipientEmail,
          statusCode,
          errorMessage,
          errorBody: JSON.stringify(errorBody),
        });

        const detailMsg = errorBody?.errors?.[0]?.message || errorMessage;
        return {
          success: false,
          sent: false,
          provider: 'sendgrid',
          statusCode,
          error: detailMsg,
          message: `Booking confirmed, but confirmation email could not be sent: ${detailMsg}`,
        };
      }
    }

    // 2. SMTP Production Transport Flow
    if (envConfig.smtpHost && envConfig.smtpUser && envConfig.smtpPass) {
      console.log('[EmailService] Dispatching confirmation email via SMTP transport:', {
        hasSendGridApiKey: false,
        smtpHost: envConfig.smtpHost,
        smtpPort: envConfig.smtpPort,
        senderEmail,
        recipientEmail,
        subject,
      });

      try {
        const transporter = this.getTransporter();
        const info = await transporter.sendMail({
          from: envConfig.emailFrom,
          to: recipientEmail,
          subject,
          text: textContent,
          html: htmlContent,
          attachments: qrBase64
            ? [
                {
                  filename: `ticket-${data.bookingReference}.png`,
                  content: Buffer.from(qrBase64, 'base64'),
                  cid: 'qrcode-pass',
                  contentType: 'image/png',
                  contentDisposition: 'inline',
                },
              ]
            : [],
        });

        console.log('[EmailService] SMTP Server Accepted Dispatch:', {
          recipientEmail,
          messageId: info.messageId,
          response: info.response,
        });

        return {
          success: true,
          sent: true,
          provider: 'smtp',
          messageId: info.messageId,
          message: 'Booking confirmed and confirmation email sent.',
        };
      } catch (error: any) {
        console.error('[EmailService] SMTP Error delivering confirmation email:', {
          senderEmail,
          recipientEmail,
          errorMessage: error.message,
          code: error.code,
        });

        return {
          success: false,
          sent: false,
          provider: 'smtp',
          error: error.message,
          message: `Booking confirmed, but confirmation email could not be sent: ${error.message}`,
        };
      }
    }

    // 3. Fallback / Sandbox Logging Mode (when SENDGRID_API_KEY and SMTP credentials are not configured)
    console.log('[EmailService] SENDGRID_API_KEY is not configured. Running in Local Sandbox / Console Log mode.');
    console.log('[EmailService] [Sandbox Preview]', {
      hasSendGridApiKey: false,
      senderEmail,
      recipientEmail,
      subject,
      bookingReference: data.bookingReference,
    });

    return {
      success: true,
      sent: false,
      provider: 'sandbox',
      message: 'Booking confirmed, but email delivery is in sandbox mode (SENDGRID_API_KEY not configured).',
    };
  }

  /**
   * Render clean, responsive HTML email for time-limited waitlist offers
   */
  public static renderWaitlistOfferHTML(data: WaitlistOfferEmailData): string {
    const formattedDate = new Date(data.startTime).toLocaleString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    const formattedExpiry = new Date(data.expiresAt).toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    });

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>A seat has opened up for ${data.showTitle}!</title>
</head>
<body style="margin:0;padding:0;background-color:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1E293B;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#F8FAFC;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:580px;background-color:#FFFFFF;border-radius:12px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);overflow:hidden;border:1px solid #E2E8F0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color:#1E3A8A;padding:32px 32px 28px;text-align:center;">
              <div style="font-size:12px;font-weight:700;letter-spacing:1px;color:#93C5FD;text-transform:uppercase;margin-bottom:8px;">Waitlist Exclusive Offer</div>
              <h1 style="margin:0;font-size:24px;font-weight:800;color:#FFFFFF;line-height:1.3;">A Seat Just Opened Up!</h1>
            </td>
          </tr>

          <!-- Countdown Notice -->
          <tr>
            <td style="background-color:#FEF3C7;padding:14px 32px;border-bottom:1px solid #FDE68A;text-align:center;">
              <span style="font-size:14px;font-weight:700;color:#92400E;">⏳ Action Required: Offer expires at ${formattedExpiry}</span>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#334155;">
                Hello <strong>${data.recipientName}</strong>,<br>
                Great news! A ticket has become available for <strong>${data.showTitle}</strong> and you are at the front of the waitlist queue.
              </p>

              <!-- Offer Details Table -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #E2E8F0;font-size:14px;color:#64748B;width:30%;">Event</td>
                  <td style="padding:14px 18px;border-bottom:1px solid #E2E8F0;font-size:14px;color:#0F172A;font-weight:700;">${data.showTitle}</td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #E2E8F0;font-size:14px;color:#64748B;">Date & Time</td>
                  <td style="padding:14px 18px;border-bottom:1px solid #E2E8F0;font-size:14px;color:#0F172A;font-weight:600;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #E2E8F0;font-size:14px;color:#64748B;">Venue</td>
                  <td style="padding:14px 18px;border-bottom:1px solid #E2E8F0;font-size:14px;color:#0F172A;font-weight:600;">${data.venueName}</td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #E2E8F0;font-size:14px;color:#64748B;">Reserved Seat</td>
                  <td style="padding:14px 18px;border-bottom:1px solid #E2E8F0;font-size:14px;color:#0F172A;font-weight:700;">${data.seatLabel}</td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;font-size:14px;color:#64748B;">Ticket Price</td>
                  <td style="padding:14px 18px;font-size:16px;color:#0F172A;font-weight:800;">${data.priceFormatted}</td>
                </tr>
              </table>

              <!-- Call to Action Button -->
              <div style="text-align:center;margin:32px 0 16px;">
                <a href="${data.claimUrl}" style="display:inline-block;background-color:#2563EB;color:#FFFFFF;font-weight:700;font-size:16px;text-decoration:none;padding:14px 36px;border-radius:8px;box-shadow:0 4px 6px -1px rgba(37,99,235,0.25);">
                  Claim & Complete Booking &rarr;
                </a>
              </div>
              <p style="text-align:center;font-size:12px;color:#94A3B8;margin-top:8px;">
                If the button above does not work, visit: <br>
                <a href="${data.claimUrl}" style="color:#2563EB;word-break:break-all;">${data.claimUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F8FAFC;padding:24px 32px;border-top:1px solid #E2E8F0;text-align:center;font-size:13px;color:#94A3B8;line-height:1.5;">
              Ticket Booking System &bull; Waitlist Notification Service<br>
              &copy; ${new Date().getFullYear()} Ticket Booking System. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
  }

  /**
   * Sends waitlist offer email with direct checkout link
   */
  public static async sendWaitlistOffer(data: WaitlistOfferEmailData): Promise<{ success: boolean; messageId?: string }> {
    const envConfig = getEmailConfig();
    const emailValidation = validateRecipientEmail(data.recipientEmail);

    if (!emailValidation.valid) {
      console.warn('[EmailService] Invalid recipient email for waitlist offer:', data.recipientEmail);
      return { success: false };
    }

    const recipientEmail = emailValidation.email;
    const recipientName = (data.recipientName || 'Valued Customer').trim();
    const senderEmail = envConfig.emailFromAddress;
    const senderName = envConfig.emailFromName;
    const subject = `Seat Available! Claim your ticket for ${data.showTitle} before it expires`;
    const htmlContent = this.renderWaitlistOfferHTML({ ...data, recipientEmail, recipientName });
    const textContent = `
A seat just opened up for ${data.showTitle}!

Hello ${recipientName},
Good news! A seat (${data.seatLabel}) has become available for you for ${data.showTitle} at ${data.venueName} (${data.priceFormatted}).

Claim your ticket before the expiration deadline:
${data.claimUrl}

If you do not claim it in time, it will automatically be offered to the next waitlist candidate.
`.trim();

    if (envConfig.sendgridApiKey) {
      try {
        sgMail.setApiKey(envConfig.sendgridApiKey);
        const [response] = await sgMail.send({
          to: recipientEmail,
          from: {
            email: senderEmail,
            name: senderName,
          },
          subject,
          text: textContent,
          html: htmlContent,
        });

        console.log('[EmailService] SendGrid Accepted Waitlist Offer:', {
          statusCode: response.statusCode,
          recipientEmail,
          senderEmail,
        });
        return { success: true, messageId: (response.headers && response.headers['x-message-id']) as string };
      } catch (error: any) {
        console.error('[EmailService] SendGrid Waitlist Offer Error:', {
          errorMessage: error.message,
          errorBody: error.response?.body,
        });
        return { success: false };
      }
    }

    if (envConfig.smtpHost && envConfig.smtpUser && envConfig.smtpPass) {
      try {
        const transporter = this.getTransporter();
        const info = await transporter.sendMail({
          from: envConfig.emailFrom,
          to: recipientEmail,
          subject,
          text: textContent,
          html: htmlContent,
        });
        return { success: true, messageId: info.messageId };
      } catch (error: any) {
        console.error('[EmailService] SMTP Waitlist Offer Error:', error.message);
        return { success: false };
      }
    }

    console.log(`[EmailService Sandbox] Waitlist Offer generated for ${recipientEmail}, claimUrl: ${data.claimUrl}`);
    return { success: true, messageId: 'sandbox-waitlist-offer' };
  }
}

/**
 * Standalone reusable function to send booking confirmation emails
 * Strictly invoked ONLY after the booking has been successfully created and committed.
 */
export async function sendBookingConfirmationEmail(
  booking: Booking,
  customer: { email?: string; name?: string },
  showDetails?: {
    showTitle?: string;
    venueName?: string;
    venueAddress?: string;
    startTime?: string;
    seatLabels?: string[];
    qrCodeDataURL?: string;
    qrCodeBuffer?: Buffer;
  }
): Promise<EmailDispatchResult> {
  const recipientEmail = customer.email || booking.customerEmail || '';
  const recipientName = customer.name || booking.customerName || 'Valued Customer';
  const showTitle = showDetails?.showTitle || (booking as any).showTitle || 'Event Performance';
  const venueName = showDetails?.venueName || (booking as any).venueName || 'Grand Stage Venue';
  const venueAddress = showDetails?.venueAddress || '';
  const startTime = showDetails?.startTime || (booking as any).showStartTime || booking.createdAt || new Date().toISOString();
  const seatLabels =
    showDetails?.seatLabels ||
    (booking.items && booking.items.length > 0
      ? booking.items.map((item) => item.seatLabel)
      : ['General Admission']);
  const totalAmountFormatted = `$${(booking.totalAmountCents / 100).toFixed(2)}`;
  const qrCodeDataURL = showDetails?.qrCodeDataURL || booking.qrCodeDataURL || '';
  const qrCodeBuffer = showDetails?.qrCodeBuffer;

  return await EmailService.sendBookingConfirmation({
    recipientEmail,
    recipientName,
    bookingReference: booking.bookingReference,
    showTitle,
    venueName,
    venueAddress,
    startTime,
    seatLabels,
    totalAmountFormatted,
    qrCodeDataURL,
    qrCodeBuffer,
  });
}

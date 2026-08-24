import nodemailer from 'nodemailer';
import { config } from '../config/env.ts';

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

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;
  private static isInitialized = false;

  public static initLogging(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    console.log('[EmailService] Mailer Service Initialized:');
    console.log(`  - Provider: ${config.emailProvider}`);
    console.log(`  - SMTP Host: ${config.smtpHost || '(none - stream transport active)'}`);
    console.log(`  - SMTP Port: ${config.smtpPort}`);
    console.log(`  - SMTP User: ${config.smtpUser ? config.smtpUser.slice(0, 3) + '***' : '(none)'}`);
    console.log(`  - From: "${config.emailFromName}" <${config.emailFromAddress}>`);
    if (config.smtpHost && config.smtpUser && config.smtpPass) {
      console.log('  - Mode: PRODUCTION SMTP READY');
    } else {
      console.log('  - Mode: LOCAL STREAM / SANDBOX (Console Output)');
    }
  }

  private static getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      this.initLogging();

      if (config.smtpHost && config.smtpUser && config.smtpPass) {
        // Production SMTP (Gmail App Password, Resend SMTP, SendGrid, Amazon SES, etc.)
        this.transporter = nodemailer.createTransport({
          host: config.smtpHost,
          port: config.smtpPort,
          secure: config.smtpPort === 465,
          auth: {
            user: config.smtpUser,
            pass: config.smtpPass,
          },
          tls: {
            rejectUnauthorized: false,
          },
        });
      } else {
        // Fallback / Sandbox logging transporter when env vars are not configured
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
   * Render clean, responsive HTML email template with embedded QR code
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
                  <img src="${data.qrCodeBuffer ? 'cid:qrcode-pass' : data.qrCodeDataURL}" alt="Ticket Entry QR Code" width="220" height="220" style="display:block;border-radius:4px;margin:0 auto;" />
                </div>
                <p style="margin:8px 0 0;font-size:12px;color:#94A3B8;">Pass ID: ${data.bookingReference} &bull; Scan on arrival</p>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F8FAFC;padding:24px 32px;border-top:1px solid #E2E8F0;text-align:center;font-size:13px;color:#94A3B8;line-height:1.5;">
              Questions about this booking? Need to cancel or reschedule? Visit your booking management dashboard anytime.<br>
              &copy; ${new Date().getFullYear()} Ticket Booking System. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
  }

  /**
   * Sends booking confirmation email via configured SMTP or outputs debug stream
   */
  public static async sendBookingConfirmation(data: BookingEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const transporter = this.getTransporter();
      const htmlContent = this.renderBookingConfirmationHTML(data);

      console.log(`[EmailService] Preparing booking confirmation email for ${data.recipientEmail} (Ref: ${data.bookingReference})...`);

      const mailOptions: nodemailer.SendMailOptions = {
        from: config.emailFrom || `"${config.emailFromName}" <${config.emailFromAddress}>`,
        to: data.recipientEmail,
        subject: `Confirmed: Your tickets for ${data.showTitle} [Ref: ${data.bookingReference}]`,
        html: htmlContent,
        attachments: data.qrCodeBuffer
          ? [
              {
                filename: `ticket-${data.bookingReference}.png`,
                content: data.qrCodeBuffer,
                cid: 'qrcode-pass',
                contentType: 'image/png',
                contentDisposition: 'inline',
              },
            ]
          : [],
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`[EmailService] Sent confirmation email to ${data.recipientEmail} [MessageID: ${info.messageId || 'sandbox-stream'}]`);
      if (info.message) {
        console.log(`[EmailService Sandbox Message Generated] To: ${data.recipientEmail}, Ref: ${data.bookingReference}`);
      }
      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      console.error('[EmailService] SMTP Error sending booking confirmation:', {
        message: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        host: config.smtpHost,
        port: config.smtpPort,
        user: config.smtpUser ? `${config.smtpUser.slice(0, 3)}***` : undefined,
        stack: error.stack,
      });
      return { success: false, error: error.message };
    }
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

              <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#64748B;border-top:1px solid #E2E8F0;padding-top:16px;">
                <strong>Note:</strong> If you do not claim this ticket before the deadline, it will automatically be offered to the next person in line.
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
`;
  }

  /**
   * Sends waitlist offer email with direct checkout link
   */
  public static async sendWaitlistOffer(data: WaitlistOfferEmailData): Promise<{ success: boolean; messageId?: string }> {
    try {
      const transporter = this.getTransporter();
      const htmlContent = this.renderWaitlistOfferHTML(data);

      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${config.emailFromName}" <${config.emailFromAddress}>`,
        to: data.recipientEmail,
        subject: `Seat Available! Claim your ticket for ${data.showTitle} before it expires`,
        html: htmlContent,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`[EmailService] Sent waitlist offer email to ${data.recipientEmail} [MessageID: ${info.messageId || 'sandbox-stream'}]`);
      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      console.error('[EmailService] Failed to send waitlist email:', error.message);
      return { success: false };
    }
  }
}

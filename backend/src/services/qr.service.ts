import QRCode from 'qrcode';

export interface TicketQRPayload {
  ref: string;
  showId: string;
  showTitle: string;
  seats: string[];
  userId: string;
  confirmedAt: string;
}

export class QRService {
  /**
   * Generates a base64 Data URL for embedding directly in web pages and emails (<img src="data:image/png;base64,...">)
   */
  public static async generateDataURL(payload: TicketQRPayload | string): Promise<string> {
    const textData = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return await QRCode.toDataURL(textData, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      margin: 2,
      width: 280,
      color: {
        dark: '#0F172A', // Slate 900
        light: '#FFFFFF',
      },
    });
  }

  /**
   * Generates a raw PNG Buffer for sending as a standard MIME attachment or CID inline email image
   */
  public static async generateBuffer(payload: TicketQRPayload | string): Promise<Buffer> {
    const textData = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return await QRCode.toBuffer(textData, {
      errorCorrectionLevel: 'H',
      type: 'png',
      margin: 2,
      width: 280,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    });
  }
}

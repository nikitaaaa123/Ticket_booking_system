import { WebSocket, WebSocketServer } from 'ws';
import http from 'http';
import { RealtimeSeatEvent } from '../types/index.ts';

interface ClientConnection {
  ws: WebSocket;
  showId: string | null;
  userId?: string;
  subscribedAt: Date;
}

class RealtimeService {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, ClientConnection> = new Map();

  public init(server: http.Server): WebSocketServer {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      const clientInfo: ClientConnection = {
        ws,
        showId: null,
        subscribedAt: new Date(),
      };
      this.clients.set(ws, clientInfo);

      // Send initial connection ack
      this.safeSend(ws, {
        type: 'CONNECTED',
        message: 'Connected to Ticket Booking Real-time Gateway',
        timestamp: new Date().toISOString(),
      });

      ws.on('message', (rawMessage: string) => {
        try {
          const payload = JSON.parse(rawMessage.toString());
          const action = (payload.action || '').toUpperCase();
          if ((action === 'SUBSCRIBE_SHOW' || action === 'SUBSCRIBE') && payload.showId) {
            clientInfo.showId = payload.showId;
            if (payload.userId) clientInfo.userId = payload.userId;

            this.safeSend(ws, {
              type: 'SUBSCRIBED',
              showId: payload.showId,
              message: `Subscribed to real-time seat updates for show ${payload.showId}`,
            });
          } else if (action === 'UNSUBSCRIBE' || action === 'UNSUBSCRIBE_SHOW') {
            clientInfo.showId = null;
          } else if (action === 'PING') {
            this.safeSend(ws, { type: 'PONG', timestamp: Date.now() });
          }
        } catch {
          // Ignore malformed client messages
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });
    });

    return this.wss;
  }

  /**
   * Broadcast an event to all connected clients actively viewing a specific show
   */
  public broadcastToShow(showId: string, event: RealtimeSeatEvent | any): void {
    const payload = JSON.stringify({
      ...event,
      timestamp: new Date().toISOString(),
    });

    for (const [ws, client] of this.clients.entries()) {
      if (client.showId === showId && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(payload);
        } catch (err) {
          console.error('[RealtimeService] Failed to send WS message to client:', err);
        }
      }
    }
  }

  /**
   * Broadcast directly to a specific user (e.g. for private waitlist offer alert)
   */
  public broadcastToUser(userId: string, event: any): void {
    const payload = JSON.stringify({
      ...event,
      timestamp: new Date().toISOString(),
    });

    for (const [ws, client] of this.clients.entries()) {
      if (client.userId === userId && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(payload);
        } catch (err) {
          console.error('[RealtimeService] Failed to send user-scoped WS message:', err);
        }
      }
    }
  }

  public getActiveSubscribersCount(showId: string): number {
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.showId === showId && client.ws.readyState === WebSocket.OPEN) {
        count++;
      }
    }
    return count;
  }

  private safeSend(ws: WebSocket, data: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(data));
      } catch {
        // Handle socket teardown silently
      }
    }
  }
}

export const realtimeService = new RealtimeService();

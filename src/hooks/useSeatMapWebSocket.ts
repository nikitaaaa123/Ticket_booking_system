import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getWebSocketUrl } from '../services/api.ts';
import { RealtimeSeatEvent } from '../../backend/src/types/index.ts';

interface UseSeatMapWebSocketProps {
  showId: string | null;
  onSeatEvent?: (event: RealtimeSeatEvent) => void;
  onRefreshNeeded?: () => void;
}

export function useSeatMapWebSocket({
  showId,
  onSeatEvent,
  onRefreshNeeded,
}: UseSeatMapWebSocketProps) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastEvent, setLastEvent] = useState<RealtimeSeatEvent | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const connect = useCallback(() => {
    if (!showId) return;

    // Clean up previous socket if open
    if (socketRef.current) {
      socketRef.current.close();
    }

    try {
      const wsUrl = getWebSocketUrl();
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Subscribe to show room
        ws.send(
          JSON.stringify({
            action: 'subscribe',
            showId,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'SUBSCRIBED') {
            return;
          }

          setLastEvent(payload);
          if (onSeatEvent) {
            onSeatEvent(payload);
          }
          if (onRefreshNeeded) {
            onRefreshNeeded();
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Reconnect after backoff if component is still mounted
        reconnectTimeoutRef.current = setTimeout(() => {
          if (showId) connect();
        }, 3000);
      };

      ws.onerror = (err) => {
        console.warn('WebSocket error:', err);
        ws.close();
      };
    } catch (e) {
      console.warn('Could not establish WebSocket connection:', e);
    }
  }, [showId, onSeatEvent, onRefreshNeeded]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        if (socketRef.current.readyState === WebSocket.OPEN && showId) {
          try {
            socketRef.current.send(
              JSON.stringify({
                action: 'unsubscribe',
                showId,
              })
            );
          } catch {}
        }
        socketRef.current.close();
      }
    };
  }, [connect, showId]);

  return { isConnected, lastEvent };
}

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
  const pingIntervalRef = useRef<any>(null);
  const isUnmountedRef = useRef<boolean>(false);

  // Store latest callbacks in refs so changes in caller references do NOT trigger socket reconnects
  const onSeatEventRef = useRef(onSeatEvent);
  onSeatEventRef.current = onSeatEvent;

  const onRefreshNeededRef = useRef(onRefreshNeeded);
  onRefreshNeededRef.current = onRefreshNeeded;

  useEffect(() => {
    isUnmountedRef.current = false;

    if (!showId) {
      setIsConnected(false);
      return;
    }

    const connect = () => {
      if (isUnmountedRef.current) return;

      // Close existing socket if open
      if (socketRef.current) {
        try {
          socketRef.current.onclose = null;
          socketRef.current.onerror = null;
          socketRef.current.close();
        } catch {}
        socketRef.current = null;
      }

      try {
        const wsUrl = getWebSocketUrl();
        console.log(`[WebSocket] Connecting to ${wsUrl} for show ${showId}...`);
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          if (isUnmountedRef.current) {
            ws.close();
            return;
          }
          console.log(`[WebSocket] Connected successfully to real-time gateway`);
          setIsConnected(true);

          // Subscribe to show room
          ws.send(
            JSON.stringify({
              action: 'SUBSCRIBE_SHOW',
              showId,
            })
          );

          // Setup ping heartbeat every 25s
          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ action: 'PING' }));
            }
          }, 25000);
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === 'PONG' || payload.type === 'CONNECTED' || payload.type === 'SUBSCRIBED') {
              return;
            }

            // Scoping Isolation: Discard seat events for any show other than the active showId
            if (payload.showId && payload.showId !== showId) {
              console.debug(`[WebSocket] Ignored seat update for show ${payload.showId} while viewing show ${showId}`);
              return;
            }

            setLastEvent(payload);

            if (onSeatEventRef.current) {
              onSeatEventRef.current(payload);
            }
            if (onRefreshNeededRef.current) {
              onRefreshNeededRef.current();
            }
          } catch (err) {
            console.error('[WebSocket] Failed to parse message:', err);
          }
        };

        ws.onclose = (event) => {
          console.log(`[WebSocket] Connection closed (code: ${event.code})`);
          setIsConnected(false);
          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

          if (!isUnmountedRef.current && showId) {
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, 3000);
          }
        };

        ws.onerror = (err) => {
          console.warn('[WebSocket] Encountered error:', err);
          try {
            ws.close();
          } catch {}
        };
      } catch (e) {
        console.warn('[WebSocket] Connection initialization error:', e);
        if (!isUnmountedRef.current && showId) {
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      }
    };

    connect();

    return () => {
      isUnmountedRef.current = true;
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

      if (socketRef.current) {
        try {
          if (socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(
              JSON.stringify({
                action: 'UNSUBSCRIBE',
                showId,
              })
            );
          }
          socketRef.current.onclose = null;
          socketRef.current.onerror = null;
          socketRef.current.close();
        } catch {}
        socketRef.current = null;
      }
    };
  }, [showId]);

  return { isConnected, lastEvent };
}

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getToken } from '@/lib/AuthContext';

export default function useRealtimeSync(familyCode) {
  const queryClient = useQueryClient();
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  useEffect(() => {
    if (!familyCode) return;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        // The server picks the room from the token; family_code is not sent.
        ws.send(JSON.stringify({ type: 'join', token: getToken() }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const entity = msg.type?.split('_')[0]; // e.g. "children" from "children_updated"

          // Invalidate relevant queries based on the event type
          if (msg.type === 'points_updated') {
            queryClient.invalidateQueries(['children']);
          } else if (entity) {
            queryClient.invalidateQueries([entity]);
          }
        } catch {}
      };

      ws.onclose = () => {
        // Auto-reconnect after 3 seconds
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [familyCode, queryClient]);
}

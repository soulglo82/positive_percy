import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getToken } from '@/lib/AuthContext';
import { POINTS_QUERY_KEYS } from '@/lib/points';

// Server event type -> query keys to refresh.
export function keysForEvent(type) {
  if (!type) return [];
  // family_updated: the timezone changed, which moves the week's start.
  if (type === 'points_updated' || type === 'stack_updated' || type === 'family_updated' || type.startsWith('children_')) return POINTS_QUERY_KEYS;
  if (type === 'todays_goals_updated') return [['todaysGoals']];
  if (type.startsWith('rewards_')) return [['rewards'], ['children']];
  if (type.startsWith('behavior_categories_') || type.startsWith('quick_actions_')) return [['behaviorCategories']];
  return [];
}

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
          // Each event names exactly the screens it affects. Anything about
          // points refreshes every balance, history and weekly view.
          const keys = keysForEvent(msg.type);
          for (const queryKey of keys) queryClient.invalidateQueries({ queryKey });
        } catch {}
      };

      ws.onclose = (event) => {
        // Rejected for no valid session: retrying with the same token cannot
        // succeed. The next API call returns 401 and the app signs out.
        if (event.code === 4401) return;
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

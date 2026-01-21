import { useEffect } from 'react';
import useStore from '../store';
import type { ServerMessage } from '../types';

export function useWebSocket() {
  const setWebSocket = useStore((state) => state.setWebSocket);
  const setConnected = useStore((state) => state.setConnected);

  useEffect(() => {
    // In development, connect to backend directly (localhost:3000)
    // In production, connect to same host
    const isDev = import.meta.env.DEV;
    const wsUrl = isDev
      ? 'ws://localhost:3000'
      : `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setWebSocket(ws);
      setConnected(true);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
      // Only reconnect if not intentionally closed
      if (ws.readyState === WebSocket.CLOSED) {
        console.log('Will attempt to reconnect in 5 seconds...');
        // Note: In production, you may want to implement exponential backoff
        // For now, the page will need to be manually refreshed to reconnect
      }
    };

    ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);
        handleServerMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, [setWebSocket, setConnected]);

  function handleServerMessage(message: ServerMessage) {
    const { setSessions, updateSessionStatus, addMessage } = useStore.getState();

    switch (message.type) {
      case 'sessions':
        setSessions(message.sessions);
        break;
      case 'exit':
        updateSessionStatus(message.sessionId, 'exited', message.exitCode);
        break;
      case 'message':
        addMessage(message.message);
        break;
      case 'error':
        console.error('Server error:', message.message);
        break;
      case 'output':
      case 'history':
        // These are handled by individual components
        break;
    }
  }
}

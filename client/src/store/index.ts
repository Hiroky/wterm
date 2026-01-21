import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { SessionInfo, Config, Message } from '../types';

interface AppState {
  // State
  sessions: SessionInfo[];
  activeSessionId: string | null;
  config: Config | null;
  wsConnection: WebSocket | null;
  isConnected: boolean;
  messages: Message[];

  // Session Actions
  setSessions: (sessions: SessionInfo[]) => void;
  addSession: (session: SessionInfo) => void;
  removeSession: (id: string) => void;
  updateSessionStatus: (id: string, status: 'running' | 'exited', exitCode?: number) => void;
  setActiveSession: (id: string) => void;

  // Message Actions
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;

  // Config Actions
  setConfig: (config: Config) => void;
  updateConfig: (updates: Partial<Config>) => void;

  // WebSocket Actions
  setWebSocket: (ws: WebSocket) => void;
  setConnected: (connected: boolean) => void;
}

const useStore = create<AppState>()(
  devtools(
    (set) => ({
      sessions: [],
      activeSessionId: null,
      config: null,
      wsConnection: null,
      isConnected: false,
      messages: [],

      setSessions: (sessions) => set({ sessions }),

      addSession: (session) =>
        set((state) => ({
          sessions: [...state.sessions, session],
        })),

      removeSession: (id) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
        })),

      updateSessionStatus: (id, status, exitCode) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, status, exitCode } : s
          ),
        })),

      setActiveSession: (id) => set({ activeSessionId: id }),

      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message].slice(-50), // Keep last 50 messages
        })),

      setMessages: (messages) => set({ messages }),

      setConfig: (config) => set({ config }),

      updateConfig: (updates) =>
        set((state) => ({
          config: state.config ? { ...state.config, ...updates } : null,
        })),

      setWebSocket: (ws) => set({ wsConnection: ws }),

      setConnected: (connected) => set({ isConnected: connected }),
    }),
    { name: 'wterm-store' }
  )
);

export default useStore;

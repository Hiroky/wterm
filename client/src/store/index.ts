import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { SessionInfo, Config, Message, Workspace, LayoutNode } from '../types';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

interface AppState {
  // State
  sessions: SessionInfo[];
  activeSessionId: string | null;
  config: Config | null;
  wsConnection: WebSocket | null;
  isConnected: boolean;
  isReconnecting: boolean;
  messages: Message[];
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  activeDragId: string | null;
  toasts: ToastMessage[];

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

  // Workspace Actions
  setWorkspaces: (workspaces: Workspace[]) => void;
  addWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  deleteWorkspace: (id: string) => void;
  setActiveWorkspace: (id: string) => void;
  updateLayout: (workspaceId: string, layout: LayoutNode | null) => void;

  // WebSocket Actions
  setWebSocket: (ws: WebSocket) => void;
  setConnected: (connected: boolean) => void;
  setReconnecting: (reconnecting: boolean) => void;

  // Drag Actions
  setActiveDragId: (id: string | null) => void;

  // Toast Actions
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

const useStore = create<AppState>()(
  devtools(
    (set) => ({
      sessions: [],
      activeSessionId: null,
      config: null,
      wsConnection: null,
      isConnected: false,
      isReconnecting: false,
      messages: [],
      workspaces: [],
      activeWorkspaceId: null,
      activeDragId: null,
      toasts: [],

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

      setWorkspaces: (workspaces) => set({ workspaces }),

      addWorkspace: (workspace) =>
        set((state) => ({
          workspaces: [...state.workspaces, workspace],
        })),

      updateWorkspace: (id, updates) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === id ? { ...w, ...updates, updatedAt: new Date().toISOString() } : w
          ),
        })),

      deleteWorkspace: (id) =>
        set((state) => ({
          workspaces: state.workspaces.filter((w) => w.id !== id),
          activeWorkspaceId: state.activeWorkspaceId === id ? state.workspaces[0]?.id || null : state.activeWorkspaceId,
        })),

      setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

      updateLayout: (workspaceId, layout) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === workspaceId
              ? { ...w, layout, updatedAt: new Date().toISOString() }
              : w
          ),
        })),

      setWebSocket: (ws) => set({ wsConnection: ws }),

      setConnected: (connected) => set({ isConnected: connected }),

      setReconnecting: (reconnecting) => set({ isReconnecting: reconnecting }),

      setActiveDragId: (id) => set({ activeDragId: id }),

      addToast: (toast) =>
        set((state) => ({
          toasts: [
            ...state.toasts,
            { ...toast, id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` },
          ],
        })),

      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),
    }),
    { name: 'wterm-store' }
  )
);

export default useStore;

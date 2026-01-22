import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { SessionInfo, Config, Message, Workspace, LayoutNode } from '../types';

interface AppState {
  // State
  sessions: SessionInfo[];
  activeSessionId: string | null;
  config: Config | null;
  wsConnection: WebSocket | null;
  isConnected: boolean;
  messages: Message[];
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  activeDragId: string | null;

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
  updateLayout: (workspaceId: string, layout: LayoutNode) => void;

  // WebSocket Actions
  setWebSocket: (ws: WebSocket) => void;
  setConnected: (connected: boolean) => void;

  // Drag Actions
  setActiveDragId: (id: string | null) => void;
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
      workspaces: [],
      activeWorkspaceId: null,
      activeDragId: null,

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

      setActiveDragId: (id) => set({ activeDragId: id }),
    }),
    { name: 'wterm-store' }
  )
);

export default useStore;

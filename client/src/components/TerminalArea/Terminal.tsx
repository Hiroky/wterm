import { useEffect, useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import useStore from '../../store';
import DropZone from './DropZone';
import { removeSessionFromTree } from '../../utils/layoutTree';
import { registerTerminal, unregisterTerminal } from '../../utils/terminalRegistry';
import 'xterm/css/xterm.css';

interface Props {
  sessionId: string;
  isVisible?: boolean;
}

export default function Terminal({ sessionId, isVisible = true }: Props) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsConnectionRef = useRef<WebSocket | null>(null);
  const isDisposedRef = useRef(false);
  const [isTerminalReady, setIsTerminalReady] = useState(false);

  const sessions = useStore((state) => state.sessions);
  const config = useStore((state) => state.config);
  const wsConnection = useStore((state) => state.wsConnection);
  const activeDragId = useStore((state) => state.activeDragId);
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const workspaces = useStore((state) => state.workspaces);
  const updateWorkspace = useStore((state) => state.updateWorkspace);
  const updateLayout = useStore((state) => state.updateLayout);

  const session = sessions.find((s) => s.id === sessionId);

  // Keep wsConnectionRef up to date
  useEffect(() => {
    wsConnectionRef.current = wsConnection;
  }, [wsConnection]);

  // Make terminal draggable
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: sessionId,
    disabled: !isVisible,
  });

  // Show drop zones when dragging another terminal
  const showDropZones = isVisible && activeDragId !== null && activeDragId !== sessionId;

  // Initialize xterm.js
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    isDisposedRef.current = false;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: config?.terminal?.fontSize || 14,
      fontFamily: config?.terminal?.fontFamily || 'Cascadia Code, Consolas, monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(terminalRef.current);

    // Disable bell sound
    term.onBell(() => {
      // Do nothing - suppress bell
    });

    // 初回fitは少し遅延させてDOMが完全にレンダリングされるのを待つ
    requestAnimationFrame(() => {
      if (!isDisposedRef.current && fitAddon) {
        try {
          fitAddon.fit();
        } catch (e) {
          // Ignore fit errors during initialization
        }
      }
    });

    // Handle input
    term.onData((data) => {
      const ws = wsConnectionRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({ type: 'input', sessionId, data })
        );
      } else {
        console.warn('WebSocket not ready for input');
      }
    });

    // Copy to clipboard helper
    const copySelection = () => {
      const selection = term.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection).catch((err) => {
          console.error('Failed to copy:', err);
        });
      }
    };

    // Paste from clipboard helper
    const pasteFromClipboard = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          term.paste(text);
        }
      } catch (err) {
        console.error('Failed to paste:', err);
      }
    };

    // Right-click: copy if selection exists, paste if no selection
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      if (term.hasSelection()) {
        copySelection();
        term.clearSelection();
      } else {
        pasteFromClipboard();
      }
    };

    // Mouse up: auto-copy selection (like typical terminal behavior)
    const handleMouseUp = () => {
      if (term.hasSelection()) {
        copySelection();
      }
    };

    const termElement = terminalRef.current;
    termElement?.addEventListener('contextmenu', handleContextMenu);
    termElement?.addEventListener('mouseup', handleMouseUp);

    // Handle resize
    term.onResize(({ cols, rows }) => {
      const ws = wsConnectionRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({ type: 'resize', sessionId, cols, rows })
        );
      }
    });

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    setIsTerminalReady(true);

    // レジストリに登録（バッファ取得用）
    registerTerminal(sessionId, term);

    // Handle window resize
    const handleResize = () => {
      if (!isDisposedRef.current && fitAddonRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch (e) {
          // Ignore fit errors
        }
      }
    };
    window.addEventListener('resize', handleResize);

    // Handle parent container resize using ResizeObserver
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (isDisposedRef.current) return;

      // Use requestAnimationFrame to ensure layout is complete
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (isDisposedRef.current) return;
        requestAnimationFrame(() => {
          if (!isDisposedRef.current && fitAddonRef.current) {
            try {
              fitAddonRef.current.fit();
            } catch (e) {
              // Ignore fit errors during resize
            }
          }
        });
      }, 10);
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      isDisposedRef.current = true;
      setIsTerminalReady(false);
      window.removeEventListener('resize', handleResize);
      termElement?.removeEventListener('contextmenu', handleContextMenu);
      termElement?.removeEventListener('mouseup', handleMouseUp);
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      unregisterTerminal(sessionId);
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId]);

  // Update terminal font settings when config changes
  useEffect(() => {
    if (!xtermRef.current || !config?.terminal) return;

    const term = xtermRef.current;
    term.options.fontSize = config.terminal.fontSize;
    term.options.fontFamily = config.terminal.fontFamily;

    // Re-fit terminal after font change
    if (fitAddonRef.current) {
      requestAnimationFrame(() => {
        if (!isDisposedRef.current && fitAddonRef.current) {
          try {
            fitAddonRef.current.fit();
          } catch (e) {
            // Ignore fit errors
          }
        }
      });
    }
  }, [config?.terminal?.fontSize, config?.terminal?.fontFamily]);

  // Re-fit terminal when workspace changes (fixes scroll issues after workspace switch)
  useEffect(() => {
    if (!isVisible || !xtermRef.current || !fitAddonRef.current || !activeWorkspaceId) return;

    // Delay fit to ensure DOM layout is complete
    const timeoutId = setTimeout(() => {
      if (!isDisposedRef.current && fitAddonRef.current) {
        requestAnimationFrame(() => {
          if (!isDisposedRef.current && fitAddonRef.current) {
            try {
              fitAddonRef.current.fit();
            } catch (e) {
              // Ignore fit errors
            }
          }
        });
      }
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [activeWorkspaceId, isVisible]);

  // Attach to session when WebSocket is ready and terminal is initialized
  useEffect(() => {
    if (!wsConnection || !xtermRef.current || !isTerminalReady) return;

    const attachToSession = () => {
      if (wsConnection.readyState === WebSocket.OPEN) {
        console.log(`Attaching to session: ${sessionId}`);
        wsConnection.send(JSON.stringify({ type: 'attach', sessionId }));
      }
    };

    // If already open, attach immediately
    if (wsConnection.readyState === WebSocket.OPEN) {
      attachToSession();
    } else {
      // Otherwise wait for open event
      wsConnection.addEventListener('open', attachToSession);
    }

    return () => {
      wsConnection.removeEventListener('open', attachToSession);
      if (wsConnection.readyState === WebSocket.OPEN) {
        console.log(`Detaching from session: ${sessionId}`);
        wsConnection.send(JSON.stringify({ type: 'detach', sessionId }));
      }
    };
  }, [wsConnection, sessionId, isTerminalReady]);

  // Handle WebSocket output
  useEffect(() => {
    if (!wsConnection) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'output' && message.sessionId === sessionId) {
          xtermRef.current?.write(message.data);
        } else if (message.type === 'history' && message.sessionId === sessionId) {
          xtermRef.current?.write(message.data);
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    };

    wsConnection.addEventListener('message', handleMessage);
    return () => wsConnection.removeEventListener('message', handleMessage);
  }, [wsConnection, sessionId]);

  async function deleteSession() {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      // セッションが存在しない場合（404）でも、レイアウトから削除する
      const isNotFound = response.status === 404;

      if (!response.ok && !isNotFound) {
        throw new Error('Failed to delete session');
      }

      // Find the workspace containing this session and update its layout
      if (activeWorkspaceId) {
        const workspace = workspaces.find((w) => w.id === activeWorkspaceId);
        if (workspace) {
          // セッションリストとレイアウトから削除
          const updatedSessions = workspace.sessions.filter((s) => s !== sessionId);

          // Update layout tree to remove the session
          let updatedLayout = workspace.layout;
          if (updatedLayout) {
            updatedLayout = removeSessionFromTree(updatedLayout, sessionId);
          }

          await fetch(`/api/workspaces/${workspace.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessions: updatedSessions, layout: updatedLayout }),
          });

          updateWorkspace(workspace.id, { sessions: updatedSessions });
          updateLayout(workspace.id, updatedLayout);
        }
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }

  // セッションが存在しない場合はローディング表示（LayoutRendererでフィルタリング済みのはず）
  if (!session) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-900 text-gray-500">
        <p className="text-sm">Loading {sessionId}...</p>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`relative flex h-full flex-col ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* Header - Drag Handle */}
      <div
        {...listeners}
        {...attributes}
        className="flex items-center justify-between bg-gray-800 px-3 py-2 text-sm cursor-move"
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-400">⋮⋮</span>
          <span className="font-semibold">{sessionId}</span>
          <span
            className={`rounded px-2 py-0.5 text-xs ${
              session?.status === 'running' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            {session?.status === 'running' ? 'Running' : 'Exited'}
          </span>
        </div>
        <button
          onClick={deleteSession}
          className="hover:text-red-400"
          onPointerDown={(e) => e.stopPropagation()}
        >
          ✕
        </button>
      </div>

      {/* Terminal body */}
      <div ref={terminalRef} className="flex-1 bg-terminal-bg overflow-hidden" />

      {/* Drop Zones - shown when dragging another terminal */}
      {showDropZones && (
        <>
          <DropZone position="top" sessionId={sessionId} />
          <DropZone position="bottom" sessionId={sessionId} />
          <DropZone position="left" sessionId={sessionId} />
          <DropZone position="right" sessionId={sessionId} />
        </>
      )}
    </div>
  );
}

import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import useStore from '../../store';
import 'xterm/css/xterm.css';

interface Props {
  sessionId: string;
}

export default function Terminal({ sessionId }: Props) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const { sessions, config, wsConnection } = useStore();
  const session = sessions.find((s) => s.id === sessionId);

  // Initialize xterm.js
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

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
    fitAddon.fit();

    // Handle input
    term.onData((data) => {
      if (wsConnection?.readyState === WebSocket.OPEN) {
        wsConnection.send(
          JSON.stringify({ type: 'input', sessionId, data })
        );
      }
    });

    // Handle resize
    term.onResize(({ cols, rows }) => {
      if (wsConnection?.readyState === WebSocket.OPEN) {
        wsConnection.send(
          JSON.stringify({ type: 'resize', sessionId, cols, rows })
        );
      }
    });

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Attach to session
    if (wsConnection?.readyState === WebSocket.OPEN) {
      wsConnection.send(JSON.stringify({ type: 'attach', sessionId }));
    }

    // Handle window resize
    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, [sessionId, config]);

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
    if (!confirm(`Delete session ${sessionId}?`)) return;

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete session');
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Failed to delete session');
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between bg-gray-800 px-3 py-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{sessionId}</span>
          <span
            className={`rounded px-2 py-0.5 text-xs ${
              session?.status === 'running' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            {session?.status === 'running' ? 'Running' : 'Exited'}
          </span>
        </div>
        <button onClick={deleteSession} className="hover:text-red-400">
          ✕
        </button>
      </div>

      {/* Terminal body */}
      <div ref={terminalRef} className="flex-1 bg-terminal-bg p-2" />
    </div>
  );
}

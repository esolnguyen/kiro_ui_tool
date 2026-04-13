import { useEffect, useRef, useCallback } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import { useWorkplace } from "../components/workplace/WorkplaceContext";

const WS_BASE = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;

const TERM_THEME = {
  background: "#0c0c10",
  foreground: "#cdd6f4",
  cursor: "#6366f1",
  selectionBackground: "rgba(99, 102, 241, 0.3)",
  black: "#45475a",
  red: "#f38ba8",
  green: "#a6e3a1",
  yellow: "#f9e2af",
  blue: "#89b4fa",
  magenta: "#f5c2e7",
  cyan: "#94e2d5",
  white: "#bac2de",
  brightBlack: "#585b70",
  brightRed: "#f38ba8",
  brightGreen: "#a6e3a1",
  brightYellow: "#f9e2af",
  brightBlue: "#89b4fa",
  brightMagenta: "#f5c2e7",
  brightCyan: "#94e2d5",
  brightWhite: "#a6adc8",
};

// Max time to wait for the CLI prompt before sending anyway
const PROMPT_TIMEOUT_MS = 4000;

export function useTerminal() {
  const { setTermReady, setSendFn, agentSlug } = useWorkplace();
  const termContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const agentSlugRef = useRef(agentSlug);
  // Buffer of recent terminal output to detect CLI readiness
  const outputBufferRef = useRef("");
  // Callback to invoke when CLI prompt is detected
  const pendingPromptRef = useRef<string | null>(null);
  const promptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether a kiro-cli session is already running
  const cliActiveRef = useRef(false);
  const currentAgentRef = useRef("");

  // Keep ref in sync so the send function always uses latest agentSlug
  useEffect(() => {
    agentSlugRef.current = agentSlug;
  }, [agentSlug]);

  const sendRaw = useCallback((data: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(new TextEncoder().encode(data));
  }, []);

  const flushPendingPrompt = useCallback(() => {
    const pending = pendingPromptRef.current;
    if (!pending) return;
    pendingPromptRef.current = null;
    if (promptTimerRef.current) {
      clearTimeout(promptTimerRef.current);
      promptTimerRef.current = null;
    }
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const escaped = pending.replace(/'/g, "'\\''");
    // Send text first, then Enter separately so the terminal
    // doesn't treat \r as part of a pasted multi-line block
    ws.send(new TextEncoder().encode(escaped));
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(new TextEncoder().encode("\r"));
      }
    }, 100);
  }, []);

  const checkOutputForPrompt = useCallback(() => {
    if (!pendingPromptRef.current) return;
    const buf = outputBufferRef.current;
    // Match common CLI prompt patterns:
    // kiro-cli: "You:", "Human:", "> ", "❯ "
    // Shell prompts: "$ ", "% ", ">>> "
    if (
      /(?:You|Human):\s*$/.test(buf) ||
      /[>❯$%?]\s*$/.test(buf) ||
      />>>\s*$/.test(buf)
    ) {
      setTimeout(flushPendingPrompt, 200);
    }
  }, [flushPendingPrompt]);

  const sendPrompt = useCallback((prompt: string, agentOverride?: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const agent = agentOverride ?? agentSlugRef.current;

    if (cliActiveRef.current) {
      // Session already running — swap agent if needed, then send prompt
      if (agent && agent !== currentAgentRef.current) {
        // Swap agent first, wait for it to settle, then send the prompt
        ws.send(new TextEncoder().encode(`/agent swap ${agent}\r`));
        currentAgentRef.current = agent;

        setTimeout(() => {
          outputBufferRef.current = "";
          pendingPromptRef.current = prompt;
          promptTimerRef.current = setTimeout(() => {
            if (pendingPromptRef.current) flushPendingPrompt();
          }, PROMPT_TIMEOUT_MS);
        }, 1500);
      } else {
        // Same agent — send prompt directly, CLI is already at a prompt
        outputBufferRef.current = "";
        pendingPromptRef.current = prompt;
        // Check if we're already at a prompt
        checkOutputForPrompt();
        promptTimerRef.current = setTimeout(() => {
          if (pendingPromptRef.current) flushPendingPrompt();
        }, PROMPT_TIMEOUT_MS);
      }
    } else {
      // First invocation — launch kiro-cli chat
      outputBufferRef.current = "";
      pendingPromptRef.current = prompt;

      const flag = agent ? ` --agent ${agent}` : "";
      ws.send(new TextEncoder().encode(`kiro-cli chat${flag}\r`));
      cliActiveRef.current = true;
      currentAgentRef.current = agent;

      // Fallback: if prompt is never detected, send after timeout
      promptTimerRef.current = setTimeout(() => {
        if (pendingPromptRef.current) {
          flushPendingPrompt();
        }
      }, PROMPT_TIMEOUT_MS);
    }
  }, [flushPendingPrompt, checkOutputForPrompt]);

  useEffect(() => {
    setSendFn(sendPrompt);
  }, [sendPrompt, setSendFn]);

  useEffect(() => {
    if (!termContainerRef.current) return;

    const sessionId = `workplace-${Date.now()}`;
    const term = new XTerm({
      fontFamily: "Geist Mono, SF Mono, ui-monospace, monospace",
      fontSize: 13,
      lineHeight: 1.5,
      theme: TERM_THEME,
      cursorBlink: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(termContainerRef.current);

    let disposed = false;

    // Defer initial fit to next frame so the renderer is fully attached
    requestAnimationFrame(() => {
      if (!disposed) {
        try { fitAddon.fit(); } catch { /* renderer not ready yet */ }
      }
    });

    const ws = new WebSocket(`${WS_BASE}/ws/terminal/${sessionId}`);
    wsRef.current = ws;
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      term.writeln("\x1b[32m● Connected to Kiro terminal\x1b[0m");
      term.writeln(
        "\x1b[90mSelect a work item or pull request and click Start to begin.\x1b[0m",
      );
      ws.send(
        JSON.stringify({ type: "resize", rows: term.rows, cols: term.cols }),
      );
      setTermReady(true);
    };
    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        const text = new TextDecoder().decode(e.data);
        term.write(new Uint8Array(e.data));
        // Accumulate output and check for CLI prompt readiness
        outputBufferRef.current += text;
        // Keep buffer from growing unbounded (last 500 chars is enough)
        if (outputBufferRef.current.length > 500) {
          outputBufferRef.current = outputBufferRef.current.slice(-500);
        }
        checkOutputForPrompt();
      } else {
        term.write(e.data);
        outputBufferRef.current += e.data;
        if (outputBufferRef.current.length > 500) {
          outputBufferRef.current = outputBufferRef.current.slice(-500);
        }
        checkOutputForPrompt();
      }
    };
    ws.onerror = () =>
      term.writeln("\x1b[31mWebSocket error — is the backend running?\x1b[0m");
    ws.onclose = () => {
      term.writeln("\x1b[33mConnection closed\x1b[0m");
      setTermReady(false);
      cliActiveRef.current = false;
      currentAgentRef.current = "";
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN)
        ws.send(new TextEncoder().encode(data));
    });

    const ro = new ResizeObserver(() => {
      if (disposed) return;
      try {
        fitAddon.fit();
      } catch {
        return; // renderer not ready
      }
      if (ws.readyState === WebSocket.OPEN)
        ws.send(
          JSON.stringify({ type: "resize", rows: term.rows, cols: term.cols }),
        );
    });
    // Observe the container itself so xterm refits when the pipeline bar
    // appears/expands/collapses (which changes the container's available height)
    ro.observe(termContainerRef.current);

    return () => {
      disposed = true;
      ro.disconnect();
      ws.close();
      term.dispose();
      if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
    };
  }, [setTermReady, checkOutputForPrompt]);

  return { termContainerRef, sendRaw };
}

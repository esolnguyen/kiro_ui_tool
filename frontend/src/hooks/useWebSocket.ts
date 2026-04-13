import { useEffect, useRef, useState, useCallback } from 'react'

export type ReadyState = 'connecting' | 'open' | 'closing' | 'closed'

interface UseWebSocketOptions {
  onMessage?: (data: unknown) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: (event: Event) => void
  reconnect?: boolean
  reconnectDelay?: number
  maxReconnectDelay?: number
}

interface UseWebSocketReturn {
  send: (data: unknown) => void
  lastMessage: unknown
  readyState: ReadyState
  reconnect: () => void
}

export function useWebSocket(
  url: string | null,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const {
    reconnect: autoReconnect = true,
    reconnectDelay = 1000,
    maxReconnectDelay = 30000,
  } = options

  const [readyState, setReadyState] = useState<ReadyState>('closed')
  const [lastMessage, setLastMessage] = useState<unknown>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  // Stabilize callbacks in refs to avoid reconnect loops
  const onMessageRef = useRef(options.onMessage)
  const onOpenRef = useRef(options.onOpen)
  const onCloseRef = useRef(options.onClose)
  const onErrorRef = useRef(options.onError)
  onMessageRef.current = options.onMessage
  onOpenRef.current = options.onOpen
  onCloseRef.current = options.onClose
  onErrorRef.current = options.onError

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }, [])

  const connect = useCallback(() => {
    if (!url) return
    if (wsRef.current) {
      wsRef.current.onopen = null
      wsRef.current.onclose = null
      wsRef.current.onerror = null
      wsRef.current.onmessage = null
      wsRef.current.close()
    }

    setReadyState('connecting')
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) return
      setReadyState('open')
      reconnectAttemptRef.current = 0
      onOpenRef.current?.()
    }

    ws.onclose = () => {
      if (!mountedRef.current) return
      setReadyState('closed')
      onCloseRef.current?.()

      if (autoReconnect) {
        const delay = Math.min(
          reconnectDelay * Math.pow(2, reconnectAttemptRef.current),
          maxReconnectDelay
        )
        reconnectAttemptRef.current++
        reconnectTimerRef.current = setTimeout(() => {
          if (mountedRef.current) connect()
        }, delay)
      }
    }

    ws.onerror = (event) => {
      if (!mountedRef.current) return
      onErrorRef.current?.(event)
    }

    ws.onmessage = (event) => {
      if (!mountedRef.current) return
      try {
        const parsed = JSON.parse(event.data as string)
        setLastMessage(parsed)
        onMessageRef.current?.(parsed)
      } catch {
        setLastMessage(event.data)
        onMessageRef.current?.(event.data)
      }
    }
  }, [url, autoReconnect, reconnectDelay, maxReconnectDelay])

  useEffect(() => {
    mountedRef.current = true
    if (url) connect()

    return () => {
      mountedRef.current = false
      clearReconnectTimer()
      if (wsRef.current) {
        wsRef.current.onopen = null
        wsRef.current.onclose = null
        wsRef.current.onerror = null
        wsRef.current.onmessage = null
        wsRef.current.close()
      }
    }
  }, [url, connect, clearReconnectTimer])

  const send = useCallback((data: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data))
    }
  }, [])

  const reconnectFn = useCallback(() => {
    clearReconnectTimer()
    reconnectAttemptRef.current = 0
    connect()
  }, [clearReconnectTimer, connect])

  return { send, lastMessage, readyState, reconnect: reconnectFn }
}

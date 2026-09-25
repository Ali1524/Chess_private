import { useEffect, useState, useCallback } from "react";
import { getSocket, connectSocket, type AppSocket } from "../services/socket";

export type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

export function useSocket() {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const socket = getSocket();

  useEffect(() => {
    const s: AppSocket = connectSocket();

    const onConnect = () => setConnectionState("connected");
    const onDisconnect = () => setConnectionState("disconnected");
    const onConnectError = () => setConnectionState("error");
    const onReconnecting = () => setConnectionState("connecting");

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("connect_error", onConnectError);
    s.io.on("reconnect_attempt", onReconnecting);

    if (s.connected) setConnectionState("connected");
    else setConnectionState("connecting");

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("connect_error", onConnectError);
      s.io.off("reconnect_attempt", onReconnecting);
    };
  }, []);

  const emit = useCallback(
    <E extends keyof Parameters<AppSocket["emit"]>[0]>(
      event: E,
      ...args: Parameters<AppSocket["emit"]> extends [E, ...infer R] ? R : never[]
    ) => {
      // @ts-expect-error variadic emit typing
      socket.emit(event, ...args);
    },
    [socket]
  );

  return { socket, connectionState, emit };
}

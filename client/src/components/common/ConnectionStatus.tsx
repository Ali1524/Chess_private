import type { ConnectionState } from "../../hooks/useSocket";

interface ConnectionStatusProps {
  state: ConnectionState;
}

export default function ConnectionStatus({ state }: ConnectionStatusProps) {
  const config = {
    connected: { dot: "bg-green-400", label: "Connected", color: "text-green-400" },
    connecting: { dot: "bg-yellow-400 animate-pulse", label: "Connecting…", color: "text-yellow-400" },
    disconnected: { dot: "bg-red-400 animate-pulse", label: "Disconnected", color: "text-red-400" },
    error: { dot: "bg-red-400", label: "Connection Error", color: "text-red-400" },
  }[state];

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${config.dot}`} />
      <span className={`text-xs ${config.color}`}>{config.label}</span>
    </div>
  );
}

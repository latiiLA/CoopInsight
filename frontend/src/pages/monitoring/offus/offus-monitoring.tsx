import { LiveSwitchFeed } from "../live-switch-feed";

export default function OffusMonitoring() {
  return (
    <LiveSwitchFeed
      title="Offus monitoring"
      socketPath="/monitoring/offus/ws"
      emptyLabel="off-us"
    />
  );
}

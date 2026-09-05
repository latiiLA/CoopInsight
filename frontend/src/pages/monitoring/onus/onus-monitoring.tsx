import { LiveSwitchFeed } from "../live-switch-feed";

export default function OnusMonitoring() {
  return (
    <LiveSwitchFeed
      title="Onus monitoring"
      socketPath="/monitoring/onus/ws"
      emptyLabel="on-us"
    />
  );
}

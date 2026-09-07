import { LiveSwitchFeed } from "../live-switch-feed";

export default function VisaMonitoring() {
  return (
    <LiveSwitchFeed
      title="Visa monitoring"
      socketPath="/monitoring/visa/ws"
      emptyLabel="visa"
    />
  );
}

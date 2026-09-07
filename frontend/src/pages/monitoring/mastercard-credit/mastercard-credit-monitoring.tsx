import { LiveSwitchFeed } from "../live-switch-feed";

export default function MastercardCreditMonitoring() {
  return (
    <LiveSwitchFeed
      title="Mastercard credit"
      socketPath="/monitoring/mastercard-credit/ws"
      emptyLabel="mastercard credit"
    />
  );
}

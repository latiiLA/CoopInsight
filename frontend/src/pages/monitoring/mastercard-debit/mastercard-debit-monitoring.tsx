import { LiveSwitchFeed } from "../live-switch-feed";

export default function MastercardDebitMonitoring() {
  return (
    <LiveSwitchFeed
      title="Mastercard debit"
      socketPath="/monitoring/mastercard-debit/ws"
      emptyLabel="mastercard debit"
    />
  );
}

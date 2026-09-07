const REPORT_SRC =
  "https://datastudio.google.com/embed/reporting/302227be-47a6-4bb2-bf00-a12ae1bf6b48/page/NHG8F";

const Analytics = () => {
  return (
    <div className="h-[calc(100svh-3.5rem)] w-full overflow-hidden rounded-lg border bg-background">
      <iframe
        title="Analytics report"
        src={REPORT_SRC}
        className="h-full w-full border-0"
        allowFullScreen
        sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
};

export default Analytics;

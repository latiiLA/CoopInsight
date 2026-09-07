import { RequestAccountForm } from "@/components/request-account-form";

export default function RequestAccountPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-4">
      <div className="w-full max-w-lg">
        <RequestAccountForm />
      </div>
    </div>
  );
}

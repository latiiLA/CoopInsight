import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { Inbox } from "lucide-react";

import { DataTable } from "@/components/data-table";
import { accountRequestColumns } from "./account-request-columns";
import {
  clearAccountRequestsError,
  fetchAccountRequests,
} from "@/features/account_request_slice";
import { AppDispatch, RootState } from "../../../../app/store/store";

const ManageAccountRequests = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { authUser } = useSelector((state: RootState) => state.user);
  const { requests, requestsError } = useSelector(
    (state: RootState) => state.accountRequest,
  );

  useEffect(() => {
    if (authUser) {
      dispatch(fetchAccountRequests());
    }
  }, [authUser, dispatch]);

  useEffect(() => {
    if (requestsError) {
      toast.error(requestsError);
      dispatch(clearAccountRequestsError());
    }
  }, [dispatch, requestsError]);

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Account Requests</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Review pending requests and create a user with a role and permissions.
        </p>
      </div>

      <DataTable
        columns={accountRequestColumns}
        data={requests}
        searchPlaceholder="Search account requests..."
        exportFileName="AccountRequests"
      />
    </div>
  );
};

export default ManageAccountRequests;

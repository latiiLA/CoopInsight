import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { columns } from "./columns";
import { fetchAtmTerminals } from "@/features/atm_terminal_slice";
import { AppDispatch, RootState } from "../../../../app/store/store";

const AtmTerminals = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { terminals, loading, error } = useSelector(
    (state: RootState) => state.atmTerminal,
  );
  const { authUser } = useSelector((state: RootState) => state.user);

  useEffect(() => {
    if (authUser) {
      dispatch(fetchAtmTerminals());
    }
  }, [authUser, dispatch]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  return (
    <div>
      <div className="flex align-items-center justify-between">
        <h1 className="text-lg font-semibold">ATM Terminals</h1>
      </div>

      <DataTable
        loading={loading}
        columns={columns}
        data={terminals}
        searchPlaceholder="Search ATM terminals..."
        exportFileName="atm-terminals"
      />
    </div>
  );
};

export default AtmTerminals;

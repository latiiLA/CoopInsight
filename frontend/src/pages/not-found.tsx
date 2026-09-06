import { FileQuestion } from "lucide-react";
import { NavLink } from "react-router-dom";

import { Button } from "@/components/ui/button";

const NotFound = () => {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-start gap-4 py-12">
      <div className="flex items-center gap-2">
        <FileQuestion className="size-5" />
        <h1 className="text-lg font-semibold">Page not found</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        This page does not exist. Go back to Home to continue.
      </p>
      <Button asChild>
        <NavLink to="/home">Go to Home</NavLink>
      </Button>
    </div>
  );
};

export default NotFound;

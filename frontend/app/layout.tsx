import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { SwitchHubMark } from "@/components/switch-hub-mark";
import { Separator } from "@/components/ui/separator";
import { Navigate, NavLink, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "./store/store";
import { useAccessTokenRefresh } from "@/hooks/use-access-token-refresh";

function AppBrand() {
  const { state, isMobile } = useSidebar();

  if (!isMobile && state === "expanded") {
    return null;
  }

  return (
    <>
      <Separator orientation="vertical" className="h-5" />
      <NavLink
        to="/home"
        className="rounded-sm px-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <SwitchHubMark />
      </NavLink>
    </>
  );
}

export default function Layout() {
  const isLoggedIn = useSelector((state: RootState) => state.user.isLoggedIn);
  useAccessTokenRefresh();

  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  return (
    <SidebarProvider defaultOpen={false} className="overflow-x-hidden">
      <AppSidebar />
      <main className="flex min-h-svh min-w-0 flex-1 flex-col overflow-x-hidden">
        <div className="flex h-12 w-full items-center justify-between px-2">
          <div className="flex items-center gap-2.5">
            <SidebarTrigger />
            <AppBrand />
          </div>
          <ModeToggle />
        </div>
        <Separator/>
        <div className="p-2">
          <Outlet />
        </div>
      </main>
    </SidebarProvider>
  )
}

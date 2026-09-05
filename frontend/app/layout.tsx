import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { Separator } from "@/components/ui/separator";
import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <SidebarProvider defaultOpen={false} className="overflow-x-hidden">
      <AppSidebar />
      <main className="flex min-h-svh min-w-0 flex-1 flex-col overflow-x-hidden">
        <div className="flex w-full items-center flex-row justify-between">
          <div className="pl-2 pt-1 pb-1">
            <SidebarTrigger />
          </div>
          <div className="pr-2 pt-1 pb-1">
            <ModeToggle />
          </div>
        </div>
        <Separator/>
        <div className="p-2">
          <Outlet />
        </div>
      </main>
    </SidebarProvider>
  )
}
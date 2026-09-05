import * as React from "react";
import {
  Activity,
  ChartBar,
  ChartNoAxesGantt,
  ChevronRight,
  Home,
  KeyRound,
  LayoutDashboard,
  LucideIdCard,
  ProjectorIcon,
  Settings,
  Shield,
  SquareArrowOutDownRight,
  Terminal,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

import { VersionSwitcher } from "./version-switcher";
import { NavUser } from "./nav-user";
import { NavLink } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store/store";

// ------------------------------------
// Types
// ------------------------------------

type NavSubItem = {
  title: string;
  icon?: LucideIcon;
  url: string;
  isActive?: boolean;
};

type NavItem = {
  title: string;
  icon?: LucideIcon;
  url: string;
  items: NavSubItem[];
};

type NavHome = {
  title: string;
  icon?: LucideIcon;
  url: string;
};

// ------------------------------------
// Data
// ------------------------------------

const data: {
  versions: string[];
  user: {
    name: string;
    username: string;
    avatar: string;
  };
  navHome: NavHome;
  navMain: NavItem[];
} = {
  versions: ["1.0.1"],

  user: {
    name: "user",
    username: "ad-username",
    avatar: "/avatars/shadcn.jpg",
  },

  navHome: {
    title: "Home",
    url: "/home",
    icon: Home,
  },

  navMain: [
    {
      title: "Reports",
      icon: ChartBar,
      url: "#",
      items: [
        {
          title: "Deposit Per Terminal",
          icon: SquareArrowOutDownRight,
          url: "deposit-per-terminal",
        },
        {
          title: "Project Structure",
          icon: ProjectorIcon,
          url: "#",
        },
      ],
    },
    {
      title: "Dashboards",
      icon: LayoutDashboard,
      url: "#",
      items: [
        {
          title: "ATM Terminal",
          url: "#",
          icon: Terminal,
        },
        {
          title: "POS Terminal",
          url: "#",
          icon: LucideIdCard,
        },
      ],
    },
    {
      title: "System Administration",
      icon: Settings,
      url: "#",
      items: [
        {
          title: "Manage Users",
          url: "users",
          icon: Users,
        },
        {
          title: "Manage Roles",
          url: "roles",
          icon: Shield,
        },
        {
          title: "Manage Permissions",
          url: "permissions",
          icon: KeyRound,
        },
        {
          title: "Analytics",
          url: "analytics",
          icon: ChartNoAxesGantt,
        },
        {
          title: "Activity Log",
          url: "activity",
          icon: Activity,
        },
      ],
    },
  ],
};

// ------------------------------------
// Sidebar
// ------------------------------------

function NavMainItem({ item }: { item: NavItem }) {
  const { state, isMobile } = useSidebar();
  const Icon = item.icon;
  const collapsed = state === "collapsed" && !isMobile;

  if (collapsed) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton tooltip={item.title}>
              {Icon ? <Icon /> : null}
              <span>{item.title}</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="min-w-48">
            <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
            {item.items.map((subItem) => {
              const SubIcon = subItem.icon;

              return (
                <DropdownMenuItem key={subItem.title} asChild>
                  <NavLink to={subItem.url}>
                    {SubIcon ? <SubIcon /> : null}
                    <span>{subItem.title}</span>
                  </NavLink>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <Collapsible defaultOpen className="group/collapsible">
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title}>
            {Icon ? <Icon /> : null}
            <span>{item.title}</span>
            <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenu className="mt-1 ml-4 border-l border-sidebar-border pl-2">
            {item.items.map((subItem) => {
              const SubIcon = subItem.icon;

              return (
                <SidebarMenuItem key={subItem.title}>
                  <SidebarMenuButton asChild tooltip={subItem.title}>
                    <NavLink to={subItem.url}>
                      {SubIcon ? <SubIcon /> : null}
                      <span>{subItem.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { authUser } = useSelector((state: RootState) => state.user);
  const HomeIcon = data.navHome.icon;

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <VersionSwitcher
          versions={data.versions}
          defaultVersion={data.versions[0]}
        />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={data.navHome.title}>
                  <NavLink to={data.navHome.url}>
                    {HomeIcon ? <HomeIcon /> : null}
                    <span>{data.navHome.title}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {data.navMain.map((item) => (
                <NavMainItem key={item.title} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />

      <SidebarFooter>
        <NavUser
          user={{
            name: `${authUser?.data?.user?.firstName ?? ""} ${authUser?.data?.user?.middleName ?? ""}`.trim(),
            username: authUser?.data?.user?.username ?? "",
            avatar: "",
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}

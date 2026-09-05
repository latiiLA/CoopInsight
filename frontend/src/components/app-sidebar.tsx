import * as React from "react";
import {
  Activity,
  AppleIcon,
  ChartBar,
  ChartNoAxesGantt,
  ChevronRight,
  Home,
  HomeIcon,
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
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

import { VersionSwitcher } from "./version-switcher";
import { SearchForm } from "./search-form";
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
    url: "home",
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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { authUser } = useSelector((state: RootState) => state.user);

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <VersionSwitcher
          versions={data.versions}
          defaultVersion={data.versions[0]}
        />

        {/* <SearchForm /> */}
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {/* Home rendered alone, no collapsible wrapper */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to={data.navHome.url}>
                    {HomeIcon && <HomeIcon className="size-4" />}
                    <span>{data.navHome.title}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {data.navMain.map((item) => {
          const Icon = item.icon;

          return (
            <Collapsible
              key={item.title}
              title={item.title}
              defaultOpen
              className="group/collapsible"
            >
              <SidebarGroup>
                <SidebarGroupLabel
                  asChild
                  className="group/label text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <CollapsibleTrigger>
                    {Icon && <Icon className="mr-2 size-4" />}

                    {item.title}

                    <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>

                <CollapsibleContent>
                  <SidebarGroupContent className="pl-4">
                    <SidebarMenu>
                      {item.items.map((subItem) => {
                        const SubIcon = subItem.icon;

                        return (
                          <SidebarMenuItem key={subItem.title}>
                            <SidebarMenuButton asChild>
                              <NavLink to={subItem.url}>
                                {SubIcon && <SubIcon className="size-4" />}
                                <span>{subItem.title}</span>
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
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

import * as React from "react";
import {
  AppleIcon,
  BookOpen,
  ChevronRight,
  InspectionPanel,
  ProjectorIcon,
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
  navMain: NavItem[];
} = {
  versions: ["1.0.1"],

  user: {
    name: "user",
    username: "ad-username",
    avatar: "/avatars/shadcn.jpg",
  },

  navMain: [
    {
      title: "Getting Started",
      icon: BookOpen,
      url: "#",
      items: [
        {
          title: "Installation",
          icon: InspectionPanel,
          url: "#",
        },
        {
          title: "Project Structure",
          icon: ProjectorIcon,
          url: "#",
        },
      ],
    },

    {
      title: "Build Your Application",
      icon: AppleIcon,
      url: "#",
      items: [
        {
          title: "Routing",
          url: "#",
        },
        {
          title: "Data Fetching",
          url: "#",
          isActive: true,
        },
        {
          title: "Rendering",
          url: "#",
        },
        {
          title: "Caching",
          url: "#",
        },
        {
          title: "Styling",
          url: "#",
        },
        {
          title: "Optimizing",
          url: "#",
        },
        {
          title: "Configuring",
          url: "#",
        },
        {
          title: "Testing",
          url: "#",
        },
      ],
    },
  ],
};

// ------------------------------------
// Sidebar
// ------------------------------------

export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
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
                            <SidebarMenuButton
                              asChild
                              isActive={subItem.isActive ?? false}
                            >
                              <a href={subItem.url}>
                                {SubIcon && (
                                  <SubIcon className="size-4" />
                                )}

                                <span>{subItem.title}</span>
                              </a>
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
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
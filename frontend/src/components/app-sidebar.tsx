import * as React from "react";
import {
  Activity,
  ArrowLeftRight,
  ChartBar,
  ChartNoAxesGantt,
  ChevronRight,
  CreditCard,
  Home,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LucideIdCard,
  Radio,
  Scale,
  Settings,
  Shield,
  SquareArrowOutDownRight,
  Terminal,
  Users,
  Wallet,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

import { VersionSwitcher } from "./version-switcher";
import { NavUser } from "./nav-user";
import { VisaIcon } from "./icons/visa-icon";
import { MastercardIcon } from "./icons/mastercard-icon";
import { AtmIcon } from "./icons/atm-icon";
import { PosIcon } from "./icons/pos-icon";
import {
  AcquiringIcon,
  IssuingIcon,
  OffUsIcon,
  OnUsIcon,
  SuccessRateIcon,
  SuccessRateTrendsIcon,
  SwitchIcon,
} from "./icons/success-rate-icons";
import { NavLink } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store/store";
import { hasPermission } from "../../utility/has-permission";
import { avatarSrc } from "@/lib/avatars";

// ------------------------------------
// Types
// ------------------------------------

type NavIcon = React.ComponentType<{ className?: string }>;

type NavSubItem = {
  title: string;
  icon?: NavIcon;
  url: string;
  isActive?: boolean;
  permissions?: string[];
};

type NavItem = {
  title: string;
  icon?: NavIcon;
  url: string;
  items: NavSubItem[];
};

type NavHome = {
  title: string;
  icon?: NavIcon;
  url: string;
};

function canSeeNavItem(item: NavSubItem, granted: string[]) {
  if (!item.url || item.url === "#") {
    return false;
  }

  if (!item.permissions?.length) {
    return true;
  }

  return hasPermission(item.permissions, granted);
}

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
      // Icon legend — learn once, reused across channels:
      // overall = channel identity (SwitchIcon / AtmIcon / PosIcon)
      // on-us = OnUsIcon (bank / CoopBank)
      // off-us = OffUsIcon (cross-bank swap)
      // issuing = IssuingIcon (card issuing)
      // acquiring = AcquiringIcon (inbound payments)
      title: "Success Rates",
      icon: SuccessRateIcon,
      url: "#",
      items: [
        {
          title: "Trends",
          icon: SuccessRateTrendsIcon,
          url: "success-rate-trends",
          permissions: [
            "report:view-success-transactions",
            "report:view-atm-overall-success-rate",
            "report:view-atm-acquiring-success-rate",
            "report:view-atm-onus-success-rate",
            "report:view-atm-offus-success-rate",
            "report:view-atm-issuing-success-rate",
            "report:view-pos-overall-success-rate",
            "report:view-pos-acquiring-success-rate",
            "report:view-pos-onus-success-rate",
            "report:view-pos-offus-success-rate",
            "report:view-pos-issuing-success-rate",
            "report:view-switch-overall-success-rate",
            "report:view-switch-onus-success-rate",
            "report:view-switch-offus-success-rate",
            "report:view-switch-issuing-success-rate",
          ],
        },
        {
          title: "Switch Overall",
          icon: SwitchIcon,
          url: "switch-overall-success-rate",
          permissions: [
            "report:view-switch-overall-success-rate",
            "report:view-success-transactions",
          ],
        },
        {
          title: "Switch On-us",
          icon: OnUsIcon,
          url: "switch-onus-success-rate",
          permissions: [
            "report:view-switch-onus-success-rate",
            "report:view-success-transactions",
          ],
        },
        {
          title: "Switch Off-us",
          icon: OffUsIcon,
          url: "switch-offus-success-rate",
          permissions: [
            "report:view-switch-offus-success-rate",
            "report:view-success-transactions",
          ],
        },
        {
          title: "Switch Issuing",
          icon: IssuingIcon,
          url: "switch-issuing-success-rate",
          permissions: [
            "report:view-switch-issuing-success-rate",
            "report:view-success-transactions",
          ],
        },
        {
          title: "ATM Overall",
          icon: AtmIcon,
          url: "atm-overall-success-rate",
          permissions: [
            "report:view-atm-overall-success-rate",
            "report:view-success-transactions",
          ],
        },
        {
          title: "ATM Acquiring",
          icon: AcquiringIcon,
          url: "atm-acquiring-success-rate",
          permissions: [
            "report:view-atm-acquiring-success-rate",
            "report:view-success-transactions",
          ],
        },
        {
          title: "ATM On-us",
          icon: OnUsIcon,
          url: "atm-onus-success-rate",
          permissions: [
            "report:view-atm-onus-success-rate",
            "report:view-success-transactions",
          ],
        },
        {
          title: "ATM Off-us",
          icon: OffUsIcon,
          url: "atm-offus-success-rate",
          permissions: [
            "report:view-atm-offus-success-rate",
            "report:view-success-transactions",
          ],
        },
        {
          title: "ATM Issuing",
          icon: IssuingIcon,
          url: "atm-issuing-success-rate",
          permissions: [
            "report:view-atm-issuing-success-rate",
            "report:view-success-transactions",
          ],
        },
        {
          title: "POS Overall",
          icon: PosIcon,
          url: "pos-overall-success-rate",
          permissions: [
            "report:view-pos-overall-success-rate",
            "report:view-success-transactions",
          ],
        },
        {
          title: "POS Acquiring",
          icon: AcquiringIcon,
          url: "pos-acquiring-success-rate",
          permissions: [
            "report:view-pos-acquiring-success-rate",
            "report:view-success-transactions",
          ],
        },
        {
          title: "POS On-us",
          icon: OnUsIcon,
          url: "pos-onus-success-rate",
          permissions: [
            "report:view-pos-onus-success-rate",
            "report:view-success-transactions",
          ],
        },
        {
          title: "POS Off-us",
          icon: OffUsIcon,
          url: "pos-offus-success-rate",
          permissions: [
            "report:view-pos-offus-success-rate",
            "report:view-success-transactions",
          ],
        },
        {
          title: "POS Issuing",
          icon: IssuingIcon,
          url: "pos-issuing-success-rate",
          permissions: [
            "report:view-pos-issuing-success-rate",
            "report:view-success-transactions",
          ],
        },
      ],
    },
    {
      title: "Reports",
      icon: ChartBar,
      url: "#",
      items: [
        {
          title: "Deposit Per Terminal",
          icon: SquareArrowOutDownRight,
          url: "deposit-per-terminal",
          permissions: ["report:view-deposit-per-terminal"],
        },
        {
          title: "Ebirr Cardless Withdrawal",
          icon: Wallet,
          url: "ebirr-cardless-withdrawal",
          permissions: ["report:view-ebirr-cardless-withdrawal"],
        },
      ],
    },
    {
      title: "Monitoring",
      icon: Activity,
      url: "#",
      items: [
        {
          title: "Onus monitoring",
          icon: Radio,
          url: "onus-monitoring",
          permissions: ["monitoring:view-onus"],
        },
        {
          title: "Offus monitoring",
          icon: ArrowLeftRight,
          url: "offus-monitoring",
          permissions: ["monitoring:view-offus"],
        },
        {
          title: "Mastercard debit",
          icon: MastercardIcon,
          url: "mastercard-debit-monitoring",
          permissions: ["monitoring:view-mastercard-debit"],
        },
        {
          title: "Mastercard credit",
          icon: MastercardIcon,
          url: "mastercard-credit-monitoring",
          permissions: ["monitoring:view-mastercard-credit"],
        },
        {
          title: "Visa monitoring",
          icon: VisaIcon,
          url: "visa-monitoring",
          permissions: ["monitoring:view-visa"],
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
          url: "atm-dashboard",
          icon: Terminal,
          permissions: ["terminal:view-atm"],
        },
        {
          title: "ATM Transactions",
          url: "atm-transactions",
          icon: ArrowLeftRight,
          permissions: ["terminal:view-atm-transaction"],
        },
        {
          title: "ATM Comparison",
          url: "atm-comparison",
          icon: ChartBar,
          permissions: ["terminal:view-atm-transaction"],
        },
        {
          title: "POS Terminal",
          url: "pos-dashboard",
          icon: LucideIdCard,
          permissions: ["terminal:view-pos"],
        },
        {
          title: "POS Transactions",
          url: "pos-transactions",
          icon: CreditCard,
          permissions: ["terminal:view-pos-transaction"],
        },
        {
          title: "POS Comparison",
          url: "pos-comparison",
          icon: ChartBar,
          permissions: ["terminal:view-pos-transaction"],
        },
      ],
    },
    {
      title: "Clearing and Settlement",
      icon: Scale,
      url: "clearing-and-settlement",
      items: [
        {
          title: "Uncleared ETH",
          url: "uncleared-eth",
          icon: Wallet,
          permissions: ["clearing:view-uncleared-eth"],
        },
        {
          title: "Uncleared VISA",
          url: "uncleared-visa",
          icon: VisaIcon,
          permissions: ["clearing:view-uncleared-visa"],
        },
        {
          title: "Uncleared Mastercard",
          url: "uncleared-mastercard",
          icon: MastercardIcon,
          permissions: ["clearing:view-uncleared-mastercard"],
        },
        {
          title: "Cleared ETH",
          url: "cleared-eth",
          icon: Wallet,
          permissions: ["clearing:view-cleared-eth"],
        },
        {
          title: "Cleared VISA",
          url: "cleared-visa",
          icon: VisaIcon,
          permissions: ["clearing:view-cleared-visa"],
        },
        {
          title: "Cleared Mastercard",
          url: "cleared-mastercard",
          icon: MastercardIcon,
          permissions: ["clearing:view-cleared-mastercard"],
        },
        {
          title: "Unsettled ETH",
          url: "unsettled-eth",
          icon: Wallet,
          permissions: ["settlement:view-unsettled-eth"],
        },
        {
          title: "Unsettled VISA",
          url: "unsettled-visa",
          icon: VisaIcon,
          permissions: ["settlement:view-unsettled-visa"],
        },
        {
          title: "Unsettled Mastercard",
          url: "unsettled-mastercard",
          icon: MastercardIcon,
          permissions: ["settlement:view-unsettled-mastercard"],
        },
        {
          title: "Settled ETH",
          url: "settled-eth",
          icon: Wallet,
          permissions: ["settlement:view-settled-eth"],
        },
        {
          title: "Settled VISA",
          url: "settled-visa",
          icon: VisaIcon,
          permissions: ["settlement:view-settled-visa"],
        },
        {
          title: "Settled Mastercard",
          url: "settled-mastercard",
          icon: MastercardIcon,
          permissions: ["settlement:view-settled-mastercard"],
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
          permissions: ["user:view"],
        },
        {
          title: "Account Requests",
          url: "account-requests",
          icon: Inbox,
          permissions: ["user:view", "user:create"],
        },
        {
          title: "Manage Roles",
          url: "roles",
          icon: Shield,
          permissions: ["role:view"],
        },
        {
          title: "Manage Permissions",
          url: "permissions",
          icon: KeyRound,
          permissions: ["permission:view"],
        },
        {
          title: "Analytics",
          url: "analytics",
          icon: ChartNoAxesGantt,
        },
        {
          title: "Activity Log",
          url: "activity-log",
          icon: Activity,
          permissions: ["activity:view"],
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
          <SidebarMenuSub>
            {item.items.map((subItem) => {
              const SubIcon = subItem.icon;

              return (
                <SidebarMenuSubItem key={subItem.title}>
                  <SidebarMenuSubButton asChild>
                    <NavLink to={subItem.url}>
                      {SubIcon ? <SubIcon /> : null}
                      <span>{subItem.title}</span>
                    </NavLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { authUser, permissions } = useSelector((state: RootState) => state.user);
  const HomeIcon = data.navHome.icon;
  const navMain = data.navMain
    .map((item) => ({
      ...item,
      items: item.items.filter((subItem) => canSeeNavItem(subItem, permissions)),
    }))
    .filter((item) => item.items.length > 0);

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

              {navMain.map((item) => (
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
            name:
              `${authUser?.data?.user?.firstName ?? ""} ${authUser?.data?.user?.middleName ?? ""}`.trim() ||
              (authUser?.data?.user?.username ?? ""),
            username: authUser?.data?.user?.username ?? "",
            avatar: avatarSrc(authUser?.data?.user?.avatar),
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}

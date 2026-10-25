import * as React from "react";
import {
  Activity,
  ArrowLeftRight,
  ChartBar,
  ChartNoAxesGantt,
  ChevronRight,
  CreditCard,
  CreditCardIcon,
  Download,
  FileSearch,
  FileUp,
  Home,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LucideIdCard,
  Radio,
  PieChart,
  Scale,
  Search,
  ServerCog,
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
  SwitchIcon,
} from "./icons/success-rate-icons";
import { NavLink } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store/store";
import { hasPermission } from "../../utility/has-permission";
import { avatarSrc } from "@/lib/avatars";
import { MdCreditCard, MdOutlineCreditCard } from "react-icons/md";

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

/** Top-level leaf links (same row style as Home, not under a collapsible group). */
type NavLinkItem = {
  title: string;
  icon?: NavIcon;
  url: string;
  permissions?: string[];
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
  navLinks: NavLinkItem[];
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

  navLinks: [],

  navMain: [
    {
      // Icon legend â€” learn once, reused across channels:
      // overall = channel identity (SwitchIcon / AtmIcon / PosIcon)
      // on-us = OnUsIcon (bank / CoopBank)
      // off-us = OffUsIcon (cross-bank swap)
      // remote on-us = IssuingIcon (CoopBank cards elsewhere)
      // issuing = on-us + remote on-us (switch)
      // acquiring = AcquiringIcon (inbound payments)
      title: "Success Rates",
      icon: SuccessRateIcon,
      url: "#",
      items: [
        {
          title: "Switch Overall",
          icon: SwitchIcon,
          url: "switch-overall-success-rate",
          permissions: [
            "report:view-switch-overall-success-rate",
          ],
        },
        {
          title: "Switch On-us",
          icon: OnUsIcon,
          url: "switch-onus-success-rate",
          permissions: [
            "report:view-switch-onus-success-rate",
          ],
        },
        {
          title: "Switch Off-us",
          icon: OffUsIcon,
          url: "switch-offus-success-rate",
          permissions: [
            "report:view-switch-offus-success-rate",
          ],
        },
        {
          title: "Switch Remote On-us",
          icon: IssuingIcon,
          url: "switch-remote-onus-success-rate",
          permissions: [
            "report:view-switch-remote-onus-success-rate",
            "report:view-switch-issuing-success-rate",
          ],
        },
        {
          title: "Switch Issuing",
          icon: IssuingIcon,
          url: "switch-issuing-success-rate",
          permissions: [
            "report:view-switch-issuing-success-rate",
          ],
        },
        {
          title: "ATM Overall",
          icon: AtmIcon,
          url: "atm-overall-success-rate",
          permissions: [
            "report:view-atm-overall-success-rate",
          ],
        },
        {
          title: "ATM Acquiring",
          icon: AcquiringIcon,
          url: "atm-acquiring-success-rate",
          permissions: [
            "report:view-atm-acquiring-success-rate",
          ],
        },
        {
          title: "ATM On-us",
          icon: OnUsIcon,
          url: "atm-onus-success-rate",
          permissions: [
            "report:view-atm-onus-success-rate",
          ],
        },
        {
          title: "ATM Off-us",
          icon: OffUsIcon,
          url: "atm-offus-success-rate",
          permissions: [
            "report:view-atm-offus-success-rate",
          ],
        },
        {
          title: "ATM Remote On-us",
          icon: IssuingIcon,
          url: "atm-issuing-success-rate",
          permissions: [
            "report:view-atm-issuing-success-rate",
          ],
        },
        {
          title: "POS Overall",
          icon: PosIcon,
          url: "pos-overall-success-rate",
          permissions: [
            "report:view-pos-overall-success-rate",
          ],
        },
        {
          title: "POS Acquiring",
          icon: AcquiringIcon,
          url: "pos-acquiring-success-rate",
          permissions: [
            "report:view-pos-acquiring-success-rate",
          ],
        },
        {
          title: "POS On-us",
          icon: OnUsIcon,
          url: "pos-onus-success-rate",
          permissions: [
            "report:view-pos-onus-success-rate",
          ],
        },
        {
          title: "POS Off-us",
          icon: OffUsIcon,
          url: "pos-offus-success-rate",
          permissions: [
            "report:view-pos-offus-success-rate",
          ],
        },
        {
          title: "POS Remote On-us",
          icon: IssuingIcon,
          url: "pos-issuing-success-rate",
          permissions: [
            "report:view-pos-issuing-success-rate",
          ],
        },
        {
          title: "POS Terminal Success Rate",
          icon: PosIcon,
          url: "pos-terminal-success-rate",
          permissions: [
            "report:view-pos-acquiring-success-rate",
          ],
        },
        {
          title: "ATM Terminal Success Rate",
          icon: AtmIcon,
          url: "atm-terminal-success-rate",
          permissions: [
            "report:view-atm-acquiring-success-rate",
          ],
        },
        {
          title: "Card Type Success Rate",
          icon: CreditCard,
          url: "card-product-success-rate",
          permissions: [
            "report:view-card-product-success-rate",
            "report:view-switch-overall-success-rate",
            "report:view-atm-acquiring-success-rate",
            "report:view-atm-overall-success-rate",
            "report:view-pos-acquiring-success-rate",
            "report:view-pos-overall-success-rate",
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
        {
          title: "Transaction Mix",
          icon: PieChart,
          url: "transaction-mix",
          permissions: ["report:view-transaction-mix"],
        },
        {
          title: "Switch transaction search",
          icon: Search,
          url: "switch-transaction-search",
          permissions: ["report:search-switch-transactions"],
        },
        {
          title: "Cortex transaction search",
          icon: Search,
          url: "cortex-transaction-search",
          permissions: ["report:search-cortex-transactions"],
        },
        {
          title: "Switch / Cortex export",
          icon: Download,
          url: "terminal-recon-export",
          permissions: [
            "report:export-switch-terminal-recon",
            "report:export-cortex-terminal-recon",
          ],
        },
      ],
    },
    {
      title: "Monitoring",
      icon: Activity,
      url: "#",
      items: [
        {
          title: "IST switch health",
          icon: ServerCog,
          url: "ist-monitoring",
          permissions: ["monitoring:view-ist"],
        },
        {
          title: "Advice Message",
          icon: Inbox,
          url: "saf-monitoring",
          permissions: ["monitoring:view-saf"],
        },
        {
          title: "ATM monitoring",
          icon: AtmIcon,
          url: "atm-monitoring",
          permissions: ["monitoring:view-atm"],
        },
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
      title: "Cards",
      icon: CreditCardIcon,
      url: "#",
      items: [
        {
          title: "Number of Cards Per Status",
          icon: MdCreditCard,
          url: "cards-per-status",
          permissions: ["card:view-number-of-cards-per-status"],
        },
        {
          title: "Card Activity Dashboard",
          icon: Activity,
          url: "card-activity",
          permissions: ["card:view-activity-dashboard"],
        },
        {
          title: "Prepaid Visa Int.",
          icon: VisaIcon,
          url: "prepaid-visa",
          permissions: ["card:view-prepaid-visa"],
        },
        {
          title: "Prepaid Visa Top-ups",
          icon: Wallet,
          url: "prepaid-visa/top-ups",
          permissions: ["card:view-prepaid-visa"],
        },
        {
          title: "Prepaid Visa Unloads",
          icon: Wallet,
          url: "prepaid-visa/unloads",
          permissions: ["card:view-prepaid-visa"],
        },
        {
          title: "Prepaid Visa Txns",
          icon: ArrowLeftRight,
          url: "prepaid-visa/transactions",
          permissions: ["card:view-prepaid-visa"],
        },
      ],
    },
    {
      title: "EJ",
      icon: FileSearch,
      url: "#",
      items: [
        {
          title: "Finder",
          icon: Search,
          url: "ej-finder",
          permissions: ["report:search-ej-transactions"],
        },
        {
          title: "Coverage",
          icon: ChartBar,
          url: "ej-coverage",
          permissions: ["report:search-ej-transactions"],
        },
      ],
    },
    {
      title: "Clearing",
      icon: Scale,
      url: "#",
      items: [
        {
          title: "Uncleared",
          url: "clearing/uncleared",
          icon: Inbox,
          permissions: [
            "clearing:view-uncleared-eth",
            "clearing:view-uncleared-visa",
            "clearing:view-uncleared-visa-cybersource",
            "clearing:view-uncleared-mastercard",
          ],
        },
        {
          title: "Cleared",
          url: "clearing/cleared",
          icon: Scale,
          permissions: [
            "clearing:view-cleared-eth",
            "clearing:view-cleared-visa",
            "clearing:view-cleared-visa-cybersource",
            "clearing:view-uncleared-visa-cybersource",
            "clearing:view-cleared-mastercard",
          ],
        },
      ],
    },
    {
      title: "Settlement",
      icon: Wallet,
      url: "#",
      items: [
        {
          title: "Unsettled",
          url: "settlement/unsettled",
          icon: Inbox,
          permissions: [
            "settlement:view-unsettled-eth",
            "settlement:view-unsettled-visa",
            "settlement:view-unsettled-visa-cybersource",
            "settlement:view-unsettled-mastercard",
          ],
        },
        {
          title: "Settled",
          url: "settlement/settled",
          icon: Wallet,
          permissions: [
            "settlement:view-settled-eth",
            "settlement:view-settled-visa",
            "settlement:view-settled-mastercard",
          ],
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
          permissions: ["analytics:view"],
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
  const { authUser, permissions } = useSelector(
    (state: RootState) => state.user,
  );
  const HomeIcon = data.navHome.icon;
  const navLinks = data.navLinks.filter((item) =>
    canSeeNavItem(item, permissions),
  );
  const navMain = data.navMain
    .map((item) => ({
      ...item,
      items: item.items.filter((subItem) =>
        canSeeNavItem(subItem, permissions),
      ),
    }))
    .filter((item) => item.items.length > 0);

  return (
    <Sidebar variant="sidebar" collapsible="icon" {...props}>
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

              {navLinks.map((item) => {
                const LinkIcon = item.icon;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink to={item.url}>
                        {LinkIcon ? <LinkIcon /> : null}
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

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

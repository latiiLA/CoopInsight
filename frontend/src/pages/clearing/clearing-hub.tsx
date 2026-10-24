import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hasPermission } from "../../../utility/has-permission";
import { RootState } from "../../../app/store/store";

import Cleared from "./cleared";
import Uncleared from "./uncleared";
import {
  firstAllowedScheme,
  parseScheme,
  type SchemeId,
  type SchemeTab,
} from "./scheme";

type ClearingStage = "uncleared" | "cleared";

const unclearedTabs: SchemeTab[] = [
  {
    id: "eth",
    label: "ETH",
    permissions: ["clearing:view-uncleared-eth"],
  },
  {
    id: "visa",
    label: "Visa",
    permissions: ["clearing:view-uncleared-visa"],
  },
  {
    id: "visacbs",
    label: "Cybersource",
    permissions: ["clearing:view-uncleared-visa-cybersource"],
  },
  {
    id: "mastercard",
    label: "Mastercard",
    permissions: ["clearing:view-uncleared-mastercard"],
  },
];

const clearedTabs: SchemeTab[] = [
  {
    id: "eth",
    label: "ETH",
    permissions: ["clearing:view-cleared-eth"],
  },
  {
    id: "visa",
    label: "Visa",
    permissions: ["clearing:view-cleared-visa"],
  },
  {
    id: "visacbs",
    label: "Cybersource",
    permissions: [
      "clearing:view-cleared-visa-cybersource",
      "clearing:view-uncleared-visa-cybersource",
    ],
  },
  {
    id: "mastercard",
    label: "Mastercard",
    permissions: ["clearing:view-cleared-mastercard"],
  },
];

const unclearedCopy: Record<
  SchemeId,
  {
    product: "ETB" | "VISA" | "MDS" | "VISACBS";
    title: string;
    description: string;
  }
> = {
  eth: {
    product: "ETB",
    title: "Uncleared ETH",
    description: "Approved domestic POS purchases that still need clearing.",
  },
  visa: {
    product: "VISA",
    title: "Uncleared Visa",
    description: "Approved Visa POS purchases that still need clearing.",
  },
  visacbs: {
    product: "VISACBS",
    title: "Uncleared Cybersource",
    description:
      "Approved Visa Cybersource transactions that still need clearing.",
  },
  mastercard: {
    product: "MDS",
    title: "Uncleared Mastercard",
    description: "Approved Mastercard POS purchases that still need clearing.",
  },
};

const clearedCopy: Record<
  SchemeId,
  {
    product: "ETB" | "VISA" | "MDS" | "VISACBS";
    title: string;
    description: string;
  }
> = {
  eth: {
    product: "ETB",
    title: "Cleared ETH",
    description:
      "Approved domestic POS purchases that have been posted for clearing.",
  },
  visa: {
    product: "VISA",
    title: "Cleared Visa",
    description:
      "Approved Visa POS purchases that have been posted for clearing.",
  },
  visacbs: {
    product: "VISACBS",
    title: "Cleared Cybersource",
    description:
      "Approved Visa Cybersource transactions that have been posted for clearing.",
  },
  mastercard: {
    product: "MDS",
    title: "Cleared Mastercard",
    description:
      "Approved Mastercard POS purchases that have been posted for clearing.",
  },
};

export default function ClearingHub({ stage }: { stage: ClearingStage }) {
  const granted = useSelector((state: RootState) => state.user.permissions);
  const [searchParams, setSearchParams] = useSearchParams();

  const allTabs = stage === "uncleared" ? unclearedTabs : clearedTabs;
  const visibleTabs = useMemo(
    () => allTabs.filter((tab) => hasPermission(tab.permissions, granted)),
    [allTabs, granted],
  );
  const allowedIds = visibleTabs.map((t) => t.id);
  const requested = parseScheme(searchParams.get("scheme"), allowedIds);
  const active = requested ?? firstAllowedScheme(visibleTabs);

  const onSchemeChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("scheme", value);
    setSearchParams(next, { replace: true });
  };

  if (!active || visibleTabs.length === 0) {
    return (
      <div className="container mx-auto py-10 text-center text-sm text-muted-foreground">
        You do not have access to any {stage} schemes.
      </div>
    );
  }

  return (
    <Tabs value={active} onValueChange={onSchemeChange} className="gap-0">
      <div className="container mx-auto pt-2">
        <TabsList>
          {visibleTabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {visibleTabs.map((tab) => {
        const copy =
          stage === "uncleared" ? unclearedCopy[tab.id] : clearedCopy[tab.id];
        return (
          <TabsContent key={tab.id} value={tab.id} className="mt-0">
            {stage === "uncleared" ? (
              <Uncleared
                key={`uncleared-${tab.id}`}
                product={copy.product}
                title={copy.title}
                description={copy.description}
              />
            ) : (
              <Cleared
                key={`cleared-${tab.id}`}
                product={copy.product}
                title={copy.title}
                description={copy.description}
              />
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

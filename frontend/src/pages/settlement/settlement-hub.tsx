import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hasPermission } from "../../../utility/has-permission";
import { RootState } from "../../../app/store/store";
import {
  firstAllowedScheme,
  parseScheme,
  type SchemeId,
  type SchemeTab,
} from "../clearing/scheme";

import MastercardIPM from "./mastercard-ipm/mastercard-ipm";
import Settled from "./settled";
import Unsettled from "./unsettled";
import VisaCyberSource from "./visa-cybersource/visa-cybersource";

type SettlementStage = "unsettled" | "settled";

const unsettledTabs: SchemeTab[] = [
  {
    id: "eth",
    label: "ETH",
    permissions: ["settlement:view-unsettled-eth"],
  },
  {
    id: "visa",
    label: "Visa",
    permissions: ["settlement:view-unsettled-visa"],
  },
  {
    id: "visacbs",
    label: "Cybersource",
    permissions: ["settlement:view-unsettled-visa-cybersource"],
  },
  {
    id: "mastercard",
    label: "Mastercard",
    permissions: ["settlement:view-unsettled-mastercard"],
  },
];

const settledTabs: SchemeTab[] = [
  {
    id: "eth",
    label: "ETH",
    permissions: ["settlement:view-settled-eth"],
  },
  {
    id: "visa",
    label: "Visa",
    permissions: ["settlement:view-settled-visa"],
  },
  {
    id: "mastercard",
    label: "Mastercard",
    permissions: ["settlement:view-settled-mastercard"],
  },
];

const unsettledCopy: Record<
  SchemeId,
  {
    product: "ETB" | "VISA" | "MDS" | "VISACBS";
    title: string;
    description: string;
  }
> = {
  eth: {
    product: "ETB",
    title: "Unsettled ETH",
    description:
      "Approved domestic POS purchases that still need settlement.",
  },
  visa: {
    product: "VISA",
    title: "Unsettled Visa",
    description: "Approved Visa POS purchases that still need settlement.",
  },
  visacbs: {
    product: "VISACBS",
    title: "Unsettled Cybersource",
    description:
      "Approved Visa Cybersource transactions that still need settlement.",
  },
  mastercard: {
    product: "MDS",
    title: "Unsettled Mastercard",
    description:
      "Approved Mastercard POS purchases that still need settlement.",
  },
};

export default function SettlementHub({ stage }: { stage: SettlementStage }) {
  const granted = useSelector((state: RootState) => state.user.permissions);
  const [searchParams, setSearchParams] = useSearchParams();

  const allTabs = stage === "unsettled" ? unsettledTabs : settledTabs;
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
      {visibleTabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="mt-0">
          {stage === "unsettled" ? (
            <Unsettled
              key={`unsettled-${tab.id}`}
              product={unsettledCopy[tab.id].product}
              title={unsettledCopy[tab.id].title}
              description={unsettledCopy[tab.id].description}
            />
          ) : tab.id === "eth" ? (
            <Settled
              key="settled-ETB"
              product="ETB"
              title="Settled ETH"
              description="Domestic POS purchases that have been cleared and settled."
            />
          ) : tab.id === "visa" ? (
            <VisaCyberSource key="settled-visa-upload" />
          ) : (
            <MastercardIPM key="settled-mastercard-ipm" />
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

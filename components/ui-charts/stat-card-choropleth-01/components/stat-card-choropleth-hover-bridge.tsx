"use client";

// oxlint-disable react-doctor/no-pass-data-to-parent -- Callbacks in this file intentionally report measured, generated, or selected data to an owning parent component.

import { useChoropleth } from "@/components/ui-charts";
import { useEffect } from "react";
import { computeVisitorTrend, getVisitorValue } from "../data/visitors";
import type { StatCardHoverState } from "@/components/ui-charts/stat-card-chart";

/** Syncs hovered choropleth feature into stat card NumberFlow and trend badge. */
export function StatCardChoroplethHoverBridge({
  onHoverChange,
}: {
  onHoverChange: (state: StatCardHoverState) => void;
}) {
  const { tooltipData } = useChoropleth();

  useEffect(() => {
    if (!tooltipData?.feature) {
      onHoverChange({ value: null, label: null, trend: null });
      return;
    }

    const feature = tooltipData.feature;
    const label = (feature.properties?.name as string | undefined) ?? "Unknown";
    const visitors = getVisitorValue(feature);
    const value = visitors ?? 0;
    const trend = visitors === undefined ? null : computeVisitorTrend(visitors);

    onHoverChange({ value, label, trend });
  }, [onHoverChange, tooltipData]);

  return null;
}

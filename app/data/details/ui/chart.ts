import type { ComponentDetail } from "@/app/data/component-detail-types";

export const CHART_DETAIL: ComponentDetail = {
    description:
      "A chart container component that wraps recharts with theme-aware colors, tooltip, and legend support.",
    usage: `import { Bar, BarChart } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const config = {
  value: { label: "Value", color: "var(--color-chart-1)" },
} satisfies ChartConfig;

<ChartContainer config={config}>
  <BarChart data={data}>
    <ChartTooltip content={<ChartTooltipContent />} />
    <Bar dataKey="value" fill="var(--color-value)" />
  </BarChart>
</ChartContainer>`,
    props: [
      {
        name: "config",
        type: "ChartConfig",
        required: true,
        description:
          "Chart configuration mapping data keys to labels and colors.",
      },
    ],
    subComponents: [
      { name: "ChartTooltip", description: "Tooltip wrapper for recharts." },
      { name: "ChartTooltipContent", description: "Styled tooltip content." },
      { name: "ChartLegend", description: "Legend wrapper for recharts." },
      { name: "ChartLegendContent", description: "Styled legend content." },
    ],
    examples: [
      {
        title: "Default",
        description: "Bar chart with tooltip.",
        demoSlug: "chart-demo-default",
      },
      {
        title: "With legend",
        description: "Multi-series chart with legend.",
        demoSlug: "chart-demo-with-legend",
      },
      {
        title: "Area chart",
        description: "Area chart with gradient fill.",
        demoSlug: "chart-demo-area-chart",
      },
      {
        title: "Bar chart",
        description: "Grouped bar chart with multiple series.",
        demoSlug: "chart-demo-bar-chart",
      },
      {
        title: "Line chart",
        description: "Multi-line chart.",
        demoSlug: "chart-demo-line-chart",
      },
      {
        title: "Radar chart",
        description: "Radar chart with multiple series.",
        demoSlug: "chart-demo-radar-chart",
      },
      {
        title: "Radial chart",
        description: "Radial bar chart with center label.",
        demoSlug: "chart-demo-radial-chart",
      },
      // shadcn chart gallery: Area
      {
        title: "Area Chart - Interactive",
        id: "chart-area-interactive",
        description: "An interactive area chart.",
        demoSlug: "chart-area-interactive",
      },
      {
        title: "Area Chart",
        id: "chart-area",
        description: "A simple area chart.",
        demoSlug: "chart-area",
      },
      {
        title: "Area Chart - Linear",
        id: "chart-area-linear",
        description: "A linear area chart.",
        demoSlug: "chart-area-linear",
      },
      {
        title: "Area Chart - Step",
        id: "chart-area-step",
        description: "A step area chart.",
        demoSlug: "chart-area-step",
      },
      {
        title: "Area Chart - Legend",
        id: "chart-area-legend",
        description: "An area chart with a legend.",
        demoSlug: "chart-area-legend",
      },
      {
        title: "Area Chart - Stacked",
        id: "chart-area-stacked",
        description: "A stacked area chart.",
        demoSlug: "chart-area-stacked",
      },
      {
        title: "Area Chart - Stacked Expanded",
        id: "chart-area-stacked-expanded",
        description: "A stacked area chart with expand stacking.",
        demoSlug: "chart-area-stacked-expanded",
      },
      {
        title: "Area Chart - Icons",
        id: "chart-area-icons",
        description: "An area chart with icons.",
        demoSlug: "chart-area-icons",
      },
      {
        title: "Area Chart - Gradient",
        id: "chart-area-gradient",
        description: "An area chart with gradient fill.",
        demoSlug: "chart-area-gradient",
      },
      {
        title: "Area Chart - Axes",
        id: "chart-area-axes",
        description: "An area chart with axes.",
        demoSlug: "chart-area-axes",
      },
      // shadcn chart gallery: Bar
      {
        title: "Bar Chart - Interactive",
        id: "chart-bar-interactive",
        description: "An interactive bar chart.",
        demoSlug: "chart-bar-interactive",
      },
      {
        title: "Bar Chart",
        id: "chart-bar",
        description: "A bar chart.",
        demoSlug: "chart-bar",
      },
      {
        title: "Bar Chart - Horizontal",
        id: "chart-bar-horizontal",
        description: "A horizontal bar chart.",
        demoSlug: "chart-bar-horizontal",
      },
      {
        title: "Bar Chart - Multiple",
        id: "chart-bar-multiple",
        description: "A multiple bar chart.",
        demoSlug: "chart-bar-multiple",
      },
      {
        title: "Bar Chart - Stacked + Legend",
        id: "chart-bar-chart-stacked-legend",
        description: "A stacked bar chart with a legend.",
        demoSlug: "chart-bar-chart-stacked-legend",
      },
      {
        title: "Bar Chart - Label",
        id: "chart-bar-label",
        description: "A bar chart with a label.",
        demoSlug: "chart-bar-label",
      },
      {
        title: "Bar Chart - Custom Label",
        id: "chart-bar-custom-label",
        description: "A bar chart with a custom label.",
        demoSlug: "chart-bar-custom-label",
      },
      {
        title: "Bar Chart - Mixed",
        id: "chart-bar-mixed",
        description: "A mixed bar chart.",
        demoSlug: "chart-bar-mixed",
      },
      {
        title: "Bar Chart - Active",
        id: "chart-bar-active",
        description: "A bar chart with an active bar.",
        demoSlug: "chart-bar-active",
      },
      {
        title: "Bar Chart - Negative",
        id: "chart-bar-negative",
        description: "A bar chart with negative values.",
        demoSlug: "chart-bar-negative",
      },
      // shadcn chart gallery: Line
      {
        title: "Line Chart - Interactive",
        id: "chart-line-interactive",
        description: "An interactive line chart.",
        demoSlug: "chart-line-interactive",
      },
      {
        title: "Line Chart",
        id: "chart-line",
        description: "A line chart.",
        demoSlug: "chart-line",
      },
      {
        title: "Line Chart - Linear",
        id: "chart-line-linear",
        description: "A linear line chart.",
        demoSlug: "chart-line-linear",
      },
      {
        title: "Line Chart - Step",
        id: "chart-line-step",
        description: "A line chart with step.",
        demoSlug: "chart-line-step",
      },
      {
        title: "Line Chart - Multiple",
        id: "chart-line-multiple",
        description: "A multiple line chart.",
        demoSlug: "chart-line-multiple",
      },
      {
        title: "Line Chart - Dots",
        id: "chart-line-dots",
        description: "A line chart with dots.",
        demoSlug: "chart-line-dots",
      },
      {
        title: "Line Chart - Custom Dots",
        id: "chart-line-custom-dots",
        description: "A line chart with custom dots.",
        demoSlug: "chart-line-custom-dots",
      },
      {
        title: "Line Chart - Dots Colors",
        id: "chart-line-dots-colors",
        description: "A line chart with dots and colors.",
        demoSlug: "chart-line-dots-colors",
      },
      {
        title: "Line Chart - Label",
        id: "chart-line-label",
        description: "A line chart with a label.",
        demoSlug: "chart-line-label",
      },
      {
        title: "Line Chart - Custom Label",
        id: "chart-line-custom-label",
        description: "A line chart with a custom label.",
        demoSlug: "chart-line-custom-label",
      },
      // shadcn chart gallery: Pie
      {
        title: "Pie Chart",
        id: "chart-pie",
        description: "A simple pie chart.",
        demoSlug: "chart-pie",
      },
      {
        title: "Pie Chart - Separator None",
        id: "chart-pie-separator-none",
        description: "A pie chart with no separator.",
        demoSlug: "chart-pie-separator-none",
      },
      {
        title: "Pie Chart - Label",
        id: "chart-pie-label",
        description: "A pie chart with a label.",
        demoSlug: "chart-pie-label",
      },
      {
        title: "Pie Chart - Custom Label",
        id: "chart-pie-custom-label",
        description: "A pie chart with a custom label.",
        demoSlug: "chart-pie-custom-label",
      },
      {
        title: "Pie Chart - Label List",
        id: "chart-pie-label-list",
        description: "A pie chart with a label list.",
        demoSlug: "chart-pie-label-list",
      },
      {
        title: "Pie Chart - Legend",
        id: "chart-pie-legend",
        description: "A pie chart with a legend.",
        demoSlug: "chart-pie-legend",
      },
      {
        title: "Pie Chart - Donut",
        id: "chart-pie-donut",
        description: "A donut chart.",
        demoSlug: "chart-pie-donut",
      },
      {
        title: "Pie Chart - Donut Active",
        id: "chart-pie-donut-active",
        description: "A donut chart with an active sector.",
        demoSlug: "chart-pie-donut-active",
      },
      {
        title: "Pie Chart - Donut with Text",
        id: "chart-pie-donut-with-text",
        description: "A donut chart with text.",
        demoSlug: "chart-pie-donut-with-text",
      },
      {
        title: "Pie Chart - Stacked",
        id: "chart-pie-stacked",
        description: "A pie chart with stacked sections.",
        demoSlug: "chart-pie-stacked",
      },
      {
        title: "Pie Chart - Interactive",
        id: "chart-pie-interactive",
        description: "An interactive pie chart.",
        demoSlug: "chart-pie-interactive",
      },
      // shadcn chart gallery: Radar
      {
        title: "Radar Chart",
        id: "chart-radar",
        description: "A radar chart.",
        demoSlug: "chart-radar",
      },
      {
        title: "Radar Chart - Dots",
        id: "chart-radar-dots",
        description: "A radar chart with dots.",
        demoSlug: "chart-radar-dots",
      },
      {
        title: "Radar Chart - Lines Only",
        id: "chart-radar-lines-only",
        description: "A radar chart with lines only.",
        demoSlug: "chart-radar-lines-only",
      },
      {
        title: "Radar Chart - Multiple",
        id: "chart-radar-multiple",
        description: "A radar chart with multiple data.",
        demoSlug: "chart-radar-multiple",
      },
      {
        title: "Radar Chart - Legend",
        id: "chart-radar-legend",
        description: "A radar chart with a legend.",
        demoSlug: "chart-radar-legend",
      },
      {
        title: "Radar Chart - Custom Label",
        id: "chart-radar-custom-label",
        description: "A radar chart with a custom label.",
        demoSlug: "chart-radar-custom-label",
      },
      {
        title: "Radar Chart - Grid Custom",
        id: "chart-radar-grid-custom",
        description: "A radar chart with a custom grid.",
        demoSlug: "chart-radar-grid-custom",
      },
      {
        title: "Radar Chart - Grid None",
        id: "chart-radar-grid-none",
        description: "A radar chart with no grid.",
        demoSlug: "chart-radar-grid-none",
      },
      {
        title: "Radar Chart - Grid Circle",
        id: "chart-radar-grid-circle",
        description: "A radar chart with a grid and circle.",
        demoSlug: "chart-radar-grid-circle",
      },
      {
        title: "Radar Chart - Grid Circle - No lines",
        id: "chart-radar-grid-circle-no-lines",
        description: "A radar chart with a circle grid and no radial lines.",
        demoSlug: "chart-radar-grid-circle-no-lines",
      },
      {
        title: "Radar Chart - Grid Circle Filled",
        id: "chart-radar-grid-circle-filled",
        description: "A radar chart with a grid and circle fill.",
        demoSlug: "chart-radar-grid-circle-filled",
      },
      {
        title: "Radar Chart - Grid Filled",
        id: "chart-radar-grid-filled",
        description: "A radar chart with a grid filled.",
        demoSlug: "chart-radar-grid-filled",
      },
      // shadcn chart gallery: Radial
      {
        title: "Radial Chart",
        id: "chart-radial",
        description: "A radial chart.",
        demoSlug: "chart-radial",
      },
      {
        title: "Radial Chart - Label",
        id: "chart-radial-label",
        description: "A radial chart with a label.",
        demoSlug: "chart-radial-label",
      },
      {
        title: "Radial Chart - Grid",
        id: "chart-radial-grid",
        description: "A radial chart with a grid.",
        demoSlug: "chart-radial-grid",
      },
      {
        title: "Radial Chart - Text",
        id: "chart-radial-text",
        description: "A radial chart with text.",
        demoSlug: "chart-radial-text",
      },
      {
        title: "Radial Chart - Shape",
        id: "chart-radial-shape",
        description: "A radial chart with a custom shape.",
        demoSlug: "chart-radial-shape",
      },
      {
        title: "Radial Chart - Stacked",
        id: "chart-radial-stacked",
        description: "A radial chart with stacked sections.",
        demoSlug: "chart-radial-stacked",
      },
      // shadcn chart gallery: Tooltip
      {
        title: "Tooltip - Default",
        id: "chart-tooltip",
        description: "Default tooltip with ChartTooltipContent.",
        demoSlug: "chart-tooltip",
      },
      {
        title: "Tooltip - Line Indicator",
        id: "chart-tooltip-line-indicator",
        description: "Tooltip with a line indicator.",
        demoSlug: "chart-tooltip-line-indicator",
      },
      {
        title: "Tooltip - No Indicator",
        id: "chart-tooltip-no-indicator",
        description: "Tooltip with no indicator.",
        demoSlug: "chart-tooltip-no-indicator",
      },
      {
        title: "Tooltip - Custom label",
        id: "chart-tooltip-custom-label",
        description: "Tooltip with a custom label from chartConfig.",
        demoSlug: "chart-tooltip-custom-label",
      },
      {
        title: "Tooltip - Label Formatter",
        id: "chart-tooltip-label-formatter",
        description: "Tooltip with a label formatter.",
        demoSlug: "chart-tooltip-label-formatter",
      },
      {
        title: "Tooltip - No Label",
        id: "chart-tooltip-no-label",
        description: "Tooltip with no label.",
        demoSlug: "chart-tooltip-no-label",
      },
      {
        title: "Tooltip - Formatter",
        id: "chart-tooltip-formatter",
        description: "Tooltip with a custom value formatter.",
        demoSlug: "chart-tooltip-formatter",
      },
      {
        title: "Tooltip - Icons",
        id: "chart-tooltip-icons",
        description: "Tooltip with icons from chartConfig.",
        demoSlug: "chart-tooltip-icons",
      },
      {
        title: "Tooltip - Advanced",
        id: "chart-tooltip-advanced",
        description: "Tooltip with a custom formatter and a total row.",
        demoSlug: "chart-tooltip-advanced",
      },
    ],
  };

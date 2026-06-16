"use client";

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import type { ChartOptions } from "chart.js";
import type { ReactNode } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import type { ReportChart } from "@jstack/types/report-payload-v1";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
);

const AXIS = "#94a3b8";
const GRID = "rgba(148, 163, 184, 0.12)";

function titlePlugin(
  chart: ReportChart,
): NonNullable<ChartOptions<"bar">["plugins"]>["title"] {
  return chart.title
    ? { display: true, text: chart.title, color: "#e2e8f0", font: { size: 14 } }
    : { display: false };
}

function buildBarOrLineOptions(chart: ReportChart): ChartOptions<"bar" | "line"> {
  const opts = chart.options;
  const stacked = opts?.stacked === true;
  const beginAtZero = opts?.y_axis_begin_at_zero !== false;
  return {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1.8,
    plugins: {
      legend: { labels: { color: AXIS } },
      title: titlePlugin(chart),
    },
    scales: {
      x: {
        stacked,
        ticks: { color: AXIS },
        grid: { color: GRID },
      },
      y: {
        stacked,
        beginAtZero,
        ticks: { color: AXIS },
        grid: { color: GRID },
      },
    },
  };
}

function buildDoughnutOptions(chart: ReportChart): ChartOptions<"doughnut"> {
  return {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1.4,
    plugins: {
      legend: { labels: { color: AXIS } },
      title: titlePlugin(chart) as NonNullable<ChartOptions<"doughnut">["plugins"]>["title"],
    },
  };
}

export function ReportChartBlock({ chart }: { chart: ReportChart }): ReactNode {
  const data = {
    labels: chart.labels,
    datasets: chart.datasets.map((d) => ({
      label: d.label,
      data: d.data,
      backgroundColor: d.backgroundColor,
      borderColor: d.borderColor,
      fill: d.fill,
    })),
  };
  if (chart.type === "bar") {
    return (
      <div className="relative h-[min(24rem,50vh)] w-full min-h-[12rem]">
        <Bar data={data} options={buildBarOrLineOptions(chart) as ChartOptions<"bar">} />
      </div>
    );
  }
  if (chart.type === "line") {
    return (
      <div className="relative h-[min(24rem,50vh)] w-full min-h-[12rem]">
        <Line data={data} options={buildBarOrLineOptions(chart) as ChartOptions<"line">} />
      </div>
    );
  }
  return (
    <div className="relative mx-auto max-w-md">
      <Doughnut data={data} options={buildDoughnutOptions(chart)} />
    </div>
  );
}

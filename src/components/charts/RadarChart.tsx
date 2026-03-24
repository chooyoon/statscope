"use client";

import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface RadarChartDataPoint {
  label: string;
  value: number;
  fullMark: number;
}

interface RadarChartProps {
  data: RadarChartDataPoint[];
  color: string;
  title?: string;
}

export default function RadarChart({ data, color, title }: RadarChartProps) {
  return (
    <div className="w-full">
      {title && (
        <h3 className="text-sm font-semibold text-slate-700 mb-2 text-center">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={300}>
        <RechartsRadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis
            dataKey="label"
            tick={{ fill: "#475569", fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, "auto"]}
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              color: "#1e293b",
              fontSize: "12px",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
            }}
          />
          <Radar
            name="Stats"
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}

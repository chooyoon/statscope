"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface ROIDataPoint {
  date: string;
  cumProfit: number;
}

interface ROICumulativeChartProps {
  data: ROIDataPoint[];
}

export default function ROICumulativeChart({ data }: ROICumulativeChartProps) {
  const maxProfit = Math.max(...data.map((d) => d.cumProfit), 0);
  const minProfit = Math.min(...data.map((d) => d.cumProfit), 0);

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 16, right: 24, bottom: 16, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            interval={Math.floor(data.length / 5)}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#f8fafc",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
            }}
            formatter={(value) => {
              if (typeof value === "number") {
                return `$${value.toFixed(2)}`;
              }
              return value;
            }}
            labelFormatter={(label) => `${label}`}
          />
          <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="5 5" />
          <Line
            type="monotone"
            dataKey="cumProfit"
            stroke="#3b82f6"
            dot={false}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

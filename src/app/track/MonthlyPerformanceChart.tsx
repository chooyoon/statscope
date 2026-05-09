"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface MonthlyRecord {
  month: string;
  wins: number;
  losses: number;
}

interface MonthlyPerformanceChartProps {
  data: MonthlyRecord[];
}

export default function MonthlyPerformanceChart({
  data,
}: MonthlyPerformanceChartProps) {
  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 16, right: 24, bottom: 16, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#f8fafc",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
            }}
            formatter={(value) => value}
            labelFormatter={(label) => `${label}`}
          />
          <Legend />
          <Bar dataKey="wins" fill="#10b981" name="Wins" />
          <Bar dataKey="losses" fill="#ef4444" name="Losses" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

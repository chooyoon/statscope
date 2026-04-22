"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ComposedChart,
  Legend,
} from "recharts";

interface CalibrationBin {
  binLabel: string;
  binCenter: number;
  predicted: number;
  actual: number | null;
  samples: number;
}

interface CalibrationChartProps {
  bins: CalibrationBin[];
}

export default function CalibrationChart({ bins }: CalibrationChartProps) {
  // For the "perfect calibration" reference line, map bin centers
  const perfectLine = bins.map((b) => ({
    binCenter: b.binCenter,
    perfect: b.binCenter,
  }));

  // Merge for chart: one point per bin with predicted + actual + sample count
  const data = bins.map((b, i) => ({
    ...b,
    perfect: perfectLine[i].perfect,
  }));

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 16, right: 24, bottom: 16, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            type="number"
            dataKey="binCenter"
            domain={[45, 85]}
            ticks={[50, 55, 60, 65, 70, 75, 80]}
            tickFormatter={(v) => `${v}%`}
            label={{
              value: "Predicted Win Probability",
              position: "insideBottom",
              offset: -5,
              fill: "#64748b",
              fontSize: 12,
            }}
            stroke="#94a3b8"
            fontSize={12}
          />
          <YAxis
            type="number"
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(v) => `${v}%`}
            label={{
              value: "Actual Win Rate",
              angle: -90,
              position: "insideLeft",
              fill: "#64748b",
              fontSize: 12,
            }}
            stroke="#94a3b8"
            fontSize={12}
          />
          <Tooltip
            formatter={(value, name) => {
              if (value === null || value === undefined)
                return ["No data", String(name)];
              const num =
                typeof value === "number" ? value : Number(value);
              if (Number.isNaN(num)) return [String(value), String(name)];
              if (name === "actual")
                return [`${num.toFixed(0)}%`, "Actual"];
              if (name === "perfect")
                return [`${num.toFixed(0)}%`, "Perfect calibration"];
              return [String(value), String(name)];
            }}
            labelFormatter={(label) => `Bin center: ${label}%`}
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend
            verticalAlign="top"
            height={28}
            iconType="circle"
            wrapperStyle={{ fontSize: "12px" }}
          />
          <ReferenceLine
            y={50}
            stroke="#cbd5e1"
            strokeDasharray="2 4"
            strokeWidth={1}
          />
          <Line
            type="linear"
            dataKey="perfect"
            stroke="#94a3b8"
            strokeDasharray="5 5"
            strokeWidth={2}
            dot={false}
            name="Perfect calibration"
            isAnimationActive={false}
          />
          <Scatter
            dataKey="actual"
            fill="#2563eb"
            name="Actual (our picks)"
            line={{ stroke: "#2563eb", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { inr, inrShort } from "@/lib/format";

/** Loaded on demand from the Budget page so Recharts never weighs down other pages. */

export function PlannedVsCommittedChart({ data }: { data: { name: string; Planned: number; Committed: number; color: string }[] }) {
  return (
    <div
      className="h-72"
      role="img"
      aria-label={`Planned versus committed spend: ${data.map((d) => `${d.name} ${inrShort(d.Committed)} of ${inrShort(d.Planned)}`).join("; ")}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 16 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#eee6dd" />
          <XAxis type="number" tickFormatter={(v) => inrShort(v)} fontSize={11} stroke="#a8a29e" />
          <YAxis type="category" dataKey="name" width={130} fontSize={11} stroke="#78716c" />
          <Tooltip formatter={(v) => inr(Number(v))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Planned" fill="#e7e5e4" radius={[0, 4, 4, 0]} />
          <Bar dataKey="Committed" radius={[0, 4, 4, 0]}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SpendDonut({ data }: { data: { category: string; label: string; color: string; committed: number }[] }) {
  const slices = data.filter((c) => c.committed > 0);
  return (
    <div
      className="h-64"
      role="img"
      aria-label={`Spend by category: ${slices.map((s) => `${s.label} ${inrShort(s.committed)}`).join("; ")}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={slices} dataKey="committed" nameKey="label" innerRadius={60} outerRadius={95} paddingAngle={2}>
            {slices.map((c) => (
              <Cell key={c.category} fill={c.color} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => inr(Number(v))} />
          <Legend wrapperStyle={{ fontSize: 11 }} layout="vertical" align="right" verticalAlign="middle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

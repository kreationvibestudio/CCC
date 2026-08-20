"use client";

import { useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import { PARTY_COLORS, RACE_PARTIES, type RaceAnalysis } from "@/lib/situation-room/race";

export function LiveNumber({ value }: { value: number }) {
  const shownRef = useRef(value);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const start = shownRef.current;
    const diff = value - start;
    if (diff === 0) {
      setShown(value);
      shownRef.current = value;
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 650);
      const eased = 1 - (1 - p) ** 3;
      const next = Math.round(start + diff * eased);
      shownRef.current = next;
      setShown(next);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span className="tabular-nums">{shown.toLocaleString()}</span>;
}

export function RaceBars({ race }: { race: RaceAnalysis }) {
  const max = Math.max(1, ...race.raceCounted.map((p) => Math.max(p.counted, p.projected)));
  return (
    <div className="space-y-3">
      {RACE_PARTIES.map((code) => {
        const row = race.raceCounted.find((p) => p.code === code) ?? {
          code,
          counted: 0,
          projected: 0,
          share: 0,
        };
        return (
          <div key={code}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-semibold" style={{ color: PARTY_COLORS[code] }}>
                {code}
                {code === race.ourParty ? " · our party" : ""}
              </span>
              <span className="text-xs text-muted-foreground">
                <LiveNumber value={Math.round(row.counted)} /> counted
                {row.projected > row.counted ? (
                  <>
                    {" "}
                    · <LiveNumber value={Math.round(row.projected)} /> projected
                  </>
                ) : null}
                {row.share > 0 ? ` · ${(row.share * 100).toFixed(1)}%` : ""}
              </span>
            </div>
            <div className="relative h-3 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full opacity-35"
                style={{ backgroundColor: PARTY_COLORS[code] }}
                initial={{ width: 0 }}
                animate={{ width: `${(row.projected / max) * 100}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ backgroundColor: PARTY_COLORS[code] }}
                initial={{ width: 0 }}
                animate={{ width: `${(row.counted / max) * 100}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RaceCharts({ race }: { race: RaceAnalysis }) {
  const barData = RACE_PARTIES.map((code) => ({
    party: code,
    counted: Math.round(race.countedVotes[code] ?? 0),
    projected: Math.round(race.projected[code] ?? 0),
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="h-72 rounded-xl border border-border bg-card/60 p-3">
        <p className="mb-2 text-sm font-medium">Counted vs projected</p>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="party" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="counted" name="Counted" fill="#4ade80" radius={4} />
            <Bar dataKey="projected" name="Projected" fill="#60a5fa" radius={4} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="h-72 rounded-xl border border-border bg-card/60 p-3">
        <p className="mb-2 text-sm font-medium">Cumulative race as results arrive</p>
        {race.timeline.length > 0 ? (
          <ResponsiveContainer width="100%" height="90%">
            <AreaChart data={race.timeline}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="t" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {RACE_PARTIES.map((code) => (
                <Area
                  key={code}
                  type="monotone"
                  dataKey={code}
                  stroke={PARTY_COLORS[code]}
                  fill={PARTY_COLORS[code]}
                  fillOpacity={code === race.ourParty ? 0.35 : 0.12}
                  strokeWidth={code === race.ourParty ? 2.5 : 1.5}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="flex h-[90%] items-center justify-center text-sm text-muted-foreground">
            Waiting for the first result sheet…
          </p>
        )}
      </div>
      {race.lgaBreakdown.length > 0 && (
        <div className="h-80 rounded-xl border border-border bg-card/60 p-3 lg:col-span-2">
          <p className="mb-2 text-sm font-medium">LGA results (NDC vs PDP / APC / ADC)</p>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={race.lgaBreakdown} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="lga" width={110} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {RACE_PARTIES.map((code) => (
                <Bar key={code} dataKey={code} stackId="votes" fill={PARTY_COLORS[code]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

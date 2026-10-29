"use client";
import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  Activity,
  Download,
  ScanFace,
  Workflow,
  CheckCircle2,
  Camera as CameraIcon,
  Radio,
} from "lucide-react";
import { useOdin } from "./odin-context";
import { Button, PageHeading, Badge, downloadJson } from "./common";
export default function AnalyticsPage() {
  const { data } = useOdin();
  const [range, setRange] = useState("today");
  const d = data!;
  const cutoff =
    range === "today"
      ? new Date().setHours(0, 0, 0, 0)
      : Date.now() - (range === "7d" ? 7 : 30) * 86400000;
  const events = d.events.filter((e) => e.timestamp >= cutoff);
  const executions = d.executions.filter((e) => e.timestamp >= cutoff);
  const hours = Array.from(
    { length: range === "today" ? 24 : range === "7d" ? 7 : 30 },
    (_, i) => {
      const start =
        range === "today"
          ? new Date().setHours(i, 0, 0, 0)
          : new Date().setHours(0, 0, 0, 0) -
            (Number(range.slice(0, -1)) - 1 - i) * 86400000;
      const end = start + (range === "today" ? 3600000 : 86400000);
      return {
        name:
          range === "today"
            ? `${String(i).padStart(2, "0")}:00`
            : new Date(start).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
              }),
        info: events.filter(
          (e) =>
            e.timestamp >= start && e.timestamp < end && e.severity === "info",
        ).length,
        warning: events.filter(
          (e) =>
            e.timestamp >= start &&
            e.timestamp < end &&
            e.severity === "warning",
        ).length,
        critical: events.filter(
          (e) =>
            e.timestamp >= start &&
            e.timestamp < end &&
            e.severity === "critical",
        ).length,
      };
    },
  );
  const byCamera = d.cameras.map((c) => ({
    name: c.name.length > 20 ? c.name.slice(0, 20) + "…" : c.name,
    value: events.filter((e) => e.cameraId === c.id).length,
  }));
  const distribution = ["info", "warning", "critical"].map((s, i) => ({
    name:
      s === "info" ? "Informational" : s.charAt(0).toUpperCase() + s.slice(1),
    value: events.filter((e) => e.severity === s).length,
    color: ["#bce977", "#e9b665", "#ef7c7c"][i],
  }));
  return (
    <>
      <PageHeading
        eyebrow="THE BIGGER PICTURE"
        title="Analytics"
        description="Turn everyday observations into a clearer understanding."
      >
        <select
          aria-label="Analytics period"
          value={range}
          onChange={(e) => setRange(e.target.value)}
        >
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
        <Button
          onClick={() =>
            downloadJson("odin-analytics.json", {
              range,
              events,
              executions,
              byCamera,
            })
          }
        >
          <Download size={15} />
          Export data
        </Button>
      </PageHeading>
      <div className="stats-grid">
        {[
          {
            label: "Events observed",
            value: events.length,
            note: `${events.filter((e) => e.demo).length} sample events`,
            icon: Activity,
          },
          {
            label: "Detection confidence",
            value: events.length
              ? `${Math.round((events.reduce((a, e) => a + e.confidence, 0) / events.length) * 100)}%`
              : "—",
            note: "Average across detections",
            icon: ScanFace,
          },
          {
            label: "Workflow executions",
            value: executions.length,
            note: `${executions.filter((e) => e.status === "success").length} successful runs`,
            icon: Workflow,
          },
          {
            label: "Review completion",
            value: events.length
              ? `${Math.round((events.filter((e) => e.acknowledged).length / events.length) * 100)}%`
              : "—",
            note: `${events.filter((e) => !e.acknowledged).length} awaiting review`,
            icon: CheckCircle2,
          },
        ].map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-top">
              <span>{s.label}</span>
              <s.icon size={18} className="text-lime" />
            </div>
            <div className="stat-value">{s.value}</div>
            <span className="muted small">{s.note}</span>
          </div>
        ))}
      </div>
      <div className="analytics-grid">
        <section className="surface chart-main">
          <div className="panel-title">
            <div>
              <h2>Activity over time</h2>
              <p>Every moment, in perspective.</p>
            </div>
            <div className="chart-legend">
              {distribution.map((s) => (
                <span key={s.name}>
                  <i style={{ background: s.color }} />
                  {s.name}
                </span>
              ))}
            </div>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={hours}
                margin={{ top: 20, right: 20, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="greenArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#bce977" stopOpacity={0.25} />
                    <stop offset="1" stopColor="#bce977" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="#252a32"
                  strokeDasharray="4 5"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#858b96", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={45}
                />
                <YAxis
                  tick={{ fill: "#858b96", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1b2028",
                    border: "1px solid #343b46",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="info"
                  stroke="#bce977"
                  fill="url(#greenArea)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="warning"
                  stroke="#e9b665"
                  fill="transparent"
                  strokeWidth={1.5}
                />
                <Area
                  type="monotone"
                  dataKey="critical"
                  stroke="#ef7c7c"
                  fill="transparent"
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="surface">
          <div className="panel-title">
            <h2>Event distribution</h2>
            <Activity size={16} />
          </div>
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={distribution}
                  dataKey="value"
                  innerRadius={65}
                  outerRadius={86}
                  paddingAngle={6}
                  stroke="none"
                >
                  {distribution.map((s) => (
                    <Cell key={s.name} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#1b2028",
                    border: "1px solid #343b46",
                    borderRadius: 8,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <strong>{events.length}</strong>
              <span>Total events</span>
            </div>
          </div>
          <div className="distribution-list">
            {distribution.map((s) => (
              <div key={s.name}>
                <span>
                  <i style={{ background: s.color }} />
                  {s.name}
                </span>
                <strong>{s.value}</strong>
                <small>
                  {events.length
                    ? Math.round((s.value / events.length) * 100)
                    : 0}
                  %
                </small>
              </div>
            ))}
          </div>
        </section>
        <section className="surface">
          <div className="panel-title">
            <h2>Activity by camera</h2>
            <CameraIcon size={16} />
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={byCamera}
                layout="vertical"
                margin={{ left: 5, right: 25 }}
              >
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fill: "#858b96", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={130}
                  tick={{ fill: "#a8aeb8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "#222831" }}
                  contentStyle={{
                    background: "#1b2028",
                    border: "1px solid #343b46",
                    borderRadius: 8,
                  }}
                />
                <Bar
                  dataKey="value"
                  fill="#bce977"
                  radius={[0, 4, 4, 0]}
                  barSize={12}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="surface">
          <div className="panel-title">
            <h2>Camera availability</h2>
            <Radio size={16} />
          </div>
          <div className="availability-list">
            {d.cameras.map((c) => (
              <div key={c.id}>
                <span
                  className={`status-dot ${c.status === "online" && c.enabled ? "" : "gray"}`}
                />
                <span>{c.name}</span>
                <Badge
                  tone={c.status === "online" && c.enabled ? "lime" : "neutral"}
                >
                  {c.status === "online" && c.enabled ? "Enabled" : "Offline"}
                </Badge>
                {c.source === "demo" && <small>Sample</small>}
              </div>
            ))}
          </div>
          <div className="panel-footnote">
            Availability reflects the saved camera status. Live monitoring runs
            while the viewer is open.
          </div>
        </section>
      </div>
    </>
  );
}

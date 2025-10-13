/* StatisticsPage.js
   Production-ready statistics dashboard using Recharts + react-select + framer-motion.
   - Full-screen background image
   - Priority chart included and shown (gracefully handles missing backend data)
   - Month selector dynamically spans currentYear ±2 years
   - Compare mode + clear filters
   - Responsive, scrollable, accessible styling
*/

import React, { useState, useEffect } from "react";
import axios from "axios";
import Select from "react-select";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip as ReTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line
} from "recharts";
import "./StatisticsPage.css";

const API_BASE = "http://192.168.0.3:8000/api/tickets/stats";

const MONTHS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const YEARS = (() => {
  const current = new Date().getFullYear();
  const arr = [];
  for (let y = current - 2; y <= current + 2; y++) {
    arr.push({ value: y.toString(), label: y.toString() });
  }
  return arr;
})();

// Accessible palette (visible on dark BG)
const COLORS = ["#0d6efd", "#20c997", "#ffc107", "#dc3545", "#6610f2", "#17a2b8"];

export default function StatisticsPage() {
  // UI state
  const [compareMode, setCompareMode] = useState(false);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [compareYear, setCompareYear] = useState(null);
  const [compareMonth, setCompareMonth] = useState(null);

  const [stats, setStats] = useState(null);
  const [compareStats, setCompareStats] = useState(null);

  // fetch helper (if selectedMonth null -> fetch all)
  const fetchStats = async (selectedMonth, setter) => {
    try {
      const url = selectedMonth ? `${API_BASE}?month=${selectedMonth}` : API_BASE;
      const res = await axios.get(url);
      setter(res.data || {}); // defensive: set to {} when data missing
    } catch (err) {
      console.error("Statistics fetch error:", err);
      setter({}); // fall back to empty object so UI renders gracefully
    }
  };

  // initial and month change fetch (re-fetch when month changes)
  useEffect(() => {
    if (selectedYear && selectedMonth) {
      fetchStats(`${selectedYear.value}-${selectedMonth.value}`, setStats);
    } else {
      fetchStats(null, setStats);
    }
  }, [selectedYear, selectedMonth]);

  // compare fetch: triggered when compareMode & compareMonth set
  useEffect(() => {
    if (compareMode && compareYear && compareMonth) {
      fetchStats(`${compareYear.value}-${compareMonth.value}`, setCompareStats);
    } else {
      setCompareStats(null);
    }
  }, [compareMode, compareYear, compareMonth]);

  // clear filters -> show all
  const clearFilters = () => {
    setSelectedMonth(null);
    setCompareMonth(null);
    setSelectedYear(null);
    setCompareYear(null);
    setCompareMode(false);
    fetchStats(null, setStats);
  };

  // loading view
  if (stats === null) {
    return (
      <div className="statistics">
        <div className="overlay loading-screen">
          <h2>Loading statistics…</h2>
        </div>
      </div>
    );
  }

  // defensive defaults for missing fields coming from backend
  const categoryData = Array.isArray(stats.byCategory) ? stats.byCategory : [];
  const statusData = Array.isArray(stats.byStatus) ? stats.byStatus : [];
  const priorityData = Array.isArray(stats.byPriority) ? stats.byPriority : [];
  const weeklyData = Array.isArray(stats.ticketsOverTime) ? stats.ticketsOverTime : [];
  const sla = stats.slaStats || { breached: 0, onTime: 0, complianceRate: null };
  const total = stats.totalTickets || 0;

  const breached = sla.breached || 0;
  const onTime = sla.onTime || 0;
  const slaRate = sla.complianceRate ?? (total > 0 ? ((onTime / total) * 100).toFixed(1) : 0);
  const avgTicketsPerWeek = weeklyData.length ? Math.round(total / weeklyData.length) : 0;

  return (
    <div className="statistics">
      {/* overlay retains slight dark tint for readability, but fills the full viewport */}
      <div className="overlay">
        {/* Header & controls */}
        <div className="header-row">
          <div className="title-block">
            <h1 className="dashboard-title">Incident Statistics</h1>
            <p className="dashboard-subtitle">
              {compareMode && compareMonth
                ? `Comparing ${selectedMonth?.label || "All"} vs ${compareMonth?.label}`
                : selectedMonth?.label
                ? `Overview for ${selectedMonth.label}`
                : "All data overview"}
            </p>
          </div>

          <div className="controls-block">
            <div className="month-selector">
              <label className="select-label">Select Year</label>
              <Select
                options={YEARS}
                value={selectedYear}
                onChange={setSelectedYear}
                placeholder="Select Year"
                className="react-select"
                isClearable
                styles={{
                  control: (base) => ({ ...base, background: "rgba(0,0,0,0.45)", borderColor: "#333", color: "#fff" }),
                  singleValue: (base) => ({ ...base, color: "#fff" }),
                  menu: (base) => ({ ...base, background: "#0b0c10" })
                }}
              />
            </div>

            <div className="month-selector">
              <label className="select-label">Select Month</label>
              <Select
                options={MONTHS}
                value={selectedMonth}
                onChange={setSelectedMonth}
                placeholder="Select Month"
                className="react-select"
                isClearable
                styles={{
                  control: (base) => ({ ...base, background: "rgba(0,0,0,0.45)", borderColor: "#333", color: "#fff" }),
                  singleValue: (base) => ({ ...base, color: "#fff" }),
                  menu: (base) => ({ ...base, background: "#0b0c10" })
                }}
              />
            </div>

            <button
              className={`btn-compare ${compareMode ? "active" : ""}`}
              onClick={() => {
                setCompareMode((s) => {
                  if (s) {
                    setCompareMonth(null); // when disabling, clear compare month
                    setCompareYear(null);  // also clear compare year
                  }
                  return !s;
                });
              }}
            >
              {compareMode ? "Cancel Compare" : "Enable Compare"}
            </button>

            {compareMode && (
              <>
                <div className="month-selector">
                  <label className="select-label">Compare Year</label>
                  <Select
                    options={YEARS}
                    value={compareYear}
                    onChange={setCompareYear}
                    placeholder="Select Year"
                    className="react-select"
                    isClearable
                    styles={{
                      control: (base) => ({ ...base, background: "rgba(0,0,0,0.45)", borderColor: "#333", color: "#fff" }),
                      singleValue: (base) => ({ ...base, color: "#fff" }),
                      menu: (base) => ({ ...base, background: "#0b0c10" })
                    }}
                  />
                </div>
                <div className="month-selector">
                  <label className="select-label">Compare Month</label>
                  <Select
                    options={MONTHS}
                    value={compareMonth}
                    onChange={setCompareMonth}
                    placeholder="Select Month"
                    className="react-select"
                    isClearable
                    styles={{
                      control: (base) => ({ ...base, background: "rgba(0,0,0,0.45)", borderColor: "#333", color: "#fff" }),
                      singleValue: (base) => ({ ...base, color: "#fff" }),
                      menu: (base) => ({ ...base, background: "#0b0c10" })
                    }}
                  />
                </div>
              </>
            )}

            <button className="btn btn-clear" onClick={clearFilters}>
              Clear Filters
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="stats-summary">
          <motion.div className="summary-card total" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <h3>{total}</h3>
            <p>Total Tickets</p>
          </motion.div>

          <motion.div className="summary-card breaches" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <h3>{breached}</h3>
            <p>SLA Breaches</p>
          </motion.div>

          <motion.div className="summary-card compliance" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <h3>{slaRate}%</h3>
            <p>SLA Compliance</p>
          </motion.div>

          {compareMode && compareStats && (
            <motion.div className="summary-card compare" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <h3>{compareStats.totalTickets}</h3>
              <p>{compareMonth?.label} Tickets</p>
            </motion.div>
          )}
        </div>

        {/* Charts grid */}
        <div className="charts-grid">
          {/* Category Pie */}
          <motion.div className="chart-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h4>Tickets by Category</h4>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie data={categoryData} dataKey="count" nameKey="category" outerRadius={110} label>
                  {categoryData.map((entry, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <ReTooltip wrapperStyle={{ color: "#111" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>

          {/* SLA Bar */}
          <motion.div className="chart-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h4>SLA Compliance</h4>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={[
                { name: "On Time", value: onTime },
                { name: "Breached", value: breached }
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="name" />
                <YAxis />
                <ReTooltip />
                <Bar dataKey="value" fill="#20c997" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Status Bar */}
          <motion.div className="chart-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h4>Tickets by Status</h4>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="status" />
                <YAxis />
                <ReTooltip />
                <Bar dataKey="count" fill="#0d6efd" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Priority Bar (shows placeholder if backend doesn't provide) */}
          <motion.div className="chart-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h4>Tickets by Priority</h4>
            {priorityData && priorityData.length ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={priorityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="priority" />
                  <YAxis />
                  <ReTooltip />
                  <Bar dataKey="count" fill="#ffc107" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-placeholder">No priority data available for this selection.</div>
            )}
          </motion.div>

          {/* Wide: Opened vs Closed over time */}
          <motion.div className="chart-card wide" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h4>Tickets Over Time (Opened vs Closed)</h4>
            <ResponsiveContainer width="100%" height={420}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="date" />
                <YAxis />
                <ReTooltip />
                <Legend />
                <Line type="monotone" dataKey="opened" stroke="#0d6efd" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="closed" stroke="#20c997" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Compare chart */}
          {compareMode && compareStats && (
            <motion.div className="chart-card wide" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h4>Comparison — Opened Tickets</h4>
              <ResponsiveContainer width="100%" height={420}>
                <LineChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ReTooltip />
                  <Legend />
                  <Line data={weeklyData} dataKey="opened" name={selectedMonth?.label || "A"} stroke="#0d6efd" strokeWidth={2} dot={false} />
                  <Line data={compareStats.ticketsOverTime} dataKey="opened" name={compareMonth?.label || "B"} stroke="#dc3545" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>
          )}
        </div>

        {/* Analytics / Insights section */}
        <div className="analytics-section">
          <h3>📊 Quick Insights</h3>
          <div className="insights-grid">
            <div className="insight-card">
              <p className="insight-title">Avg tickets / week</p>
              <p className="insight-value">{avgTicketsPerWeek}</p>
            </div>
            <div className="insight-card">
              <p className="insight-title">SLA Compliance</p>
              <p className="insight-value">{slaRate}%</p>
            </div>
            <div className="insight-card">
              <p className="insight-title">Breaches in period</p>
              <p className="insight-value">{breached}</p>
            </div>
            <div className="insight-card">
              <p className="insight-title">Tracked categories</p>
              <p className="insight-value">{categoryData.length}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

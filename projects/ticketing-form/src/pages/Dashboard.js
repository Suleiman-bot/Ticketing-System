import React, { useEffect, useState } from "react";
import axios from "axios";
import "./Dashboard.css";

const STATUS_COLORS = {
  Open: "open",
  "In Progress": "progress",
  Resolved: "resolved",
  Closed: "closed",
};

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get("http://192.168.0.3:8000/api/tickets/stats")
      .then((res) => {
        console.log("Fetched stats:", res.data);
        setStats(res.data);
      })
      .catch((err) => console.error("Error fetching stats:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="dashboard">
        <div className="overlay">
          <p className="loading">Loading stats...</p>
        </div>
      </div>
    );

  if (!stats)
    return (
      <div className="dashboard">
        <div className="overlay">
          <p className="loading">No data available</p>
        </div>
      </div>
    );

  return (
    <div className="dashboard">
      <div className="overlay">
        <h2 className="dashboard-title">Dashboard</h2>
        <p className="dashboard-subtitle">
          Kasi Cloud Data Centers Incident Ticket Management System
        </p>

        <div className="stats-container">
          {/* Status cards */}
          {stats.byStatus?.map(({ status, count }) => (
            <div
              key={status}
              className={`stat-card ${STATUS_COLORS[status] || "pending"}`}
            >
              <h3>{count}</h3>
              <p>{status}</p>
            </div>
          ))}

          {/* Total Tickets */}
          <div className="stat-card total">
            <h3>{stats.totalTickets}</h3>
            <p>Total Tickets</p>
          </div>

          {/* SLA Breaches */}
      <div className="stat-card breaches">
        <h3>{stats.slaStats?.breached ?? 0}</h3>
        <p>SLA Breaches</p>
      </div>
      {/* SLA Compliant */}
          <div className="stat-card compliance">
      <h3>{stats.slaStats?.complianceRate ?? "0"}%</h3>
      <p>SLA Compliance</p>
    </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

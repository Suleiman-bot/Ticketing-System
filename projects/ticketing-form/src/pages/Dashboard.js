import React, { useEffect, useState } from "react";
import { PlusCircle, CardList } from "react-bootstrap-icons";
import axios from "axios";
import "./Dashboard.css";

const STATUS_COLORS = {
  Open: "open",
  "In Progress": "progress",
  Resolved: "resolved",
  Closed: "closed",
};

function Dashboard() {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get("http://192.168.0.3:8000/api/tickets/stats")
      .then(res => {
        console.log("Fetched stats:", res.data);
        setStats(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching stats:", err);
        setLoading(false);
      });
  }, []);
  console.log("Rendering stats:", stats)

  const totalTickets = Object.values(stats).reduce((sum, val) => sum + (val || 0), 0);

  return (
    <div className="dashboard">
      <div className="overlay">
      {console.log("Rendering stats:", stats)}
        <h2 className="dashboard-title">Dashboard</h2>
        <p className="dashboard-subtitle">
          Kasi Cloud Data Centers Incident Ticket Management System
        </p>

        <div className="stats-container">
          {loading ? (
            <p className="loading">Loading stats...</p>
          ) : (
            <>
              {Object.entries(stats).map(([status, count]) => (
                <div
                  key={status}
                  className={`stat-card ${STATUS_COLORS[status] || "pending"}`}
                >
                  <h3>{count}</h3>
                  <p>{status}</p>
                </div>
              ))}
              <div className="stat-card total">
                <h3>{totalTickets}</h3>
                <p>Total Tickets</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

// App.js
import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
} from "react-router-dom";

import Dashboard from "./Dashboard";
import TicketsPage from "./TicketsPage";
import CreateTicket from "./CreateTicket";
import LoginPage from "./LoginPage";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";

// === Navbar component ===
const Navbar = ({ onLogout }) => {
  const location = useLocation();
  const hideNavbarPaths = ["/"]; // hide on login page

  if (hideNavbarPaths.includes(location.pathname)) return null;

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow">
      <div className="container-fluid">
        <Link className="navbar-brand fw-bold" to="/dashboard">
          Ticketing System
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto">
            <li className="nav-item">
              <Link className="nav-link" to="/dashboard">
                Dashboard
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/ticketspage">
                Tickets
              </Link>
            </li>
            <li className="nav-item">
              <Link className="btn btn-primary text-white px-3 ms-2" to="/create-ticket">
                + Create Ticket
              </Link>
            </li>
            <li className="nav-item">
              <button
                onClick={onLogout}
                className="btn btn-danger text-white px-3 ms-2"
              >
                Logout
              </button>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

function App() {
  // === Theme handling ===
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () =>
    setTheme((prev) => (prev === "light" ? "dark" : "light"));

  // === Auth handling ===
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLogin = () => setIsAuthenticated(true);
  const handleLogout = () => setIsAuthenticated(false);

  // === ProtectedRoute wrapper ===
  const ProtectedRoute = ({ children }) => {
    return isAuthenticated ? children : <Navigate to="/" />;
  };

  return (
    <Router>
      <Navbar onLogout={handleLogout} />

      <Routes>
        {/* Public route */}
        <Route
          path="/"
          element={
            <LoginPage
              onLogin={handleLogin}
              theme={theme}
              toggleTheme={toggleTheme}
            />
          }
        />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard
                theme={theme}
                toggleTheme={toggleTheme}
                onLogout={handleLogout}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-ticket"
          element={
            <ProtectedRoute>
              <CreateTicket
                theme={theme}
                toggleTheme={toggleTheme}
                onLogout={handleLogout}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ticketspage"
          element={
            <ProtectedRoute>
              <TicketsPage
                theme={theme}
                toggleTheme={toggleTheme}
                onLogout={handleLogout}
              />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;

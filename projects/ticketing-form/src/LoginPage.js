// src/LoginPage.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Form, Button, Card, Alert } from "react-bootstrap";
import { EyeFill, EyeSlashFill } from "react-bootstrap-icons";
import "./LoginPage.css";

export default function LoginPage({ onLogin }) {   // 👈 accept prop
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();

    // 🔑 Dummy login (replace later with backend API if needed)
    if (username === "admin" && password === "password") {
      localStorage.setItem("isLoggedIn", "true"); 
      onLogin();   // 👈 set isAuthenticated=true in App.js
      navigate("/dashboard");  // 👈 go to dashboard first
    } else {
      setError("Invalid username or password");
    }
  };

  return (
    <div className="login-page">
      <Container className="d-flex justify-content-center align-items-center vh-100">
        <Card className="login-box shadow-lg" style={{ width: "400px" }}>
          <h3>Sign In</h3>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Username</Form.Label>
              <Form.Control
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formPassword">
              <Form.Label>Password</Form.Label>
              <div className="d-flex align-items-center">
                <Form.Control
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button
                  variant="outline-secondary"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowPassword(!showPassword);
                  }}
                  style={{ marginLeft: "8px" }}
                >
                  {showPassword ? <EyeSlashFill /> : <EyeFill />}
                </Button>
              </div>
            </Form.Group>

            <Button variant="primary" type="submit" className="w-100">
              Login
            </Button>
          </Form>
        </Card>
      </Container>
    </div>
  );
}

// src/CreateTicket.js
import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Card, Alert } from 'react-bootstrap';
import Select from 'react-select';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './CreateTicket.css';

// ---------- API base ----------
const API_BASE = (() => {
  const raw = process.env.REACT_APP_API_URL?.trim();
  if (raw && raw.length > 0) {
    return `${raw.replace(/\/$/, '')}/api`;
  }
  return '/api';
})();
const api = axios.create({ baseURL: API_BASE });

// ---------- constants ----------
const subCategories = {
  Network: ["Router Failure","Switch Failure","Network Latency","Packet Loss","ISP Outage","Fiber Cut","DNS Issue","Bandwidth Saturation"],
  Server: ["CPU/Memory Overload","Hardware Fault","OS Crash"],
  Storage: ["Disk Failure","RAID Degraded","Capacity Alert"],
  Power: ["Power Outage","UPS Failure","Generator Issue"],
  Cooling: ["Cooling Unit Failure","Temperature Alert"],
  Security: ["Security Breach","Access Control Failure","Surveillance Offline"],
  "Access Control": ["Badge Reader Failure","Door Lock Failure"],
  Application: ["Software Bug","Service Crash","Performance Degradation"],
  Database: ["Database Error","Connection Timeout","Data Corruption"]
};
const categoryOptions = Object.keys(subCategories).map(cat => ({ value: cat, label: cat }));
const priorityOptions = [
  { value: "P0", label: "P0 - Catastrophic" },
  { value: "P1", label: "P1 - Critical" },
  { value: "P2", label: "P2 - High" },
  { value: "P3", label: "P3 - Medium" },
  { value: "P4", label: "P4 - Low" },
];
const buildingOptions = ["LOS1","LOS2","LOS3","LOS4","LOS5"].map(b => ({ value: b, label: b }));
const detectedByOptions = [
  { value: "", label: "-- Select --" },
  { value: "Monitoring Tool", label: "Monitoring Tool" },
  { value: "Customer Report", label: "Customer Report" },
  { value: "Engineer Observation", label: "Engineer Observation" },
  { value: "Automated Alert", label: "Automated Alert" },
  { value: "Other", label: "Other" },
];

const subOptionFromValue = (val) => (val ? { value: val, label: val } : null);
const toOption = (val) => (val ? { value: val, label: String(val) } : null);

// ---------- Component ----------
export default function CreateTicket() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    category: null,
    sub_category: '',
    priority: null,
    building: '',
    location: '',
    impacted: '',
    description: '',
    detectedBy: null,
    detectedByOther: '',
    time_detected: '',
    root_cause: '',
    actions_taken: '',
  });

  const [alert, setAlert] = useState({ type: '', message: '' });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };
  const handleCategoryChange = (selected) => setForm(f => ({ ...f, category: selected, sub_category: '' }));
  const handlePriorityChange = (selected) => setForm(f => ({ ...f, priority: selected }));
  const handleBuildingChange = (selected) => setForm(f => ({ ...f, building: selected ? selected.value : '' }));
  const handleDetectedByChange = (selected) => {
    setForm(f => ({ ...f, detectedBy: selected }));
    if (!selected || selected.value !== 'Other') setForm(f => ({ ...f, detectedByOther: '' }));
  };

  const getSubCategoryOptions = () => {
    const catKey = form.category?.value;
    if (!catKey) return [];
    return (subCategories[catKey] || []).map(s => ({ value: s, label: s }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const output = {
      category: form.category?.value || '',
      sub_category: form.sub_category,
      priority: form.priority?.value || '',
      building: form.building,
      location: form.location,
      impacted: form.impacted,
      description: form.description,
      detectedBy: form.detectedBy?.value || '',
      detectedByOther: form.detectedByOther,
      time_detected: form.time_detected || '',
      root_cause: form.root_cause,
      actions_taken: form.actions_taken,
    };

    try {
      await api.post('/tickets', output, { headers: { 'Content-Type': 'application/json' } });
      setAlert({ type: 'success', message: 'Ticket created successfully!' });
      navigate('/ticketspage'); // redirect after success
    } catch (err) {
      console.error('Error submitting ticket:', err);
      const backendMessage = err.response?.data?.message || err.message || 'Unknown error';
      setAlert({ type: 'danger', message: `Failed to submit ticket: ${backendMessage}` });
    }
  };

  const textColor = '#000';
const bgColor = 'rgba(255,255,255,0.85)';  // slightly transparent
const cardBg = 'rgba(255,255,255,0.9)';
const fieldBg = '#fff';
const borderColor = '#ccc';

  return (
    <Container fluid className="ticket-page p-0">
  <div className="overlay">

        {/* Logo */}
        <div className="text-center mb-4">
          <img src="/KasiLogo.jpeg" alt="Company Logo" style={{ maxWidth: 200 }} />
        </div>

        {/* Page Title */}
        <h2 className="text-center mb-4" style={{ color: textColor }}>
          Kasi Cloud Data Center Incident Ticket
        </h2>

        {/* Alert Section */}
        {alert.message && (
          <Alert
            variant={alert.type}
            onClose={() => setAlert({ type: '', message: '' })}
            dismissible
            className="mt-3"
          >
            {alert.message}
          </Alert>
        )}

        {/* Ticket Form */}
        <Form onSubmit={handleSubmit}>
          <Card className="p-3 ticket-card">
            {/* Square 1 */}
            <Card className="p-3 mb-3 ticket-card-inner">
              <Row>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label style={{ color: textColor }}>Category</Form.Label>
                    <Select classNamePrefix="rs" options={categoryOptions} value={form.category} onChange={handleCategoryChange} placeholder="-- Select Category --" isClearable />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label style={{ color: textColor }}>Sub-category</Form.Label>
                    <Select classNamePrefix="rs" options={getSubCategoryOptions()} value={subOptionFromValue(form.sub_category)} onChange={(s) => setForm(f => ({ ...f, sub_category: s ? s.value : '' }))} placeholder="-- Select Sub-category --" isClearable isDisabled={!form.category} />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label style={{ color: textColor }}>Priority Level</Form.Label>
                    <Select classNamePrefix="rs" options={priorityOptions} value={form.priority} onChange={handlePriorityChange} placeholder="-- Select Priority --" isClearable />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label style={{ color: textColor }}>Building</Form.Label>
                    <Select classNamePrefix="rs" options={buildingOptions} value={form.building ? { value: form.building, label: form.building } : null} onChange={handleBuildingChange} placeholder="-- Select Building --" isClearable />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label style={{ color: textColor }}>Affected Area</Form.Label>
                    <Form.Control type="text" name="location" value={form.location} onChange={handleChange} className="transparent-input" />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label style={{ color: textColor }}>Impacted Systems</Form.Label>
                    <Form.Control type="text" name="impacted" value={form.impacted} onChange={handleChange} className="transparent-input" />
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group>
                <Form.Label style={{ color: textColor }}>Incident Description</Form.Label>
                <Form.Control as="textarea" rows={5} name="description" value={form.description} onChange={handleChange} className="transparent-input" />
              </Form.Group>
            </Card>

            {/* Square 2 */}
            <Card className="p-3 ticket-card">
              <Row>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label style={{ color: textColor }}>Detected By</Form.Label>
                    <Select classNamePrefix="rs" options={detectedByOptions} value={form.detectedBy} onChange={handleDetectedByChange} placeholder="-- Select --" isClearable />
                  </Form.Group>
                  {form.detectedBy?.value === 'Other' && (
                    <Form.Group className="mt-2">
                      <Form.Label style={{ color: textColor }}>Please specify</Form.Label>
                      <Form.Control type="text" name="detectedByOther" value={form.detectedByOther} onChange={handleChange} placeholder="Enter custom detection source" className="transparent-input" />
                    </Form.Group>
                  )}
                </Col>

                <Col md={6}>
                  <Form.Group>
                    <Form.Label style={{ color: textColor }}>Time Detected</Form.Label>
                    <Form.Control type="datetime-local" name="time_detected" value={form.time_detected} onChange={handleChange} className="transparent-input" />
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mt-3">
                <Form.Label style={{ color: textColor }}>Root Cause</Form.Label>
                <Form.Control type="text" name="root_cause" value={form.root_cause} onChange={handleChange} className="transparent-input" />
              </Form.Group>

              <Form.Group className="mt-3">
                <Form.Label style={{ color: textColor }}>Action Taken</Form.Label>
                <Form.Control as="textarea" rows={3} name="actions_taken" value={form.actions_taken} onChange={handleChange} className="transparent-input" />
              </Form.Group>
            </Card>

            <div className="d-grid gap-2 mt-4">
              <Button type="submit" variant="primary" size="lg">Create Ticket</Button>
            </div>
          </Card>
        </Form>
      </div>
    </Container>
  );
}

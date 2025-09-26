// src/TicketsPage.js
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Menu,
  MenuItem,
  Modal,
  Typography,
  TextField,
  Select,
  InputLabel,
  FormControl,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { CSVLink } from "react-csv";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
// import the logo with space in filename as requested
import LOGO from "./LOGO.png";
import { Stack, FormControlLabel, Switch } from "@mui/material";
import { DarkMode, LightMode } from "@mui/icons-material";
import ReactSelect from "react-select";
import { Form, Button as RBButton, Card, Row, Col, Alert } from "react-bootstrap";
import SortIcon from "@mui/icons-material/Sort";   // add this at the top
import Tooltip from "@mui/material/Tooltip";
import DateRangeIcon from "@mui/icons-material/DateRange"; // calendar-like icon
import "./TicketsPage.css";


// ---------- constants (copied from App.js) ----------
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
const isoToLocalDatetime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const pad = (n) => String(n).padStart(2, '0');

  // Shift to local time properly
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);

  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`;
};


// -------------------- ADD THIS --------------------
// Utility: format server date strings consistently as "YYYY-MM-DD HH:mm"
// - If server sends an ISO (contains 'T') we extract the date + hour:minute
//   without doing any timezone conversions (this preserves the exact values
//   the backend sent and avoids 1-hour shifts caused by Date() TZ conversions).
// - If server sends a space-separated datetime (e.g. "2025-09-02 10:17:50.107")
//   we extract date + hour:minute.
// - Fallback: attempt to format via Date object (local) as a last resort.
// For human-readable display (table, view more, etc.)
// For human-readable display (table, view more, etc.)
const formatServerDate = (s) => {
  if (!s) return "";
  const pad = (n) => String(n).padStart(2, "0");

  // Case 1: already has "Z" or +hh:mm → backend gave UTC-aware string
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d)) {
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }

  // Case 2: space-separated or plain ISO → just slice out yyyy-mm-dd hh:mm
  const isoMatch = String(s).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/);
  if (isoMatch) return `${isoMatch[1]} ${isoMatch[2]}:${isoMatch[3]}`;

  // Fallback
  const d = new Date(s);
  if (!isNaN(d)) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  return s;
};
// -------------------- END ADD --------------------


const assignedEngineerOptions = [
  { value: "Suleiman Abdulsalam", label: "Suleiman Abdulsalam" },
  { value: "Jesse Etuk", label: "Jesse Etuk" },
  { value: "Opeyemi Akintelure", label: "Opeyemi Akintelure" },
  { value: "Gbenga Mabadeje", label: "Gbenga Mabadeje" },
  { value: "Eloka Igbokwe", label: "Eloka Igbokwe" },
  { value: "Ifeoma Ndudim", label: "Ifeoma Ndudim" },
];


//TIcketsPage Components
const TicketsPage = () => { 
  // state, hooks, etc...
  const navigate = useNavigate();
  const handleLogout = () => {
  localStorage.removeItem("isLoggedIn"); // clear session
  navigate("/"); // back to login
};
  useEffect(() => {
    const isLoggedIn = localStorage.getItem("isLoggedIn");
    if (!isLoggedIn) {
      navigate("/");  // redirect to login if not logged in
    }
  }, [navigate]);

// After (fixed colors, light theme)
const textColor = "#000";
const cardBg = "#fff";
const fieldBg = "#fff";
const borderColor = "#ccc";

// alert state
const [alert, setAlert] = useState({ type: "", message: "" });
const [sortOrder, setSortOrder] = useState("asc"); // "asc" | "desc"
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState({
    ticketId: "",
    building: "",
    priority: "",
    status: "",
    dateRange: [null, null],
  });
  const [dateAnchor, setDateAnchor] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  // 🔹 PATCH 1: Store full ticket objects separately for modal
const [allTickets, setAllTickets] = useState([]); 

  const [modalType, setModalType] = useState(""); // "view" | "assign" | "updateStatus" | "edit" | "resolve"

  const open = Boolean(anchorEl);

  useEffect(() => {
    fetchTickets();
  }, []);

const fetchTickets = async () => {
  try {
    const res = await axios.get("http://192.168.0.3:8000/api/tickets");
    console.log("Fetched tickets: ", res.data);

    // 🔹 PATCH 2: Store full objects for modal
    setAllTickets(res.data);

    // 🔹 PATCH 3: Normalize subset for table
    const normalized = res.data.map((t) => ({
      ticketId: t.ticket_id,
      ticket_id: t.ticket_id, // add this so we can always reference the backend object
      category: t.category,
      subCategory: t.sub_category,
      priority: t.priority,
      status: t.status,
      building: (t.building || "").trim(),   // <-- important: include building
      dateOpened: t.opened,
      dateClosed: t.closed,
    }));

    setTickets(normalized);
  } catch (err) {
    console.error("Error fetching tickets:", err);
  }
};


// 🔹 Edit form state
const [form, setForm] = useState({
  category: "",
  sub_category: "",
  priority: "",
  building: "",
  location: "",
  impacted: "",
  description: "",
  detectedBy: null,
  detectedByOther: "",
  time_detected: "",
  root_cause: "",
  actions_taken: "",
  // 🔹 Resolve modal fields (default safe values)
  resolution_summary: "",
  resolution_time: "",
  sla_breach: "No",     // default = No
  post_review: "No",    // default = No
});

// 🔹 Generic text change handler
const handleChange = (e) => {
  const { name, value } = e.target;
  setForm((prev) => ({ ...prev, [name]: value }));
};

// 🔹 Category handler
const handleCategoryChange = (option) => {
  setForm((prev) => ({ ...prev, category: option ? option.value : "", sub_category: "" }));
};

  // 🔹 Subcategory helper (same as App.js)
// 🔹 Fix: Subcategory helper (string-based)
const getSubCategoryOptions = () => {
  if (!form.category) return [];
  return (subCategories[form.category] || []).map((s) => ({
    value: s,
    label: s,
  }));
};


// 🔹 Priority handler
const handlePriorityChange = (option) => {
  setForm((prev) => ({ ...prev, priority: option ? option.value : "" }));
};

// 🔹 Building handler
const handleBuildingChange = (option) => {
  setForm((prev) => ({ ...prev, building: option ? option.value : "" }));
};

// 🔹 DetectedBy handler
const handleDetectedByChange = (option) => {
  setForm((prev) => ({ ...prev, detectedBy: option }));
};

  const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    // Prepare output for backend
    const output = {
      ...form,
      detectedBy: form.detectedBy ? form.detectedBy.value : "",
      time_detected: form.time_detected ? new Date(form.time_detected).toISOString() : "",
    };

    await axios.put(`http://192.168.0.3:8000/api/tickets/${selectedTicket.ticket_id}`, output);

    // Update frontend state
    setAllTickets((prev) =>
      prev.map((t) =>
        t.ticket_id === selectedTicket.ticket_id ? { ...t, ...output } : t
      )
    );

    setTickets((prev) =>
      prev.map((t) =>
        t.ticketId === selectedTicket.ticket_id
          ? {
              ...t,
              category: output.category,
              subCategory: output.sub_category,
              priority: output.priority,
            }
          : t
      )
    );

    setModalType(""); // Close modal
    setSelectedTicket(null);
  } catch (err) {
    console.error("Error updating ticket:", err);
    alert("Failed to update ticket. Please try again.");
  }
};


  //DOWNLOAD PDF CONSTANT
// ===============================
// PATCH: Handle both camelCase (frontend) and snake_case (backend)
// for ticket IDs so the function never fails.
// ===============================
const handleDownloadPDF = async (ticket) => {
  if (!ticket) {
    window.alert("Ticket not found.");
    return;
  }

  // Handle both camelCase and snake_case
  const ticketId = ticket.ticketId || ticket.ticket_id;

  if (!ticketId) {
    window.alert("Ticket not found.");
    return;
  }

  try {
const res = await axios.get(
  `http://192.168.0.3:8000/api/tickets/${ticketId}/download`, //Download PDF path
  { responseType: "blob" }
);

    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${ticketId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (err) {
    console.error("PDF download error:", err);
    window.alert("Failed to download PDF. Please try again.");
  }
};

  

  const handleActionClick = (event, ticket) => {
    setAnchorEl(event.currentTarget);
    // 🔹 PATCH 4: Find full ticket object by ticketId
const fullTicket = allTickets.find(t => t.ticket_id === ticket.ticketId);
setSelectedTicket(fullTicket);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };
//HandleOpenModal
const handleOpenModal = (type) => {
  setModalType(type);
  handleCloseMenu();
//HandleOpenModal Edit
  if (type === "edit" && selectedTicket) {
    setForm({
      category: selectedTicket.category || "",
      sub_category: selectedTicket.sub_category || "",
      priority: selectedTicket.priority || "",
      building: selectedTicket.building || "",
      location: selectedTicket.location || "",
      impacted: selectedTicket.impacted || "",
      description: selectedTicket.description || "",
      detectedBy: selectedTicket.detectedBy 
        ? { value: selectedTicket.detectedBy, label: selectedTicket.detectedBy }
        : null,
      detectedByOther: selectedTicket.detectedByOther || "",
      time_detected: isoToLocalDatetime(selectedTicket.time_detected) || "",
      root_cause: selectedTicket.root_cause || "",
      actions_taken: selectedTicket.actions_taken || "",
    });
  }
   //HandleOpenModal ResolveTicket
  if (type === "resolve" && selectedTicket) {
  setForm({
    ...selectedTicket,
    resolution_summary: selectedTicket.resolution_summary || "",
    resolution_time: isoToLocalDatetime(selectedTicket.resolution_time) || "",
    // normalize SLA + Review to "Yes"/"No"
    sla_breach: selectedTicket.sla_breach || "No",
    post_review: selectedTicket.post_review || "No",
  });
}

};
   //DURATION TIME CALCULATOR
const parseDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return val;

  if (typeof val === "string") {
    // ISO string with Z or offset
    if (val.includes("T")) return new Date(val);

    // Space separated (without seconds)
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(val)) {
      return new Date(val.replace(" ", "T") + ":00");
    }

    // Space separated (with seconds)
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(val)) {
      return new Date(val.replace(" ", "T"));
    }
  }

  return null;
};

const calculateDuration = (opened, closed) => {
  const start = parseDate(opened);
  const end = parseDate(closed);
  if (!start || !end || isNaN(start) || isNaN(end)) return "";

  let diff = Math.floor((end - start) / 1000); // in seconds
  if (diff < 0) return "";

  const days = Math.floor(diff / 86400);
  diff %= 86400;
  const hours = Math.floor(diff / 3600);
  diff %= 3600;
  const mins = Math.floor(diff / 60);

  let result = [];
  if (days > 0) result.push(`${days} day${days > 1 ? "s" : ""}`);
  if (hours > 0) result.push(`${hours} hr${hours > 1 ? "s" : ""}`);
  if (mins > 0) result.push(`${mins} min${mins > 1 ? "s" : ""}`);

  return result.length ? result.join(" ") : "0 mins";
};


  const handleFilterChange = (field, value) => {
    setFilter((prev) => ({ ...prev, [field]: value }));
  };

  //Filter ticket constant
const filteredTickets = useMemo(() => {
  return tickets.filter((t) => {
    return (
      (!filter.ticketId || t.ticketId.includes(filter.ticketId)) &&
      (!filter.building ||
        (t.building || "").trim().toLowerCase() === filter.building.trim().toLowerCase()) &&
      (!filter.priority || t.priority === filter.priority) &&
      (!filter.status || t.status === filter.status) &&
      (!filter.dateRange[0] ||
        (new Date(t.dateOpened) >= filter.dateRange[0] &&
          new Date(t.dateOpened) <= filter.dateRange[1]))
    );
  });
}, [tickets, filter]);

const handleSortDate = () => {
  setTickets((prev) =>
    [...prev].sort((a, b) => {
      const dateA = new Date(a.dateOpened);
      const dateB = new Date(b.dateOpened);

      return sortOrder === "asc"
        ? dateA - dateB
        : dateB - dateA;
    })
  );

  // flip sort order for next click
  setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
};


  const handleCreateTicket = () => {
    navigate("/frontend");
  };

  const modalBody = () => {
    
    if (!selectedTicket) return null;

    switch (modalType) {

// ===============================
// CASE: VIEW MORE MODAL
// =============================== 
case "view": // View More
  return (
<Box
  sx={{
    p: 4,
    bgcolor: cardBg,             // adaptive card background
    color: textColor,            // adaptive text
    border: `1px solid ${borderColor}`, // adaptive border
    borderRadius: 2,             // keep rounded corners
  }}
>
      <Typography variant="h6" gutterBottom>
        Ticket Details
      </Typography>

      {selectedTicket && (
        <div style={{ display: "grid", rowGap: 8 }}>
          {selectedTicket.ticket_id && (
            <div><strong>Ticket ID:</strong> {selectedTicket.ticket_id}</div>
          )}
          {selectedTicket.category && (
            <div><strong>Category:</strong> {selectedTicket.category}</div>
          )}
          {selectedTicket.sub_category && (
            <div><strong>Sub Category:</strong> {selectedTicket.sub_category}</div>
          )}
          {selectedTicket.priority && (
            <div><strong>Priority:</strong> {selectedTicket.priority}</div>
          )}
          {selectedTicket.status && (
            <div><strong>Status:</strong> {selectedTicket.status}</div>
          )}
          {selectedTicket.opened && (
          <div><strong>Date Opened:</strong> {formatServerDate(selectedTicket.opened)}</div>
          )}
          {selectedTicket.closed && selectedTicket.closed !== "-" && (
          <div><strong>Date Closed:</strong> {formatServerDate(selectedTicket.closed)}</div>
          )}
          {selectedTicket.building && (
            <div><strong>Building:</strong> {selectedTicket.building}</div>
          )}
          {selectedTicket.location && (
            <div><strong>Location:</strong> {selectedTicket.location}</div>
          )}
          {selectedTicket.impacted && (
            <div><strong>Impacted Systems/Services:</strong> {selectedTicket.impacted}</div>
          )}
          {selectedTicket.description && (
            <div><strong>Description:</strong> {selectedTicket.description}</div>
          )}
          {selectedTicket.detectedBy && (
            <div><strong>Detected By:</strong> {selectedTicket.detectedBy}</div>
          )}
          {selectedTicket.time_detected && (
          <div><strong>Time Detected:</strong> {formatServerDate(selectedTicket.time_detected)}</div>
          )}
          {selectedTicket.root_cause && (
            <div><strong>Root Cause:</strong> {selectedTicket.root_cause}</div>
          )}
          {selectedTicket.actions_taken && (
            <div><strong>Actions Taken:</strong> {selectedTicket.actions_taken}</div>
          )}
          {selectedTicket.assigned_to && (
            <div><strong>Assigned To:</strong> {selectedTicket.assigned_to}</div>
          )}
          {selectedTicket.resolution_summary && (
            <div><strong>Resolution Summary:</strong> {selectedTicket.resolution_summary}</div>
          )}
          {selectedTicket.resolution_time && (
            <div><strong>Resolution Time:</strong> {formatServerDate(selectedTicket.resolution_time)}</div>
          )}

          {selectedTicket.status === "Closed" && selectedTicket.duration && (
          <div><strong>Duration:</strong> {selectedTicket.duration}</div>
          )}

         {/* SLA Breach & Post Review if ticket Resolved or Closed */}
        {(selectedTicket.status === "Resolved" || selectedTicket.status === "Closed") &&
          selectedTicket.sla_breach && (
            <div><strong>SLA Breach:</strong> {selectedTicket.sla_breach}</div>
        )}
        
        {(selectedTicket.status === "Resolved" || selectedTicket.status === "Closed") &&
          selectedTicket.post_review && (
            <div><strong>Post Review:</strong> {selectedTicket.post_review}</div>
        )}
        </div>
      )}

        {/* 🔹 Filled Close button */}
      <Button
        variant="contained"
        color="primary"
        onClick={() => setModalType("")}
        sx={{ mt: 2 }}
      >
        Close
      </Button>
    </Box>
  );

// ===============================
// CASE: ASSIGNED ENGINEER MODAL
// =============================== 
case "assign":  //Assigned Engineers
  return (
   <Box
  sx={{
    p: 4,
    bgcolor: cardBg,             // adaptive card background
    color: textColor,            // adaptive text
    border: `1px solid ${borderColor}`, // adaptive border
    borderRadius: 2,             // keep rounded corners
  }}
>
      <Typography variant="h6" gutterBottom>
        Assign Engineers
      </Typography>

      <ReactSelect
        isMulti
        options={assignedEngineerOptions}
        placeholder="Select engineers..."
        value={(selectedTicket.assigned_to || "")
          .split(",")
          .filter(name => name.trim() !== "")
          .map(name => ({ value: name, label: name }))}
        onChange={(selected) => {
          const engineers = selected.map(opt => opt.value).join(", ");
          setSelectedTicket(prev => ({ ...prev, assigned_to: engineers }));
        }}
      />

      <Box sx={{ mt: 3, display: "flex", gap: 2 }}>
        <Button
          variant="contained"
          onClick={async () => {
            try {
              // 1. Update backend (tickets.csv)
              await fetch(
                `http://192.168.0.3:8000/api/tickets/${selectedTicket.ticket_id}`,
                {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    assigned_to: selectedTicket.assigned_to,
                  }),
                }
              );

              // 2. Update frontend state
              setAllTickets(prev =>
                prev.map(ticket =>
                  ticket.ticket_id === selectedTicket.ticket_id
                    ? { ...ticket, assigned_to: selectedTicket.assigned_to }
                    : ticket
                )
              );

              setModalType(""); // close modal
            } catch (err) {
              console.error("Error assigning engineers:", err);
              alert("Failed to update ticket. Please try again.");
            }
          }}
        >
          Save
        </Button>
        <Button variant="outlined" onClick={() => setModalType("")}>
          Cancel
        </Button>
      </Box>
    </Box>
  );

// ===============================
// CASE: UPDATE STATUS MODAL
// =============================== 
      case "updateStatus":   //Update Status
        return (
          <Box
  sx={{
    p: 4,
    bgcolor: cardBg,             // adaptive card background
    color: textColor,            // adaptive text
    border: `1px solid ${borderColor}`, // adaptive border
    borderRadius: 2,             // keep rounded corners
  }}
>
            <Typography variant="h6">Update Status</Typography>
            <FormControl fullWidth>
              <Select
                value={selectedTicket.status || "Open"}
                onChange={(e) =>
                  setSelectedTicket({ ...selectedTicket, status: e.target.value })
                }
              >
                <MenuItem value="Open">Open</MenuItem>
                <MenuItem value="In Progress">In Progress</MenuItem>
                <MenuItem value="Resolved">Resolved</MenuItem>
                <MenuItem value="Closed">Closed</MenuItem>
              </Select>
            </FormControl>
                 {/* ===== Action Button ===== */}
      <Button
        variant="contained"
        color="primary"
        sx={{ mt: 2 }}
        onClick={async () => {
          try {
            // 🔹 Start with full ticket so SLA, Post Review, etc. aren’t lost
            const payload = { ...selectedTicket };
            // Always update status
            payload.status = selectedTicket.status;
      
            if (selectedTicket.status === "Closed") {
              // --- Handle closed date ---
              const now = new Date();
              const pad = (n) => String(n).padStart(2, "0");
              payload.closed = `${now.getFullYear()}-${pad(
                now.getMonth() + 1
              )}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(
                now.getMinutes()
              )}`;
      
              // --- Calculate duration (opened -> closed) ---
              if (selectedTicket.opened) {
                payload.duration = calculateDuration(
                  selectedTicket.opened,
                  payload.closed
                );
              } else {
                payload.duration = "";
              }
            } else {
              // --- Not closed: reset closed ---
              payload.closed = null;
      
              if (selectedTicket.status === "Open" || selectedTicket.status === "In Progress") {
                // Clear everything related to resolution + SLA + Post Review
                payload.resolution_summary = "";
                payload.resolution_time = "";
                payload.duration = "";
                payload.sla_breach = "";
                payload.post_review = "";
              }
      
              if (selectedTicket.status === "Resolved") {
                // Only clear duration when "Resolved"
                payload.duration = "";
              }
            }
      
            // 🔹 Send update to backend
            await fetch(
              `http://192.168.0.3:8000/api/tickets/${selectedTicket.ticket_id}`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              }
            );

      // 🔹 Update full tickets list (allTickets) so modal/other views read updated data
      setAllTickets((prev) =>
        prev.map((ticket) =>
          ticket.ticket_id === selectedTicket.ticket_id ? { ...ticket, ...payload } : ticket
        )
      );

      // 🔹 Update normalized table rows so table reflects the closed date *immediately*
      // We store raw payload.closed in the normalized `dateClosed` field; the table cell
      // uses formatServerDate(...) so it will render in "YYYY-MM-DD HH:mm".
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.ticketId === selectedTicket.ticket_id
            ? { ...ticket, status: payload.status, dateClosed: payload.closed }
            : ticket
        )
      );

      // 🔹 Update the modal selectedTicket so the modal reflects changes instantly
      setSelectedTicket((prev) => ({ ...prev, ...payload }));

      // Close modal
      setModalType("");
    } catch (err) {
      console.error("Error updating status:", err);
      window.alert("Failed to update status. Please try again.");
    }
  }}
>
  Update
</Button>

 </Box>
    );

// ===============================
// CASE: EDIT MODAL
// =============================== 
case "edit": // EDIT BUTTON
  return (
   <Box
  sx={{
    p: 4,
    bgcolor: cardBg,             // adaptive card background
    color: textColor,            // adaptive text
    border: `1px solid ${borderColor}`, // adaptive border
    borderRadius: 2,             // keep rounded corners
  }}
>
      <Typography variant="h6" gutterBottom>
        Edit Ticket
      </Typography>

      {/* ====== Success / Error Alert Section ====== */}
      {alert.message && (
        <Alert
          variant={alert.type}
          onClose={() => setAlert({ type: "", message: "" })}
          dismissible
          className="mt-3"
        >
          {alert.message}
        </Alert>
      )}

      <Form onSubmit={handleSubmit}>
        <Card
          className="p-3"
          style={{
            border: `2px solid ${borderColor}`,
            backgroundColor: cardBg,
          }}
        >
          {/* ===== Square 1 ===== */}
          <Card
            className="p-3 mb-3"
            style={{
              backgroundColor: cardBg,
              border: `1px solid ${borderColor}`,
            }}
          >
            <Row>
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ color: textColor }}>
                    Category
                  </Form.Label>
                  <ReactSelect
                    classNamePrefix="rs"
                    options={categoryOptions}
                    value={
                      form.category
                        ? { value: form.category, label: form.category }
                        : null
                    }
                    onChange={handleCategoryChange}
                    placeholder="-- Select Category --"
                    isClearable
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ color: textColor }}>
                    Sub-category
                  </Form.Label>
                  <ReactSelect
                    classNamePrefix="rs"
                    options={getSubCategoryOptions()}
                    value={subOptionFromValue(form.sub_category)}
                    onChange={(s) =>
                      setForm((f) => ({
                        ...f,
                        sub_category: s ? s.value : "",
                      }))
                    }
                    placeholder="-- Select Sub-category --"
                    isClearable
                    isDisabled={!form.category}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ color: textColor }}>
                    Priority Level
                  </Form.Label>
                  <ReactSelect
                    classNamePrefix="rs"
                    options={priorityOptions}
                    value={
                      form.priority
                        ? { value: form.priority, label: form.priority }
                        : null
                    }
                    onChange={handlePriorityChange}
                    placeholder="-- Select Priority --"
                    isClearable
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ color: textColor }}>
                    Building
                  </Form.Label>
                  <ReactSelect
                    classNamePrefix="rs"
                    options={buildingOptions}
                    value={
                      form.building
                        ? { value: form.building, label: form.building }
                        : null
                    }
                    onChange={handleBuildingChange}
                    placeholder="-- Select Building --"
                    isClearable
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ color: textColor }}>
                    Affected Area
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="location"
                    value={form.location}
                    onChange={handleChange}
                    style={{ color: textColor, backgroundColor: fieldBg }}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ color: textColor }}>
                    Impacted Systems
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="impacted"
                    value={form.impacted}
                    onChange={handleChange}
                    style={{ color: textColor, backgroundColor: fieldBg }}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group>
              <Form.Label style={{ color: textColor }}>
                Incident Description
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={5}
                name="description"
                value={form.description}
                onChange={handleChange}
                style={{ color: textColor, backgroundColor: fieldBg }}
              />
            </Form.Group>
          </Card>

          {/* ===== Square 2 ===== */}
          <Card
            className="p-3"
            style={{
              border: `2px solid ${borderColor}`,
              backgroundColor: cardBg,
            }}
          >
            <Row>
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ color: textColor }}>
                    Detected By
                  </Form.Label>
                  <ReactSelect
                    classNamePrefix="rs"
                    options={detectedByOptions}
                    value={form.detectedBy}
                    onChange={handleDetectedByChange}
                    placeholder="-- Select --"
                    isClearable
                  />
                </Form.Group>
                {form.detectedBy?.value === "Other" && (
                  <Form.Group className="mt-2">
                    <Form.Label style={{ color: textColor }}>
                      Please specify
                    </Form.Label>
                    <Form.Control
                      type="text"
                      name="detectedByOther"
                      value={form.detectedByOther}
                      onChange={handleChange}
                      placeholder="Enter custom detection source"
                      style={{ color: textColor, backgroundColor: fieldBg }}
                    />
                  </Form.Group>
                )}
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ color: textColor }}>
                    Time Detected
                  </Form.Label>
                  <Form.Control
                    type="datetime-local"
                    name="time_detected"
                    value={form.time_detected}
                    onChange={handleChange}
                    style={{ color: textColor, backgroundColor: fieldBg }}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mt-3">
              <Form.Label style={{ color: textColor }}>Root Cause</Form.Label>
              <Form.Control
                type="text"
                name="root_cause"
                value={form.root_cause}
                onChange={handleChange}
                style={{ color: textColor, backgroundColor: fieldBg }}
              />
            </Form.Group>

            <Form.Group className="mt-3">
              <Form.Label style={{ color: textColor }}>Action Taken</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="actions_taken"
                value={form.actions_taken}
                onChange={handleChange}
                style={{ color: textColor, backgroundColor: fieldBg }}
              />
            </Form.Group>
          </Card>

          {/* ===== Buttons ===== */}
          <div className="d-flex justify-content-end gap-2 mt-4">
            <RBButton
              type="submit"
              variant="primary"
              size="lg"
            >
              Save Changes
            </RBButton>
            <RBButton
              variant="secondary"
              size="lg"
              onClick={() => {
                setModalType("");
                setSelectedTicket(null);
              }}
            >
              Cancel
            </RBButton>
          </div>
        </Card>
      </Form>
    </Box>
  );


// ===============================
// CASE: RESOLVE TICKET MODAL
// ===============================
case "resolve":
  return (
<Box
  sx={{
    p: 4,
    bgcolor: cardBg,             // adaptive card background
    color: textColor,            // adaptive text
    border: `1px solid ${borderColor}`, // adaptive border
    borderRadius: 2,             // keep rounded corners
  }}
>
      {/* ===== Modal Title ===== */}
      <Typography variant="h6" gutterBottom>
        Resolve Ticket
      </Typography>

      <Form>
        {/* Resolution Summary */}
        <Form.Group className="mb-3">
          <Form.Label>Resolution Summary</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            value={form.resolution_summary || ""}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                resolution_summary: e.target.value,
              }))
            }
            placeholder="Enter resolution details"
          />
        </Form.Group>

        {/* Resolution Time */}
        <Form.Group className="mb-3">
          <Form.Label>Resolution Time</Form.Label>
          <Form.Control
            type="datetime-local"
            value={form.resolution_time || ""}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                resolution_time: e.target.value,
              }))
            }
          />
        </Form.Group>

        {/* SLA Breach */}
        <Form.Group className="mb-3">
          <Form.Check
            type="checkbox"
            label="SLA Breach"
            checked={form.sla_breach === "Yes"}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                sla_breach: e.target.checked ? "Yes" : "No",
              }))
            }
          />
        </Form.Group>

        {/* Post Incident Review */}
        <Form.Group className="mb-3">
          <Form.Check
            type="checkbox"
            label="Post Incident Review"
            checked={form.post_review === "Yes"}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                post_review: e.target.checked ? "Yes" : "No",
              }))
            }
          />
        </Form.Group>

        {/* ===== Action Buttons ===== */}
        <div className="d-flex justify-content-end gap-2 mt-4">
          <RBButton
            variant="secondary"
            size="lg"
            onClick={() => setModalType("")}
          >
            Close
          </RBButton>

          <RBButton
            variant="success"
            size="lg"
            onClick={async () => {
              try {
                const output = {
                  ...selectedTicket,   // ✅ preserve all fields
                  ...form,             // ✅ overwrite with resolve fields
                  status: "Resolved",  // ✅ enforce resolved
                  resolution_time: form.resolution_time
                ? (() => {
                const d = new Date(form.resolution_time);
                const pad = (n) => String(n).padStart(2, "0");
                return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
              })()
              : "",
                duration: "" // ensure resolved clears duration per your requirement
                };

                await axios.put(
                  `http://192.168.0.3:8000/api/tickets/${selectedTicket.ticket_id}`,
                  output
                );

                // 🔹 Update full list
                setAllTickets((prev) =>
                  prev.map((t) =>
                    t.ticket_id === selectedTicket.ticket_id
                      ? { ...t, ...output }
                      : t
                  )
                );

                // 🔹 Update normalized table
                setTickets((prev) =>
                  prev.map((t) =>
                    t.ticketId === selectedTicket.ticket_id
                      ? { ...t, status: "Resolved" }
                      : t
                  )
                );

                setModalType("");
                setSelectedTicket(null);
              } catch (err) {
                console.error("Error resolving ticket:", err);
                alert("Failed to resolve ticket. Please try again.");
              }
            }}
          >
            Resolve Ticket
          </RBButton>
        </div>
      </Form>
    </Box>
  );
    default:
      return null;
  }
};
 
//TITLE LOGO THEMES
return (
  <div className="tickets-page">   {/* <-- ADD THIS DIV HERE */}
    <Box sx={{ p: 2 }}>
      {/* 🔹 Title + Logo + Theme Switch */}
    <Stack
      direction={{ xs: "column", sm: "row" }}
      alignItems="center"
      spacing={2}
      justifyContent="space-between"
      sx={{ mb: 2 }}
    >
      <Stack direction="row" spacing={2} alignItems="center">
        <img
         src={LOGO}
          alt="Kasi"
          style={{
            height: "80px",
            width: "auto",
            maxWidth: "100%",
            objectFit: "contain",
            opacity: 1, // 0 = fully transparent, 1 = fully opaque
          }}
        />
        <Box>
         <Typography 
  variant="h6" 
  sx={{ 
    fontWeight: "bold",       // makes it bold
    fontSize: "1.5rem",       // optional: larger font
    color: textColor,         // dynamic theme color
    letterSpacing: "0.5px",   // optional: nicer spacing
  }}
>
  Kasi Cloud Data Centers
</Typography>

<Typography 
  variant="h6" 
  sx={{ 
    fontWeight: 600,          // semi-bold
    fontSize: "1.2rem",       // slightly smaller than main title
    color: textColor, 
    letterSpacing: "0.5px",
  }}
>
  Incident Tickets
</Typography>

        </Box>
      </Stack>

    </Stack>
{/* ============================
   FILTER BAR SECTION
   ============================
   This <Box> contains all filter controls
   (search, building, priority, status, date, sorting).
   It uses flexbox with wrapping + gap for responsive layout.
*/}
{/* 🔹 Filter + Action Bar */}
<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", mb: 2 }}>
 {/* 🔹 Left: Filters */}
<Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>

  {/* 🔹 Search by Ticket ID */}
  <TextField
    label="Search Ticket ID"                 // Input label shown above field
    value={filter.ticketId}                  // Controlled input bound to filter state
    onChange={(e) => handleFilterChange("ticketId", e.target.value)}
    size="small"                             // Makes input compact
  sx={{
    minWidth: 180,
    "& .MuiOutlinedInput-root": {
      "& fieldset": { borderColor: borderColor },  // border adapts
      "&:hover fieldset": { borderColor: borderColor },
    },
    "& .MuiInputLabel-root": { color: textColor }, // label adapts
    input: { color: textColor },                  // text adapts
  }}
/>

  {/* 🔹 Filter by Building */}
<FormControl
  size="small"
  sx={{
    minWidth: 140,
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: borderColor,    // adaptive border
    },
    "&:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: borderColor,
    },
    "& .MuiInputLabel-root": { color: textColor }, // label adapts
    "& .MuiSelect-select": { color: textColor },   // selected value adapts
  }}
>
    <InputLabel>Building</InputLabel>
    <Select
      value={filter.building}
      onChange={(e) => handleFilterChange("building", e.target.value)}
    >
      <MenuItem value="">All</MenuItem>      {/* Default option = no filter */}
      <MenuItem value="LOS1">LOS1</MenuItem>
      <MenuItem value="LOS2">LOS2</MenuItem>
      <MenuItem value="LOS3">LOS3</MenuItem>
      <MenuItem value="LOS4">LOS4</MenuItem>
      <MenuItem value="LOS5">LOS5</MenuItem>
    </Select>
  </FormControl>

  {/* 🔹 Filter by Priority */}
 <FormControl
  size="small"
  sx={{
    minWidth: 140,
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: borderColor,    // adaptive border
    },
    "&:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: borderColor,
    },
    "& .MuiInputLabel-root": { color: textColor }, // label adapts
    "& .MuiSelect-select": { color: textColor },   // selected value adapts
  }}
>
    <InputLabel>Priority</InputLabel>
    <Select
      value={filter.priority}
      onChange={(e) => handleFilterChange("priority", e.target.value)}
    >
      <MenuItem value="">All</MenuItem>      {/* Default = show all priorities */}
      <MenuItem value="P0">P0</MenuItem>
      <MenuItem value="P1">P1</MenuItem>
      <MenuItem value="P2">P2</MenuItem>
      <MenuItem value="P3">P3</MenuItem>
      <MenuItem value="P4">P4</MenuItem>
    </Select>
  </FormControl>

  {/* 🔹 Filter by Status */}
 <FormControl
  size="small"
  sx={{
    minWidth: 140,
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: borderColor,    // adaptive border
    },
    "&:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: borderColor,
    },
    "& .MuiInputLabel-root": { color: textColor }, // label adapts
    "& .MuiSelect-select": { color: textColor },   // selected value adapts
  }}
>
    <InputLabel>Status</InputLabel>
    <Select
      value={filter.status}
      onChange={(e) => handleFilterChange("status", e.target.value)}
    >
      <MenuItem value="">All</MenuItem>       {/* Default = no status filter */}
      <MenuItem value="Open">Open</MenuItem>
      <MenuItem value="In Progress">In Progress</MenuItem>
      <MenuItem value="Resolved">Resolved</MenuItem>
      <MenuItem value="Closed">Closed</MenuItem>
    </Select>
  </FormControl>

{/* 🔹 Date Range Picker (as icon with tooltip) */}
<Tooltip
  // Tooltip shows current selection OR fallback text
  title={
    filter.dateRange[0] && filter.dateRange[1]
     ? `${filter.dateRange[0].toLocaleDateString("sv-SE")} - ${filter.dateRange[1].toLocaleDateString("sv-SE")}`
      : "Select Date Range"
  }
>
  {/* Icon that opens date picker */}
  <IconButton
    onClick={(e) => setDateAnchor(e.currentTarget)} // open Menu anchored to icon
    color="primary"
  >
    <DateRangeIcon /> {/* calendar icon */}
  </IconButton>
</Tooltip>

{/* Pop-up menu containing the DatePicker */}
<Menu
  anchorEl={dateAnchor}              // anchor = clicked icon
  open={Boolean(dateAnchor)}         // visible when anchor is set
  onClose={() => setDateAnchor(null)} // close when clicked outside
>
  <Box sx={{ p: 2 }}>
    {/* React DatePicker in range mode */}
    <DatePicker
      selectsRange
      startDate={filter.dateRange[0]} // controlled by state
      endDate={filter.dateRange[1]}
      onChange={(update) => {
        setFilter((prev) => ({ ...prev, dateRange: update })); // update filter
      }}
      inline // render calendar inline inside popup
    />

    {/* 🔹 Custom Footer: Done + Clear buttons */}
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        mt: 1, // small spacing above buttons
      }}
    >
      {/* Clear button → resets date range + closes menu */}
      <Button
        variant="outlined" // outlined (not filled)
        size="small"
        onClick={() => {
          handleFilterChange("dateRange", [null, null]); // reset filter
          setDateAnchor(null); // close popup
        }}
      >
        Clear
      </Button>

      {/* Done button → just closes menu */}
      <Button
        variant="contained" // filled
        size="small"
        onClick={() => setDateAnchor(null)}
      >
        Done
      </Button>
    </Box>
  </Box>
</Menu>



  {/* 🔹 Sort by Date Button */}
<IconButton
  size="small"
  sx={{
    height: "40px",
    width: "40px",
    border: `1px solid ${borderColor}`, // adaptive border
    color: textColor,                   // adaptive icon color
  }}
  onClick={handleSortDate}
>
  <SortIcon fontSize="small" />
</IconButton>
  </Box>


{/* 🔹 Right: Action Buttons */}
<Box sx={{ display: "flex", gap: 2, mt: { xs: 2, sm: 0 } }}>
  <CSVLink data={tickets} filename={"tickets.csv"} style={{ textDecoration: "none" }}>
    <Button variant="contained">Export CSV</Button>
  </CSVLink>
</Box>
</Box>


{/* ============================ */}
{/* TICKETS TABLE                */}
{/* ============================ */}

<TableContainer
  component={Paper}
  sx={{
    backgroundColor: "rgba(255, 255, 255, 0.2)", // semi-transparent white
    color: textColor,
    border: `1px solid ${borderColor}`,
    backdropFilter: "blur(8px)", // optional, makes text readable
  }}
>
  <Table>
    <TableHead>
      <TableRow>
        <TableCell sx={{ fontWeight: "bold", color: textColor }}>Ticket ID</TableCell>
        <TableCell sx={{ fontWeight: "bold", color: textColor }}>Category</TableCell>
        <TableCell sx={{ fontWeight: "bold", color: textColor }}>Sub Category</TableCell>
        <TableCell sx={{ fontWeight: "bold", color: textColor }}>Priority</TableCell>
        <TableCell sx={{ fontWeight: "bold", color: textColor }}>Status</TableCell>
        <TableCell sx={{ fontWeight: "bold", color: textColor }}>Date Opened</TableCell>
        <TableCell sx={{ fontWeight: "bold", color: textColor }}>Date Closed</TableCell>
        <TableCell sx={{ fontWeight: "bold", color: textColor }}>Actions</TableCell>
      </TableRow>
    </TableHead>

    <TableBody>
      {filteredTickets.map((ticket) => (
        <TableRow key={ticket.ticketId}>
          <TableCell sx={{ color: textColor }}>{ticket.ticketId}</TableCell>
          <TableCell sx={{ color: textColor }}>{ticket.category}</TableCell>
          <TableCell sx={{ color: textColor }}>{ticket.subCategory}</TableCell>
          <TableCell sx={{ color: textColor }}>{ticket.priority}</TableCell>
          <TableCell sx={{ color: textColor }}>{ticket.status}</TableCell>

          {/* Show dateOpened formatted consistently */}
          <TableCell sx={{ color: textColor }}>
            {formatServerDate(ticket.dateOpened)}
          </TableCell>

          {/* Show dateClosed formatted consistently; display '-' when empty/null */}
          <TableCell sx={{ color: textColor }}>
            {ticket.dateClosed ? formatServerDate(ticket.dateClosed) : "-"}
          </TableCell>

          <TableCell sx={{ color: textColor }}>
            <IconButton onClick={(e) => handleActionClick(e, ticket)} sx={{ color: textColor }}>
              <MoreVertIcon />
            </IconButton>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</TableContainer>


<Menu anchorEl={anchorEl} open={open} onClose={handleCloseMenu}>
  <MenuItem onClick={() => handleOpenModal("view")}>View More</MenuItem>
  <MenuItem onClick={() => handleOpenModal("assign")}>Assign Engineers</MenuItem>
  <MenuItem onClick={() => handleOpenModal("updateStatus")}>Update Status</MenuItem>
  <MenuItem onClick={() => handleOpenModal("edit")}>Edit</MenuItem>
  <MenuItem onClick={() => handleOpenModal("resolve")}>Resolve Ticket</MenuItem>
<MenuItem onClick={() => handleDownloadPDF(selectedTicket)}>
  Download PDF
</MenuItem>
      <MenuItem
    onClick={async () => {
      if (!selectedTicket) return;
      if (!window.confirm("Are you sure you want to delete this ticket?")) return;

      try {
        await fetch(
          `http://192.168.0.3:8000/api/tickets/${selectedTicket.ticket_id}`,
          { method: "DELETE" }
        );

        // 🔹 Remove from state
        setAllTickets((prev) =>
          prev.filter((t) => t.ticket_id !== selectedTicket.ticket_id)
        );

        setTickets((prev) =>
          prev.filter((t) => t.ticketId !== selectedTicket.ticket_id)
        );

        setSelectedTicket(null);
        setModalType("");
      } catch (err) {
        console.error("Error deleting ticket:", err);
        alert("Failed to delete ticket. Please try again.");
      }
    }}
    style={{ color: "red" }}
  >
    Delete Ticket
  </MenuItem>
</Menu>

<Modal open={!!modalType} onClose={() => setModalType("")}>
  <Box
    sx={{
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: 600,
      bgcolor: "rgba(255, 255, 255, 0.15)", // semi-transparent white
      boxShadow: 24,
      p: 4,
      backdropFilter: "blur(10px)", // keeps text readable
    }}
  >
    {modalBody()}
  </Box>
</Modal>
    </Box>
    </div>  // <-- CLOSE THE WRAPPER DIV
  );
};

export default TicketsPage;

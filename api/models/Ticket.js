// models/Ticket.js
import mongoose from "mongoose";

const ticketSchema = new mongoose.Schema(
  {
    ticket_id: { type: String, required: true, unique: true }, // KASI-LOS5-...
    category: { type: String, required: true },
    sub_category: { type: String, default: "" },
    opened: { type: Date, default: Date.now },
    reported_by: { type: String, default: "" },
    priority: { type: String, default: "" },
    building: { type: String, default: "" },
    location: { type: String, default: "" },
    impacted: { type: String, default: "" },
    description: { type: String, default: "" },
    detectedBy: { type: String, default: "" },
    time_detected: { type: Date },
    root_cause: { type: String, default: "" },
    actions_taken: { type: String, default: "" },
    status: { type: String, default: "Open" },
    assigned_to: { type: [String], default: [] }, // array of engineer names
    resolution_summary: { type: String, default: "" },
    resolution_time: { type: Date },
    duration: { type: String, default: "" },
    post_review: { type: Boolean, default: false },
    attachments: { type: [String], default: [] }, // file names or URLs
    escalation_history: { type: String, default: "" },
    closed: { type: Date },
    sla_breach: { type: Boolean, default: false },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

export default mongoose.model("Ticket", ticketSchema);

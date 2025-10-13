// api/models/TicketHistory.js
import mongoose from 'mongoose';

const ticketHistorySchema = new mongoose.Schema({
  ticket_id: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now },
  action: { type: String, required: true }, // create, update, delete, etc.
  changes: { type: String, default: '' }, // keep as JSON string to mirror CSV history
  editor: { type: String, default: '' }
});

export default mongoose.model('TicketHistory', ticketHistorySchema);

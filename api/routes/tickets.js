// api/routes/tickets.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import PDFDocument from 'pdfkit';


const isImage = (filename) => /\.(jpe?g|png|gif|bmp|webp)$/i.test(filename);
const isPDF = (filename) => /\.pdf$/i.test(filename);

// Format ISO string or Date object to "YYYY-MM-DD HH:mm:ss.SSS"
// backend: utils.js or wherever formatDateTime is
const formatDateTime = (input) => {
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d)) return '';
  return d.toISOString(); // ✅ always UTC with Z
};

const parseToISO = (input) => {
  if (!input) return '';
  // If already ISO with Z
  if (typeof input === 'string' && input.endsWith('Z')) {
    return input;
  }
  // If input is like "2025-09-12T09:00" (local naive)
  const d = new Date(input);
  if (isNaN(d)) return '';
  return d.toISOString(); // normalize
};


const BUILDING_CODES = {
  LOS1: 'LOS1',
  LOS2: 'LOS2',
  LOS3: 'LOS3',
  LOS4: 'LOS4',
  LOS5: 'LOS5'
};

const router = express.Router();
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const TICKETS_FILE = path.join(DATA_DIR, 'tickets.csv');
const HISTORY_FILE = path.join(DATA_DIR, 'ticket_history.csv');

// Ensure directories & files
[DATA_DIR, UPLOADS_DIR].forEach(dir => !fs.existsSync(dir) && fs.mkdirSync(dir));
if (!fs.existsSync(TICKETS_FILE)) {
  fs.writeFileSync(
    TICKETS_FILE,
    'ticket_id,category,sub_category,opened,reported_by,priority,building,location,impacted,description,detectedBy,time_detected,root_cause,actions_taken,status,assigned_to,resolution_summary,resolution_time,duration,post_review,attachments,escalation_history,closed,sla_breach\n'
  );
}
if (!fs.existsSync(HISTORY_FILE)) {
  fs.writeFileSync(HISTORY_FILE, 'ticket_id,timestamp,action,changes,editor\n');
}

// Multer storage
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOADS_DIR),
  filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// Helpers
const CATEGORY_SHORT = {
  'Network': 'NET',
  'Server': 'SER',
  'Storage': 'STOR',
  'Power': 'PWD',
  'Cooling': 'COOL',
  'Security': 'SEC',
  'Access Control': 'AC',
  'Application': 'APP',
  'Database': 'DBS'
};

const generateTicketId = (category, building) => {
  const short = CATEGORY_SHORT[category] || 'GEN';
  const now = new Date();
  const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const buildingCode = BUILDING_CODES[building] || 'LOS5'; // fallback

  // Count existing tickets for this category
  let count = 0;
  if (fs.existsSync(TICKETS_FILE)) {
    const lines = fs.readFileSync(TICKETS_FILE, 'utf8').trim().split('\n');
    if (lines.length > 1) {
      const header = lines.shift().split(',').map(h => h.replace(/"/g, ''));
      const catIndex = header.indexOf('category');
      if (catIndex !== -1) {
        lines.forEach(line => {
          const cols = line.match(/("([^"]|"")*"|[^,]+)/g) || [];
          const existingCat = cols[catIndex]?.replace(/^"|"$/g, '').replace(/""/g, '"');
          if (existingCat === category) count++;
        });
      }
    }
  }

  const sequence = String(count + 1).padStart(4, '0');
  return `KASI-${buildingCode}-${yyyymmdd}-${short}-${sequence}`;
};

const csvEscape = val => `"${String(val || '').replace(/"/g, '""')}"`;
const parsePayload = req => {
  if (req.is('multipart/form-data') && req.body.payload) {
    try { return JSON.parse(req.body.payload); } catch { return req.body; }
  }
  return req.body;
};

// ✅ helper to convert attachments to URLs
const toAttachmentUrls = filenames =>
  filenames
    .split(';')
    .filter(f => f.trim())
    .map(f => `/uploads/${f}`);

// POST create ticket
router.post('/', upload.array('attachments[]'), (req, res) => {
  try {
    const body = parsePayload(req);
    const ticket_id = body.ticket_id || generateTicketId(body.category, body.building);
    const assigned_to = Array.isArray(body.assigned_to) ? body.assigned_to.join(';') : (body.assigned_to || '');
    const post_review = body.post_review ? 'Yes' : 'No';
    const sla_breach = body.sla_breach ? 'Yes' : 'No';
    const fileNames = (req.files || []).map(f => path.basename(f.filename)).join(';');

const row = [
  ticket_id,
  body.category || '',
  body.sub_category || '',
  formatDateTime(body.opened || new Date()),  // opened
  body.reported_by || '',
  body.priority || '',
  body.building || '',
  body.location || '',
  body.impacted || '',
  body.description || '',
  body.detectedBy || '',
  body.time_detected || '',   // safe check
  body.root_cause || '',
  body.actions_taken || '',
  body.status || 'Open',
  assigned_to,
  body.resolution_summary || '',
  formatDateTime(body.resolution_time || ''), // safe check
  body.duration || '',
  post_review,
  fileNames,
  body.escalation_history || '',
  formatDateTime(body.closed || ''),          // safe check
  sla_breach
].map(csvEscape).join(',') + '\n';



    fs.appendFileSync(TICKETS_FILE, row);

    // history
const historyLine = [
  ticket_id,
  formatDateTime(new Date()),
  'create',
  JSON.stringify({ ...body, attachments: fileNames }),
  body.reported_by || ''
].map(csvEscape).join(',') + '\n';

    fs.appendFileSync(HISTORY_FILE, historyLine);

    res.json({
      success: true,
      ticket_id,
      ...body,
      attachments: fileNames ? toAttachmentUrls(fileNames) : []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to save ticket' });
  }
});

// GET all tickets
router.get('/', (_, res) => {
  try {
    if (!fs.existsSync(TICKETS_FILE)) return res.json([]);
    const lines = fs.readFileSync(TICKETS_FILE, 'utf8').trim().split('\n');
    const header = lines.shift().split(',').map(h => h.replace(/"/g, ''));
    const tickets = lines.map(line => {
      const cols = line.match(/("([^"]|"")*"|[^,]+)/g) || [];
      const obj = {};
      header.forEach((h, i) => {
        let v = cols[i] || '';
        v = v.replace(/^"|"$/g, '').replace(/""/g, '"');
        obj[h] = v;
      });

      if (obj.attachments) {
        obj.attachments = toAttachmentUrls(obj.attachments);
      } else {
        obj.attachments = [];
      }

      return obj;
    });
    res.json(tickets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to read tickets' });
  }
});

// Add this endpoint at the bottom, before `export default router;`
router.get('/:id/download', (req, res) => {
  const ticketId = req.params.id;
  try {
    if (!fs.existsSync(TICKETS_FILE)) return res.status(404).send('Tickets file not found');

    const lines = fs.readFileSync(TICKETS_FILE, 'utf8').trim().split('\n');
    const header = lines.shift().split(',').map(h => h.replace(/"/g, ''));
    const cols = lines
      .map(line => line.match(/("([^"]|"")*"|[^,]+)/g) || [])
      .find(c => c[0]?.replace(/^"|"$/g, '').replace(/""/g, '"') === ticketId);

    if (!cols) return res.status(404).send('Ticket not found');

    const ticket = {};
    header.forEach((h, i) => {
      let v = cols[i] || '';
      v = v.replace(/^"|"$/g, '').replace(/""/g, '"');
      ticket[h] = v;
    });

    // PDF generation
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${ticketId}.pdf`);

    doc.pipe(res);

    doc.fontSize(20).text(`Ticket ID: ${ticket.ticket_id}`, { underline: true });
    doc.moveDown();

// Helper: normalize datetime values
function normalizeDateTime(value) {
  if (!value) return value;

  // Match format like "2025-09-11 08:35:22" or ISO-like strings
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?/);
  if (match) {
    return `${match[1]} ${match[2]}:${match[3]}`; // YYYY-MM-DD HH:MM
  }

  return value;
}

// Helper to make keys look nice
function prettyKey(key) {
  return key
    .split('_')                          // split words at underscores
    .map(word => {
      if (word.toLowerCase() === "sla") return "SLA"; // special case
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

// Loop through fields (skip ticket_id, attachments, reported_by)
for (const key of Object.keys(ticket)) {
  if (key !== 'ticket_id' && key !== 'attachments' && key !== 'reported_by') {
    const val = normalizeDateTime(ticket[key]);
    doc.fontSize(12).text(`${prettyKey(key)}: ${val}`);
    doc.moveDown(0.5);
  }
}

// Attachments
if (ticket.attachments) {
  const attachments = ticket.attachments.split(';').filter(f => f);
  if (attachments.length) {
    doc.addPage();
    doc.fontSize(16).text('Attachments:', { underline: true });
    doc.moveDown(0.5);

    for (const att of attachments) {
  const filePath = path.join(UPLOADS_DIR, att);
  if (isImage(att)) {
    // Embed image directly on a new page
    doc.addPage();
    doc.fontSize(14).text(`Image: ${att}`, { underline: true });
    try {
      doc.image(filePath, { fit: [500, 400], align: 'center' });
    } catch (err) {
      doc.text(`Failed to embed image: ${err.message}`);
    }
  } else {
    // Non-image files → list them only; frontend handles download
    doc.fontSize(12).text(`Attached file: ${att} (download via frontend)`);
  }
  doc.moveDown();
}
}
}
 doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to generate PDF');
  }
});

// GET ticket stats (counts by status)
router.get('/stats', (_, res) => {
  try {
    if (!fs.existsSync(TICKETS_FILE)) return res.json({});

    const lines = fs.readFileSync(TICKETS_FILE, 'utf8').trim().split('\n');
    if (lines.length <= 1) return res.json({}); // only header, no data

    const header = lines.shift().split(',').map(h => h.replace(/"/g, ''));
    const statusIndex = header.indexOf('status');
    if (statusIndex === -1) return res.json({});

    const counts = {};
    lines.forEach(line => {
      const cols = line.match(/("([^"]|"")*"|[^,]+)/g) || [];
      let status = cols[statusIndex] || '';
      status = status.replace(/^"|"$/g, '').replace(/""/g, '"').trim();
      if (!status) return;

      counts[status] = (counts[status] || 0) + 1;
    });

    res.json(counts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute ticket stats' });
  }
});


// GET single ticket by ID
router.get('/:id', (req, res) => {
  const ticketId = req.params.id;
  try {
    if (!fs.existsSync(TICKETS_FILE)) return res.status(404).json({ error: 'No tickets file' });
    const lines = fs.readFileSync(TICKETS_FILE, 'utf8').trim().split('\n');
    const header = lines.shift().split(',').map(h => h.replace(/"/g, ''));
    const cols = lines
      .map(line => line.match(/("([^"]|"")*"|[^,]+)/g) || [])
      .find(c => c[0]?.replace(/^"|"$/g, '').replace(/""/g, '"') === ticketId);

    if (!cols) return res.status(404).json({ error: 'Ticket not found' });

    const ticket = {};
    header.forEach((h, i) => {
      let v = cols[i] || '';
      v = v.replace(/^"|"$/g, '').replace(/""/g, '"');
      ticket[h] = v;
    });

    ticket.attachments = ticket.attachments
      ? toAttachmentUrls(ticket.attachments)
      : [];

    res.json(ticket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to read ticket' });
  }
});

// GET ticket history
router.get('/:id/history', (req, res) => {
  const id = req.params.id;
  try {
    if (!fs.existsSync(HISTORY_FILE)) return res.json([]);
    const lines = fs.readFileSync(HISTORY_FILE, 'utf8').trim().split('\n');
    const header = lines.shift().split(',').map(h => h.replace(/"/g, ''));
    const entries = lines.map(line => {
      const cols = line.match(/("([^"]|"")*"|[^,]+)/g) || [];
      const obj = {};
      header.forEach((h, i) => { obj[h] = cols[i]?.replace(/^"|"$/g, '').replace(/""/g, '"') || ''; });
      return obj;
    }).filter(e => e.ticket_id === id);
    res.json(entries);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to read history' }); }
});

// PUT update ticket
router.put('/:id', upload.array('attachments[]'), (req, res) => {
  try {
    const id = req.params.id;
    const body = parsePayload(req);
    if (!fs.existsSync(TICKETS_FILE)) return res.status(404).json({ error: 'No tickets file' });
    const lines = fs.readFileSync(TICKETS_FILE, 'utf8').trim().split('\n');
    const header = lines.shift().split(',').map(h => h.replace(/"/g, ''));
    let found = false;
    let updatedTicket = null;

    const updatedLines = lines.map(line => {
      const cols = line.match(/("([^"]|"")*"|[^,]+)/g) || [];
      if (cols[0]?.replace(/^"|"$/g, '').replace(/""/g, '"') === id) {
        found = true;
        const old = {};
        header.forEach((h, i) => { old[h] = cols[i]?.replace(/^"|"$/g, '').replace(/""/g, '"') || ''; });
        const assigned_to = Array.isArray(body.assigned_to) ? body.assigned_to.join(';') : (body.assigned_to || old.assigned_to);
        const post_review = body.post_review !== undefined ? (body.post_review ? 'Yes' : 'No') : old.post_review;
        const sla_breach = body.sla_breach !== undefined ? (body.sla_breach ? 'Yes' : 'No') : old.sla_breach;
        const fileNames = ((req.files || []).map(f => path.basename(f.filename)).join(';')) || old.attachments;
        const newRowObj = { ...old, ...body, assigned_to, post_review, sla_breach, attachments: fileNames };
        updatedTicket = { ...newRowObj, attachments: fileNames ? toAttachmentUrls(fileNames) : [] };
        const row = header.map(h => csvEscape(newRowObj[h] || '')).join(',');
        return row;
      }
      return line;
    });

    if (!found) return res.status(404).json({ error: 'Ticket not found' });
    fs.writeFileSync(TICKETS_FILE, [header.map(csvEscape).join(',')].concat(updatedLines).join('\n') + '\n');
    const historyLine = [
  id,
  formatDateTime(new Date()),
  'update',
  JSON.stringify(body),
  body.reported_by || ''
].map(csvEscape).join(',') + '\n';
    fs.appendFileSync(HISTORY_FILE, historyLine);

    res.json({ success: true, ticket_id: id, ...updatedTicket });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to update ticket' }); }
});

// Export all tickets as CSV
router.get('/export/all', (_, res) => {
  try {
    if (!fs.existsSync(TICKETS_FILE)) return res.status(404).send('No tickets found');
    res.download(TICKETS_FILE, 'tickets.csv');
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to export tickets');
  }
});

// DELETE a ticket by ID
router.delete('/:id', (req, res) => {
  try {
    const id = req.params.id;

    if (!fs.existsSync(TICKETS_FILE)) {
      return res.status(404).json({ error: 'No tickets file' });
    }

    // Read all lines
    const lines = fs.readFileSync(TICKETS_FILE, 'utf8').trim().split('\n');
    const header = lines.shift().split(',').map(h => h.replace(/"/g, ''));

    // Keep everything except the ticket we’re deleting
    const remaining = lines.filter(line => {
      const cols = line.match(/("([^"]|"")*"|[^,]+)/g) || [];
      const tid = cols[0]?.replace(/^"|"$/g, '').replace(/""/g, '"');
      return tid !== id;
    });

    if (remaining.length === lines.length) {
      // no change means ticket not found
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Write updated file back
    fs.writeFileSync(
      TICKETS_FILE,
      [header.map(h => `"${h}"`).join(',')].concat(remaining).join('\n') + '\n'
    );

    // Write to history log
    const historyLine = [
      id,
      formatDateTime(new Date()),
      'delete',
      '{}',
      req.body.editor || '' // optional editor name
    ].map(csvEscape).join(',') + '\n';
    fs.appendFileSync(HISTORY_FILE, historyLine);

    res.json({ success: true, message: `Ticket ${id} deleted.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete ticket' });
  }
});


export default router;












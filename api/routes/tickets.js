// api/routes/tickets.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import PDFDocument from 'pdfkit';
import Ticket from '../models/Ticket.js';
import TicketHistory from '../models/TicketHistory.js';

const isImage = (filename) => /\.(jpe?g|png|gif|bmp|webp)$/i.test(filename);
const isPDF = (filename) => /\.pdf$/i.test(filename);

// Format ISO string or Date object to "YYYY-MM-DDTHH:mm:ss.sssZ"
const formatDateTime = (input) => {
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d)) return '';
  return d.toISOString();
};

const parseToISO = (input) => {
  if (!input) return '';
  if (typeof input === 'string' && input.endsWith('Z')) return input;
  const d = new Date(input);
  if (isNaN(d)) return '';
  return d.toISOString();
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

// Ensure directories & files (leave CSV files in place for backward compatibility)
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

const csvEscape = val => `"${String(val || '').replace(/"/g, '""')}"`;
const parsePayload = req => {
  if (req.is('multipart/form-data') && req.body.payload) {
    try { return JSON.parse(req.body.payload); } catch { return req.body; }
  }
  return req.body;
};

// helper: convert attachments to URLs from either semicolon string or array
const toAttachmentUrls = (filenames) => {
  if (!filenames) return [];
  if (Array.isArray(filenames)) {
    return filenames.filter(Boolean).map(f => `/uploads/${f}`);
  }
  // semicolon-separated string
  return filenames
    .split(';')
    .filter(f => f.trim())
    .map(f => `/uploads/${f}`);
};

// generateTicketId: try DB count first, fallback to CSV counting (keeps your original sequence logic)
const generateTicketId = async (category, building) => {
  const short = CATEGORY_SHORT[category] || 'GEN';
  const now = new Date();
  const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const buildingCode = BUILDING_CODES[building] || 'LOS5';

  // Try DB count
  try {
    const count = await Ticket.countDocuments({ category }).exec();
    const sequence = String(count + 1).padStart(4, '0');
    return `KASI-${buildingCode}-${yyyymmdd}-${short}-${sequence}`;
  } catch (err) {
    // fallback to CSV counting (original behaviour)
    let count = 0;
    try {
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
    } catch (e) {
      // if CSV fallback also fails, still generate with 0001
    }
    const sequence = String(count + 1).padStart(4, '0');
    return `KASI-${buildingCode}-${yyyymmdd}-${short}-${sequence}`;
  }
};

/* -----------------------
   ROUTES (keep behaviour)
   ----------------------- */

// POST create ticket
router.post('/', upload.array('attachments[]'), async (req, res) => {
  try {
    const body = parsePayload(req);
    const ticket_id = body.ticket_id || await generateTicketId(body.category, body.building);
    const assigned_to_str = Array.isArray(body.assigned_to) ? body.assigned_to.join(';') : (body.assigned_to || '');
    const post_review_str = body.post_review ? 'Yes' : 'No';
    const sla_breach_str = body.sla_breach ? 'Yes' : 'No';
    const fileNames = (req.files || []).map(f => path.basename(f.filename)).join(';');

    // CSV row (unchanged)
    const row = [
      ticket_id,
      body.category || '',
      body.sub_category || '',
      formatDateTime(body.opened || new Date()),
      body.reported_by || '',
      body.priority || '',
      body.building || '',
      body.location || '',
      body.impacted || '',
      body.description || '',
      body.detectedBy || '',
      body.time_detected || '',
      body.root_cause || '',
      body.actions_taken || '',
      body.status || 'Open',
      assigned_to_str,
      body.resolution_summary || '',
      formatDateTime(body.resolution_time || ''),
      body.duration || '',
      post_review_str,
      fileNames,
      body.escalation_history || '',
      formatDateTime(body.closed || ''),
      sla_breach_str
    ].map(csvEscape).join(',') + '\n';

    // Append to CSV (preserve existing behaviour)
    fs.appendFileSync(TICKETS_FILE, row);

    // Save to Mongo (primary)
    try {
      const ticketDoc = new Ticket({
        ticket_id,
        category: body.category || '',
        sub_category: body.sub_category || '',
        opened: parseToISO(body.opened) || new Date(),
        reported_by: body.reported_by || '',
        priority: body.priority || '',
        building: body.building || '',
        location: body.location || '',
        impacted: body.impacted || '',
        description: body.description || '',
        detectedBy: body.detectedBy || '',
        time_detected: parseToISO(body.time_detected) || null,
        root_cause: body.root_cause || '',
        actions_taken: body.actions_taken || '',
        status: body.status || 'Open',
        assigned_to: Array.isArray(body.assigned_to) ? body.assigned_to : (typeof body.assigned_to === 'string' ? body.assigned_to.split(';').filter(Boolean) : []),
        resolution_summary: body.resolution_summary || '',
        resolution_time: parseToISO(body.resolution_time) || null,
        duration: body.duration || '',
        post_review: !!body.post_review,
        attachments: fileNames ? fileNames.split(';').filter(Boolean) : [],
        escalation_history: body.escalation_history || '',
        closed: parseToISO(body.closed) || null,
        sla_breach: !!body.sla_breach
      });
      await ticketDoc.save();
    } catch (dbErr) {
      console.error('Mongo save error (create):', dbErr);
      // continue — CSV kept as backup
    }

    // history CSV (unchanged)
    const historyLine = [
      ticket_id,
      formatDateTime(new Date()),
      'create',
      JSON.stringify({ ...body, attachments: fileNames }),
      body.reported_by || ''
    ].map(csvEscape).join(',') + '\n';
    fs.appendFileSync(HISTORY_FILE, historyLine);

    // history DB (mirror, keep changes as JSON string to match CSV)
    try {
      await TicketHistory.create({
        ticket_id,
        action: 'create',
        changes: JSON.stringify({ ...body, attachments: fileNames }),
        editor: body.reported_by || ''
      });
    } catch (hErr) {
      console.error('Mongo history save error:', hErr);
    }

    // Response kept identical to previous behaviour
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
router.get('/', async (_, res) => {
  try {
    // Try DB first
    try {
      const docs = await Ticket.find().lean().sort({ createdAt: -1 }).exec();
      if (docs && docs.length) {
        const tickets = docs.map(doc => {
          // Map DB doc into same key names/format as your CSV-based API
          return {
            ticket_id: doc.ticket_id,
            category: doc.category || '',
            sub_category: doc.sub_category || '',
            opened: doc.opened ? formatDateTime(doc.opened) : '',
            reported_by: doc.reported_by || '',
            priority: doc.priority || '',
            building: doc.building || '',
            location: doc.location || '',
            impacted: doc.impacted || '',
            description: doc.description || '',
            detectedBy: doc.detectedBy || '',
            time_detected: doc.time_detected ? formatDateTime(doc.time_detected) : '',
            root_cause: doc.root_cause || '',
            actions_taken: doc.actions_taken || '',
            status: doc.status || '',
            assigned_to: Array.isArray(doc.assigned_to) ? doc.assigned_to.join(';') : (doc.assigned_to || ''),
            resolution_summary: doc.resolution_summary || '',
            resolution_time: doc.resolution_time ? formatDateTime(doc.resolution_time) : '',
            duration: doc.duration || '',
            post_review: doc.post_review ? 'Yes' : 'No',
            attachments: doc.attachments && doc.attachments.length ? doc.attachments.map(f => `/uploads/${f}`) : [],
            escalation_history: doc.escalation_history || '',
            closed: doc.closed ? formatDateTime(doc.closed) : '',
            sla_breach: doc.sla_breach ? 'Yes' : 'No'
          };
        });
        return res.json(tickets);
      }
      // If DB returned empty, fallthrough to CSV parsing below (keeps behaviour)
    } catch (dbErr) {
      console.error('DB read error (GET /):', dbErr);
      // fallback to CSV
    }

    // CSV fallback (original logic)
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

// Keep order: download route before '/:id' so '/stats' etc are safe
router.get('/:id/download', async (req, res) => {
  const ticketId = req.params.id;
  try {
    // Try DB first
    let ticketObj = null;
    try {
      const doc = await Ticket.findOne({ ticket_id: ticketId }).lean().exec();
      if (doc) {
        // Map doc into a flat object (same keys your PDF code expects)
        ticketObj = {
          ticket_id: doc.ticket_id,
          category: doc.category || '',
          sub_category: doc.sub_category || '',
          opened: doc.opened ? formatDateTime(doc.opened) : '',
          reported_by: doc.reported_by || '',
          priority: doc.priority || '',
          building: doc.building || '',
          location: doc.location || '',
          impacted: doc.impacted || '',
          description: doc.description || '',
          detectedBy: doc.detectedBy || '',
          time_detected: doc.time_detected ? formatDateTime(doc.time_detected) : '',
          root_cause: doc.root_cause || '',
          actions_taken: doc.actions_taken || '',
          status: doc.status || '',
          assigned_to: Array.isArray(doc.assigned_to) ? doc.assigned_to.join(';') : (doc.assigned_to || ''),
          resolution_summary: doc.resolution_summary || '',
          resolution_time: doc.resolution_time ? formatDateTime(doc.resolution_time) : '',
          duration: doc.duration || '',
          post_review: doc.post_review ? 'Yes' : 'No',
          attachments: doc.attachments && doc.attachments.length ? doc.attachments.join(';') : '',
          escalation_history: doc.escalation_history || '',
          closed: doc.closed ? formatDateTime(doc.closed) : '',
          sla_breach: doc.sla_breach ? 'Yes' : 'No'
        };
      }
    } catch (dbErr) {
      console.error('DB read error (download):', dbErr);
    }

    // If DB not found, fallback to CSV (original logic)
    if (!ticketObj) {
      if (!fs.existsSync(TICKETS_FILE)) return res.status(404).send('Tickets file not found');
      const lines = fs.readFileSync(TICKETS_FILE, 'utf8').trim().split('\n');
      const header = lines.shift().split(',').map(h => h.replace(/"/g, ''));
      const cols = lines
        .map(line => line.match(/("([^"]|"")*"|[^,]+)/g) || [])
        .find(c => c[0]?.replace(/^"|"$/g, '').replace(/""/g, '"') === ticketId);

      if (!cols) return res.status(404).send('Ticket not found');

      ticketObj = {};
      header.forEach((h, i) => {
        let v = cols[i] || '';
        v = v.replace(/^"|"$/g, '').replace(/""/g, '"');
        ticketObj[h] = v;
      });
    }

    // --- PDF generation (same as before) ---
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${ticketId}.pdf`);

    doc.pipe(res);

    doc.fontSize(20).text(`Ticket ID: ${ticketObj.ticket_id}`, { underline: true });
    doc.moveDown();

    function normalizeDateTime(value) {
      if (!value) return value;
      const match = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?/);
      if (match) {
        return `${match[1]} ${match[2]}:${match[3]}`;
      }
      return value;
    }

    function prettyKey(key) {
      return key
        .split('_')
        .map(word => {
          if (word.toLowerCase() === "sla") return "SLA";
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
    }

    for (const key of Object.keys(ticketObj)) {
      if (key !== 'ticket_id' && key !== 'attachments' && key !== 'reported_by') {
        const val = normalizeDateTime(ticketObj[key]);
        doc.fontSize(12).text(`${prettyKey(key)}: ${val}`);
        doc.moveDown(0.5);
      }
    }

    // Attachments handling (handle either semicolon string or array)
    const attachmentsRaw = ticketObj.attachments || '';
    const attachments = Array.isArray(attachmentsRaw)
      ? attachmentsRaw
      : String(attachmentsRaw).split(';').filter(f => f);

    if (attachments.length) {
      doc.addPage();
      doc.fontSize(16).text('Attachments:', { underline: true });
      doc.moveDown(0.5);

      for (const att of attachments) {
        const filePath = path.join(UPLOADS_DIR, att);
        if (isImage(att)) {
          doc.addPage();
          doc.fontSize(14).text(`Image: ${att}`, { underline: true });
          try {
            doc.image(filePath, { fit: [500, 400], align: 'center' });
          } catch (err) {
            doc.text(`Failed to embed image: ${err.message}`);
          }
        } else {
          doc.fontSize(12).text(`Attached file: ${att} (download via frontend)`);
        }
        doc.moveDown();
      }
    }

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to generate PDF');
  }
});

// GET enhanced ticket stats (for dashboard analytics)
router.get('/stats', async (req, res) => {
  try {
    const match = {};
    const matchClosed = {};

    const month = req.query.month; // e.g. 2025-10
    const week = req.query.week;   // e.g. 2025-W40
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

    // === FILTERS ===
    if (month) {
      const [yr, m] = month.split('-').map(Number);
      match.$expr = {
        $and: [
          { $eq: [{ $year: '$createdAt' }, yr] },
          { $eq: [{ $month: '$createdAt' }, m] }
        ]
      };
      matchClosed.$expr = {
        $and: [
          { $eq: [{ $year: '$closedAt' }, yr] },
          { $eq: [{ $month: '$closedAt' }, m] }
        ]
      };
    } else if (week) {
      const [yr, weekNum] = week.split('-W').map(Number);
      const startDate = new Date(yr, 0, (weekNum - 1) * 7 + 1);
      const endDate = new Date(yr, 0, weekNum * 7 + 1);
      match.createdAt = { $gte: startDate, $lt: endDate };
      matchClosed.closedAt = { $gte: startDate, $lt: endDate };
    } else if (req.query.year) {
      // Year-wide stats
      match.$expr = { $eq: [{ $year: '$createdAt' }, year] };
      matchClosed.$expr = { $eq: [{ $year: '$closedAt' }, year] };
    }

    // === AGGREGATIONS (run in parallel for speed) ===
    const [
      byStatus,
      byCategory,
      byPriority,
      ticketsOpenedOverTime,
      ticketsClosedOverTime,
      slaBreachesCount,
      slaOnTimeCount,
      totalTickets
    ] = await Promise.all([
      Ticket.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Ticket.aggregate([{ $match: match }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
      Ticket.aggregate([{ $match: match }, { $group: { _id: '$priority', count: { $sum: 1 } } }]),

      // Opened per day
      Ticket.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            opened: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]),

// Closed per day (fallback to createdAt if closedAt missing)
Ticket.aggregate([
  {
    $match: {
      ...match,
      status: "Closed", // include status-based detection
    },
  },
  {
    $group: {
      _id: {
        year: {
          $year: {
            $ifNull: ["$closedAt", "$createdAt"],
          },
        },
        month: {
          $month: {
            $ifNull: ["$closedAt", "$createdAt"],
          },
        },
        day: {
          $dayOfMonth: {
            $ifNull: ["$closedAt", "$createdAt"],
          },
        },
      },
      closed: { $sum: 1 },
    },
  },
  { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
]),

//SLA Breached counts
      Ticket.countDocuments({
  ...match,
  $or: [
    { slaBreached: true },
    { slaBreached: "Yes" },
    { slaBreached: "yes" },
    { slaBreached: "checked" },
    { slaBreached: 1 },
  ],
}),
Ticket.countDocuments({
  ...match,
  $or: [
    { slaBreached: false },
    { slaBreached: "No" },
    { slaBreached: "no" },
    { slaBreached: "unchecked" },
    { slaBreached: 0 },
    { slaBreached: null },
  ],
}),
      Ticket.countDocuments(match)
    ]);

    // === Merge Opened + Closed Over Time ===
    const mergedOverTime = [];
    const allDates = new Set([
      ...ticketsOpenedOverTime.map(i => `${i._id.year}-${i._id.month}-${i._id.day}`),
      ...ticketsClosedOverTime.map(i => `${i._id.year}-${i._id.month}-${i._id.day}`)
    ]);

    allDates.forEach(dateKey => {
      const [y, m, d] = dateKey.split('-');
      const openedObj = ticketsOpenedOverTime.find(i => i._id.year == y && i._id.month == m && i._id.day == d);
      const closedObj = ticketsClosedOverTime.find(i => i._id.year == y && i._id.month == m && i._id.day == d);

      mergedOverTime.push({
        date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        opened: openedObj?.opened || 0,
        closed: closedObj?.closed || 0
      });
    });

    mergedOverTime.sort((a, b) => new Date(a.date) - new Date(b.date));

    // === Simple Analytics ===
    const total = totalTickets || 1;
    const slaCompliance = ((slaOnTimeCount / total) * 100).toFixed(1);

    const topCategory = byCategory.reduce((a, b) => (a.count > b.count ? a : b), { _id: 'N/A', count: 0 });
    const topPriority = byPriority.reduce((a, b) => (a.count > b.count ? a : b), { _id: 'N/A', count: 0 });

    // === Response ===
    res.json({
      totalTickets,
      byStatus: byStatus.map(i => ({ status: i._id || 'Unknown', count: i.count })),
      byCategory: byCategory.map(i => ({ category: i._id || 'Uncategorized', count: i.count })),
      byPriority: byPriority.map(i => ({ priority: i._id || 'N/A', count: i.count })),
      ticketsOverTime: mergedOverTime,
      slaStats: {
        breached: slaBreachesCount,
        onTime: slaOnTimeCount,
        complianceRate: slaCompliance
      },
      analytics: {
        topCategory: topCategory._id,
        topPriority: topPriority._id,
        yearAnalyzed: year
      }
    });

  } catch (err) {
    console.error('Stats route error:', err);
    res.status(500).json({ error: 'Failed to compute ticket stats' });
  }
});


// GET single ticket by ID
router.get('/:id', async (req, res) => {
  const ticketId = req.params.id;
  try {
    // try DB first
    try {
      const doc = await Ticket.findOne({ ticket_id: ticketId }).lean().exec();
      if (doc) {
        const obj = {
          ticket_id: doc.ticket_id,
          category: doc.category || '',
          sub_category: doc.sub_category || '',
          opened: doc.opened ? formatDateTime(doc.opened) : '',
          reported_by: doc.reported_by || '',
          priority: doc.priority || '',
          building: doc.building || '',
          location: doc.location || '',
          impacted: doc.impacted || '',
          description: doc.description || '',
          detectedBy: doc.detectedBy || '',
          time_detected: doc.time_detected ? formatDateTime(doc.time_detected) : '',
          root_cause: doc.root_cause || '',
          actions_taken: doc.actions_taken || '',
          status: doc.status || '',
          assigned_to: Array.isArray(doc.assigned_to) ? doc.assigned_to.join(';') : (doc.assigned_to || ''),
          resolution_summary: doc.resolution_summary || '',
          resolution_time: doc.resolution_time ? formatDateTime(doc.resolution_time) : '',
          duration: doc.duration || '',
          post_review: doc.post_review ? 'Yes' : 'No',
          attachments: doc.attachments && doc.attachments.length ? doc.attachments.map(f => `/uploads/${f}`) : [],
          escalation_history: doc.escalation_history || '',
          closed: doc.closed ? formatDateTime(doc.closed) : '',
          sla_breach: doc.sla_breach ? 'Yes' : 'No'
        };
        return res.json(obj);
      }
    } catch (dbErr) {
      console.error('DB read single ticket error:', dbErr);
    }

    // CSV fallback (original)
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
router.get('/:id/history', async (req, res) => {
  const id = req.params.id;
  try {
    // try DB
    try {
      const entries = await TicketHistory.find({ ticket_id: id }).sort({ timestamp: 1 }).lean().exec();
      if (entries && entries.length) {
        const mapped = entries.map(e => ({
          ticket_id: e.ticket_id,
          timestamp: formatDateTime(e.timestamp),
          action: e.action,
          changes: e.changes,
          editor: e.editor || ''
        }));
        return res.json(mapped);
      }
    } catch (dbErr) {
      console.error('DB history read error:', dbErr);
    }

    // fallback to CSV (original)
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to read history' });
  }
});

// PUT update ticket
router.put('/:id', upload.array('attachments[]'), async (req, res) => {
  try {
    const id = req.params.id;
    const body = parsePayload(req);

    // Update DB (try)
    let updatedTicketResponse = null;
    try {
      const doc = await Ticket.findOne({ ticket_id: id }).exec();
      if (!doc) {
        // If no DB doc, we'll still attempt CSV update below
      } else {
        // compute assigned_to array
        const assignedArr = Array.isArray(body.assigned_to)
          ? body.assigned_to
          : (typeof body.assigned_to === 'string' ? body.assigned_to.split(';').filter(Boolean) : doc.assigned_to);

        const post_review_flag = body.post_review !== undefined ? !!body.post_review : doc.post_review;
        const sla_breach_flag = body.sla_breach !== undefined ? !!body.sla_breach : doc.sla_breach;

        const fileNames = ((req.files || []).map(f => path.basename(f.filename)).join(';')) || (doc.attachments ? doc.attachments.join(';') : '');

        const attachmentsArr = fileNames ? fileNames.split(';').filter(Boolean) : (doc.attachments || []);

        // build update object for DB
        const updateObj = {
          category: body.category ?? doc.category,
          sub_category: body.sub_category ?? doc.sub_category,
          opened: parseToISO(body.opened) || doc.opened,
          reported_by: body.reported_by ?? doc.reported_by,
          priority: body.priority ?? doc.priority,
          building: body.building ?? doc.building,
          location: body.location ?? doc.location,
          impacted: body.impacted ?? doc.impacted,
          description: body.description ?? doc.description,
          detectedBy: body.detectedBy ?? doc.detectedBy,
          time_detected: parseToISO(body.time_detected) || doc.time_detected,
          root_cause: body.root_cause ?? doc.root_cause,
          actions_taken: body.actions_taken ?? doc.actions_taken,
          status: body.status ?? doc.status,
          assigned_to: assignedArr,
          resolution_summary: body.resolution_summary ?? doc.resolution_summary,
          resolution_time: parseToISO(body.resolution_time) || doc.resolution_time,
          duration: body.duration ?? doc.duration,
          post_review: post_review_flag,
          attachments: attachmentsArr,
          escalation_history: body.escalation_history ?? doc.escalation_history,
          closed: parseToISO(body.closed) || doc.closed,
          sla_breach: sla_breach_flag
        };

          // ✅ Handle closedAt timestamp logic
          const newStatus = body.status ?? doc.status;
          const oldStatus = doc.status;

          // If ticket just got closed → set closedAt
          if (newStatus === "Closed" && oldStatus !== "Closed") {
            updateObj.closedAt = new Date().toISOString();
          }

          // If ticket reopened (status moved away from Closed) → clear closedAt
          else if (oldStatus === "Closed" && newStatus !== "Closed") {
            updateObj.closedAt = null;
          }


        await Ticket.updateOne({ ticket_id: id }, { $set: updateObj }).exec();

        updatedTicketResponse = {
          ...updateObj,
          ticket_id: id,
          attachments: attachmentsArr.length ? attachmentsArr.map(f => `/uploads/${f}`) : []
        };
      }
    } catch (dbErr) {
      console.error('DB update error:', dbErr);
      // continue to CSV update
    }

    // CSV update (original logic) - ensures CSV remains in sync (keeps behaviour)
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

    // history CSV
    const historyLine = [
      id,
      formatDateTime(new Date()),
      'update',
      JSON.stringify(body),
      body.reported_by || ''
    ].map(csvEscape).join(',') + '\n';
    fs.appendFileSync(HISTORY_FILE, historyLine);

    // history DB
    try {
      await TicketHistory.create({
        ticket_id: id,
        action: 'update',
        changes: JSON.stringify(body),
        editor: body.reported_by || ''
      });
    } catch (hErr) {
      console.error('Mongo history save error (update):', hErr);
    }

    // Response: mirror previous behaviour — use CSV-updated object if available, else DB-updated mapped object
    res.json({ success: true, ticket_id: id, ...(updatedTicket || updatedTicketResponse) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

// Export all tickets as CSV (keep existing behaviour)
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
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;

    // Delete from DB (try)
    try {
      await Ticket.deleteOne({ ticket_id: id }).exec();
    } catch (dbErr) {
      console.error('DB delete error:', dbErr);
      // continue to CSV deletion
    }

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

    // Write updated file back (keep CSV behaviour)
    fs.writeFileSync(
      TICKETS_FILE,
      [header.map(h => `"${h}"`).join(',')].concat(remaining).join('\n') + '\n'
    );

    // Write to history log (CSV)
    const historyLine = [
      id,
      formatDateTime(new Date()),
      'delete',
      '{}',
      req.body.editor || ''
    ].map(csvEscape).join(',') + '\n';
    fs.appendFileSync(HISTORY_FILE, historyLine);

    // history DB
    try {
      await TicketHistory.create({
        ticket_id: id,
        action: 'delete',
        changes: '{}',
        editor: req.body.editor || ''
      });
    } catch (hErr) {
      console.error('Mongo history save error (delete):', hErr);
    }

    res.json({ success: true, message: `Ticket ${id} deleted.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete ticket' });
  }
});

export default router;

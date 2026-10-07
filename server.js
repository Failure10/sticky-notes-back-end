const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
// Point DATA_FILE at a Render persistent disk (e.g. /var/data/notes.json) to keep data across deploys.
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'notes.json');
// Optional comma-separated list, e.g. "https://yoursite.com". Empty = allow any origin.
const ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

/* ---------- storage ---------- */
let notes = [];
try {
  notes = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!Array.isArray(notes)) notes = [];
} catch (e) {
  notes = [];
}
// Migrate older records: give every record an id and a resolved flag.
notes = notes.map(n => ({ ...n, id: n.id || crypto.randomUUID(), resolved: !!n.resolved }));

function persist() {
  try {
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(notes));
    fs.renameSync(tmp, DATA_FILE);
  } catch (e) {
    console.error('Could not write data file:', e.message);
  }
}
persist();

/* ---------- app ---------- */
const app = express();
app.disable('x-powered-by');
app.use(cors(ORIGINS.length ? { origin: ORIGINS } : undefined));
app.use(express.json({ limit: '100kb' }));

app.get('/', (req, res) => res.json({ ok: true, service: 'patient-records' }));
app.get('/health', (req, res) => res.json({ ok: true, records: notes.length }));

app.get('/api/notes', (req, res) => res.json(notes));

app.post('/api/notes', (req, res) => {
  const b = req.body || {};
  const patientId = String(b.patientId || '').trim().toUpperCase();
  const name = String(b.name || '').trim();
  const dob = String(b.dob || '').trim();
  const text = String(b.notes || '').trim();

  if (!/^P-\d{1,7}$/.test(patientId)) return res.status(400).json({ error: 'Invalid patient ID' });
  if (!name || name.length > 80) return res.status(400).json({ error: 'Name is required (80 characters max)' });
  if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dob)) return res.status(400).json({ error: 'Invalid date of birth' });
  if (!text || text.length > 5000) return res.status(400).json({ error: 'Notes are required (5000 characters max)' });
  if (notes.some(n => String(n.patientId).toUpperCase() === patientId)) {
    return res.status(409).json({ error: `${patientId} is already in use` });
  }

  const note = { id: crypto.randomUUID(), patientId, name, dob, notes: text, resolved: false, createdAt: new Date().toISOString() };
  notes.push(note);
  persist();
  res.status(201).json(note);
});

// Mark a record resolved / reopen it
app.patch('/api/notes/:id', (req, res) => {
  const note = notes.find(n => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: 'Record not found' });
  if (typeof req.body?.resolved !== 'boolean') return res.status(400).json({ error: '"resolved" must be true or false' });
  note.resolved = req.body.resolved;
  note.resolvedAt = note.resolved ? new Date().toISOString() : undefined;
  persist();
  res.json(note);
});

// Clear every resolved record. Requires ?resolved=true so a stray DELETE can never wipe everything.
app.delete('/api/notes', (req, res) => {
  if (req.query.resolved !== 'true') return res.status(400).json({ error: 'Use ?resolved=true' });
  const before = notes.length;
  notes = notes.filter(n => !n.resolved);
  persist();
  res.json({ deleted: before - notes.length });
});

app.delete('/api/notes/:id', (req, res) => {
  const before = notes.length;
  notes = notes.filter(n => n.id !== req.params.id);
  if (notes.length === before) return res.status(404).json({ error: 'Record not found' });
  persist();
  res.status(204).end();
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, () => console.log(`Listening on ${PORT}`));

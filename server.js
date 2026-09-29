const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory database
let notes = [];

// GET all notes
app.get('/api/notes', (req, res) => {
  res.json(notes);
});

// POST a new note
app.post('/api/notes', (req, res) => {
  const { patientId, name, dob, notes: clinicalNotes } = req.body;
  const newNote = {
    id: Date.now().toString(),
    patientId,
    name,
    dob,
    notes: clinicalNotes,
    timestamp: Date.now()
  };
  notes.unshift(newNote); // Add to top
  res.status(201).json(newNote);
});

// PUT (Edit) a note
app.put('/api/notes/:id', (req, res) => {
  const { id } = req.params;
  const index = notes.findIndex(n => n.id === id);
  if (index !== -1) {
    notes[index] = { ...notes[index], ...req.body };
    res.json(notes[index]);
  } else {
    res.status(404).json({ error: 'Note not found' });
  }
});

// DELETE a note
app.delete('/api/notes/:id', (req, res) => {
  const { id } = req.params;
  notes = notes.filter(n => n.id !== id);
  res.json({ success: true });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

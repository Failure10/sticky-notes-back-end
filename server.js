const express = require('express');
const cors = require('cors');

const app = express();

// Enable CORS and JSON body parsing
app.use(cors());
app.use(express.json());

// In-memory database (Resets when the Render server restarts)
let notes = [];

// GET endpoint to retrieve all notes
app.get('/api/notes', (req, res) => {
  res.json(notes);
});

// POST endpoint to add a new note
app.post('/api/notes', (req, res) => {
  const { title, content } = req.body;
  
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required.' });
  }

  const newNote = {
    id: Date.now().toString(),
    title,
    content,
    timestamp: new Date().toLocaleString()
  };

  // Add the newest note to the beginning of the array
  notes.unshift(newNote);
  
  res.status(201).json(newNote);
});

// Start the server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

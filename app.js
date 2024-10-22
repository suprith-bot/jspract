const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

const userRoutes = require('./routes/userRoutes');
const taskRoutes = require('./routes/taskRoutes');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);

// Fallback to index.html for any other routes (for frontend routing if needed)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
// app.get('/', (req, res) => {
//   res.redirect('/login.html');
// });


app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
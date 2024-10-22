// /routes/taskRoutes.js
const express = require('express');
const {
  getAllTasks,
  createTask,
  updateTask,
  markTaskComplete,
  deleteTask,
} = require('../controllers/taskController');
const authMiddleware = require('../middlewares/authMiddlewares');

const router = express.Router();

// Apply auth middleware to all task routes
router.use(authMiddleware.verifyToken);

// GET /api/tasks
router.get('/', getAllTasks);

// POST /api/tasks
router.post('/', createTask);

// PUT /api/tasks/:id
router.put('/:id', updateTask);

// PUT /api/tasks/:id/complete
router.put('/:id/complete', markTaskComplete);

// DELETE /api/tasks/:id
router.delete('/:id', deleteTask);

module.exports = router;

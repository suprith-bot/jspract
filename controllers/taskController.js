
// /controllers/taskController.js
const taskModel = require('../models/taskModel');

// Get all tasks for the logged-in user
const getAllTasks = async (req, res) => {
  const user_id = req.user.id; // From authMiddleware

  try {
    const tasks = await taskModel.getAllTasksByUser(user_id);
    res.json(tasks);
  } catch (error) {
    console.error('Get All Tasks Error:', error);
    res.status(500).json({ error: 'Server error fetching tasks' });
  }
};

// Create a new task for the logged-in user
const createTask = async (req, res) => {
  const { title, description, priority } = req.body;
  const user_id = req.user.id; // From authMiddleware

  try {
    const newTask = await taskModel.createTask(title, description, priority, user_id);
    res.status(201).json(newTask);
  } catch (error) {
    console.error('Create Task Error:', error);
    res.status(500).json({ error: 'Server error creating task' });
  }
};

// Update task details
const updateTask = async (req, res) => {
  const { id } = req.params;
  const { title, description, priority } = req.body;
  const user_id = req.user.id; // From authMiddleware

  try {
    // Verify task ownership
    const tasks = await taskModel.getAllTasksByUser(user_id);
    const task = tasks.find(t => t.id === parseInt(id));
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updatedTask = await taskModel.updateTask(id, title, description, priority);
    res.json(updatedTask);
  } catch (error) {
    console.error('Update Task Error:', error);
    res.status(500).json({ error: 'Server error updating task' });
  }
};

// Mark task as complete
const markTaskComplete = async (req, res) => {
  const { id } = req.params;
  const user_id = req.user.id; // From authMiddleware

  try {
    // Verify task ownership
    const tasks = await taskModel.getAllTasksByUser(user_id);
    const task = tasks.find(t => t.id === parseInt(id));
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const completedTask = await taskModel.markTaskComplete(id);
    res.json(completedTask);
  } catch (error) {
    console.error('Mark Task Complete Error:', error);
    res.status(500).json({ error: 'Server error marking task as complete' });
  }
};

// Delete a task
const deleteTask = async (req, res) => {
  const { id } = req.params;
  const user_id = req.user.id; // From authMiddleware

  try {
    // Verify task ownership
    const tasks = await taskModel.getAllTasksByUser(user_id);
    const task = tasks.find(t => t.id === parseInt(id));
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await taskModel.deleteTask(id);
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete Task Error:', error);
    res.status(500).json({ error: 'Server error deleting task' });
  }
};

module.exports = {
  getAllTasks,
  createTask,
  updateTask,
  markTaskComplete,
  deleteTask,
};

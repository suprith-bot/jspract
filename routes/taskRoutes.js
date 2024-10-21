const express = require('express');
const { getAllTasks} = require('../controllers/taskController');

const router = express.Router();

// GET all tasks
router.get('/', getAllTasks);

// // POST create a new task
// router.post('/', createTask);

// // PUT update a task
// router.put('/:id', updateTask);

// // PUT mark task as complete
// router.put('/:id/complete', markTaskComplete);

// // DELETE a task by ID
// router.delete('/:id', deleteTask);

module.exports = router;

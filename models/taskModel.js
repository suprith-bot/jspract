// /models/taskModel.js
const sql = require('../models/db');


const getAllTasksByUser = async (user_id) => {
  const result = await sql`SELECT * FROM tasks WHERE user_id = ${user_id} ORDER BY created_at DESC`;
    
  return result;
};

const createTask = async (title, description, priority, user_id) => {
  const result = await sql`INSERT INTO tasks (title, description, priority, status, user_id) VALUES (${title}, ${description},${priority}, 'Pending', ${user_id}) RETURNING *`;
  console.log(result);
  return result[0];
};

const updateTask = async (id, title, description, priority) => {
  const result = await sql`UPDATE tasks SET title = ${title}, description = ${description}, priority = ${ priority }, updated_at = CURRENT_TIMESTAMP WHERE id = ${id} RETURNING *`;
  console.log(result)
  return result[0];
};

const markTaskComplete = async (id) => {
  const result = await sql`UPDATE tasks SET status = ${'Completed'}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id} RETURNING *`;
  console.log(result)
  return result[0];
};

const deleteTask = async (id) => {
  await sql`DELETE FROM tasks WHERE id = ${id}`;
};

module.exports = {
  getAllTasksByUser,
  createTask,
  updateTask,
  markTaskComplete,
  deleteTask,
};

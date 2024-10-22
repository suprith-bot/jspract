// /models/userModel.js
const sql = require('../models/db');


const createUser = async (username, email, hashedPassword) => {
  const result = await sql`INSERT INTO users (username, email, password) VALUES (${username}, ${email}, ${hashedPassword}) RETURNING *`;
  console.log(result);
  return result[0];
};

const findUserByEmail = async (email) => {
  const result = await sql`SELECT * FROM users WHERE email = ${email}`;
  console.log(result);
  return result[0];
};

const findUserById = async (id) => {
  const result = await sql`SELECT * FROM users WHERE id = ${id}`;
  console.log(result);
  return result[0];
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
};

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

const updateResetToken=async (userId, resetToken, resetTokenExpiry)=> {
  const query =await sql `
      UPDATE users 
      SET reset_token = ${resetToken}, reset_token_expiry = ${resetTokenExpiry} 
      WHERE id = ${userId} 
      RETURNING *
  `;

  return query[0];
}

const findUserByResetToken=async(token)=> {
  const query = await sql`
      SELECT * FROM users 
      WHERE reset_token = ${token} 
      AND reset_token_expiry > NOW()
  `;
  console.log(query);
  return query[0];
}

const updatePassword=async (userId, hashedPassword)=> {
  const query = await sql `
      UPDATE users 
      SET password = ${hashedPassword}, 
          reset_token = NULL, 
          reset_token_expiry = NULL 
      WHERE id = ${userId} 
      RETURNING *
  `;
  
  return query[0];
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  updateResetToken,findUserByResetToken,updatePassword
};

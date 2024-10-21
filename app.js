require("dotenv").config();
const express=require('express');
const app=express();
const cors = require('cors');
const taskRoutes = require('./routes/taskRoutes');


const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);
// Middleware
app.use(cors());

app.use(express.json());
app.use(express.static('public'));
app.use('/api/tasks', taskRoutes);

// app.get('/',async (req,res)=>{
//   // const result = await sql`SELECT * FROM tasks order by created_at;`;

//   // res.json(result.rows);

//   // res.writeHead(200, { "Content-Type": "application/json" });
//   // res.end(JSON.stringify(result));

// });
// const requestHandler = async (req, res) => {
 
// };

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
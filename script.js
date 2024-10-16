require("dotenv").config();

const http = require("http");
const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);

const requestHandler = async (req, res) => {
  const result = await sql`SELECT * FROM playing_with_neon;`;
  
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result));
};

http.createServer(requestHandler).listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
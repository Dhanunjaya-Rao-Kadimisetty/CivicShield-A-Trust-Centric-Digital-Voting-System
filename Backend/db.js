const { Pool } = require("pg");

const pool = new Pool({
  host: "localhost",
  user: "postgres",        // your DB username
  password: "postgres",
  database: "civic_shield", // your DB name
  port: 5432
});

// Test DB connection
pool.connect()
  .then(() => {
    console.log("PostgreSQL connected successfully");
  })
  .catch((err) => {
    console.error("Database connection error:", err);
  });

module.exports = pool;

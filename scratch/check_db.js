import pg from "pg";
import { config } from "dotenv";
import { join } from "path";

config({ path: join(process.cwd(), ".env") });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

async function check() {
  try {
    const start = Date.now();
    const res = await pool.query("SELECT current_database(), now()");
    console.log("Connected to:", res.rows[0].current_database);
    console.log("Current time:", res.rows[0].now);
    
    const tables = await pool.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
    console.log("Tables in 'public':", tables.rows.map(r => r.tablename).join(", "));
    
    const pbExists = tables.rows.some(r => r.tablename === 'position_bids');
    console.log("position_bids exists:", pbExists);
    
  } catch (e) {
    console.error("Connection failed:", e.message);
  } finally {
    await pool.end();
  }
}

check();

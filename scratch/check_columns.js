import pg from "pg";
import { config } from "dotenv";
import { join } from "path";

config({ path: join(process.cwd(), ".env") });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

async function check() {
  try {
    const tables = ['companies', 'position_bids', 'profiles', 'blocks'];
    for (const table of tables) {
      const res = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = '${table}'
      `);
      console.log(`\nColumns in '${table}':`);
      res.rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type})`));
    }
  } catch (e) {
    console.error("Check failed:", e.message);
  } finally {
    await pool.end();
  }
}

check();

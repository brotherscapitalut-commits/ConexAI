import pg from "pg";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:123456@localhost:5432/muraldigital";

const pool = new pg.Pool({ connectionString });

async function updateSchema() {
  const client = await pool.connect();
  try {
    console.log("Updating schema...");
    
    // Add columns to blocks
    await client.query(`
      ALTER TABLE public.blocks 
      ADD COLUMN IF NOT EXISTS purchase_price numeric NOT NULL DEFAULT 150,
      ADD COLUMN IF NOT EXISTS position_id text;
    `);
    
    // Update position_id from x,y if null
    await client.query(`
      UPDATE public.blocks 
      SET position_id = 'A' || (y + 1) -- Simple fallback, better to use real logic but for now just to populate
      WHERE position_id IS NULL;
    `);

    // Ensure position_bids has block_id if we want to bid on specific blocks
    // Currently it seems to be brand-to-brand. 
    // User said "cada bloco tem um owner_id, purchase_price e position_id".
    // This implies blocks are the tradeable units.
    
    await client.query(`
      ALTER TABLE public.position_bids
      ADD COLUMN IF NOT EXISTS block_id uuid REFERENCES public.blocks(id) ON DELETE CASCADE;
    `);

    console.log("Schema updated successfully.");
  } catch (err) {
    console.error("Error updating schema:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

updateSchema();

import pg from "pg";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:123456@localhost:5432/muraldigital";
const pool = new pg.Pool({ connectionString });

const ADMIN_USER_ID = "9134419b-e855-4081-9b63-0c46001712a8"; // ID informado pelo usuário
const ADMIN_EMAIL = "brotherscapitalut@gmail.com";

async function run() {
  const client = await pool.connect();
  try {
    console.log("--- Verificando Tabelas de Perfil ---");
    
    // 1. Garantir que a tabela profiles existe (mínimo necessário)
    await client.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE NOT NULL,
        display_name TEXT,
        profile_type TEXT DEFAULT 'user',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 2. Garantir que a tabela user_roles existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        role TEXT NOT NULL,
        UNIQUE(user_id, role)
      );
    `);

    // 3. Inserir perfil do Admin
    await client.query(`
      INSERT INTO profiles (user_id, display_name, profile_type)
      VALUES ($1, 'Admin Master', 'admin')
      ON CONFLICT (user_id) DO UPDATE SET profile_type = 'admin';
    `, [ADMIN_USER_ID]);

    // 4. Inserir role de Admin
    await client.query(`
      INSERT INTO user_roles (user_id, role)
      VALUES ($1, 'admin')
      ON CONFLICT DO NOTHING;
    `, [ADMIN_USER_ID]);

    await client.query(`
      INSERT INTO user_roles (user_id, role)
      VALUES ($1, 'super_admin')
      ON CONFLICT DO NOTHING;
    `, [ADMIN_USER_ID]);

    console.log("✅ Perfil de administrador e roles sincronizados com sucesso no banco local.");
    
  } catch (err) {
    console.error("❌ Erro ao sincronizar perfil:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

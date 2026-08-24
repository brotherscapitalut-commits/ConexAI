// src/integrations/supabase/client.ts
import { localDb } from "@/lib/localDbClient";
import type { Database } from "./types";
import { createClient } from "@supabase/supabase-js";

/** 
 * 🔥 BYPASS ESTRUTURAL: 
 * Este arquivo foi travado para usar APENAS o LocalDB.
 * Nenhuma chamada externa ao Supabase Cloud é permitida.
 */
export const supabase = localDb as unknown as ReturnType<typeof createClient<Database>>;
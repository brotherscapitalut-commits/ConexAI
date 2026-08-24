import bcrypt from "bcryptjs";
import { pool } from "./db.js";

const SALT_ROUNDS = 10;

export async function login(email, password) {
  try {
    const { rows } = await pool.query(
      "SELECT id, user_id, email, password_hash, display_name, profile_type FROM public.profiles WHERE email = $1",
      [email]
    );
    const profile = rows[0];
    if (!profile || !profile.password_hash) return null;
    const ok = await bcrypt.compare(password, profile.password_hash);
    if (!ok) return null;
    const uid = profile.user_id ?? profile.id;
    await pool.query("UPDATE public.profiles SET last_login_at = now() WHERE id = $1 OR user_id = $1", [profile.id]);
    return {
      id: uid,
      email: profile.email,
      user_metadata: { display_name: profile.display_name, profile_type: profile.profile_type },
    };
  } catch (err) {
    console.error("[auth] login error:", err.message);
    return null;
  }
}

export async function signUp(email, password, displayName, profileType) {
  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await pool.query(
      `INSERT INTO public.profiles (email, password_hash, display_name, profile_type, is_approved)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, user_id, email, display_name, profile_type`,
      [email, hash, displayName || email, profileType || "company"]
    );
    const p = rows[0];
    if (!p) return null;
    const uid = p.user_id ?? p.id;
    const role = profileType === "influencer" ? "user" : "advertiser";
    await pool.query("INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2::public.app_role)", [uid, role]);
    return {
      id: uid,
      email: p.email,
      user_metadata: { display_name: p.display_name, profile_type: p.profile_type },
    };
  } catch (err) {
    console.error("[auth] signUp error:", err.message);
    return null;
  }
}

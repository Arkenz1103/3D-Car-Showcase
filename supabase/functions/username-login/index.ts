import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { error: "Method not allowed." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(500, { error: "Username sign-in is not configured." });
  }

  try {
    const body = await request.json();
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username) || password.length < 1 || password.length > 256) {
      return jsonResponse(400, { error: "Invalid username or password." });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile, error: lookupError } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();
    if (lookupError || !profile) return jsonResponse(401, { error: "Invalid username/email or password." });

    const { data: userResult, error: userError } = await admin.auth.admin.getUserById(profile.id);
    const email = userResult.user?.email;
    if (userError || !email) return jsonResponse(401, { error: "Invalid username/email or password." });

    // Keep password verification inside Supabase Auth. The service-role key never leaves this function.
    const auth = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signIn, error: signInError } = await auth.auth.signInWithPassword({ email, password });
    if (signInError || !signIn.session) return jsonResponse(401, { error: "Invalid username/email or password." });

    return jsonResponse(200, {
      session: {
        access_token: signIn.session.access_token,
        refresh_token: signIn.session.refresh_token,
      },
    });
  } catch {
    return jsonResponse(400, { error: "Invalid username/email or password." });
  }
});

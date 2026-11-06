import type { User } from "@supabase/supabase-js";
import { mergeGarageSaves, normalizeGarageSave, type GarageSaveData } from "@/lib/garageSave";
import type { PlayerProfile } from "@/lib/playerProfile";
import { supabase, supabaseConfigured } from "@/lib/supabase";

export type AccountProfile = {
  userId: string;
  email: string;
  username: string;
  profile: PlayerProfile;
  saveData: GarageSaveData;
};

export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

function requireSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Cloud accounts are not configured yet. Add the Supabase URL and anon key, then apply the database setup in docs/authentication.md.");
  }
  return supabase;
}

function formatAccount(user: User, row: any): AccountProfile {
  const username = typeof row?.username === "string" ? row.username : String(user.user_metadata?.username ?? "Racer");
  return {
    userId: user.id,
    email: user.email ?? "",
    username,
    profile: {
      displayName: typeof row?.display_name === "string" && row.display_name.trim() ? row.display_name : username,
      level: Number.isInteger(row?.level) ? Math.max(1, Math.min(99, row.level)) : 1,
      rank: typeof row?.rank === "string" ? row.rank.slice(0, 16).toUpperCase() : "ROOKIE",
    },
    saveData: normalizeGarageSave(row?.save_data),
  };
}

export async function checkUsernameAvailability(username: string) {
  if (!USERNAME_PATTERN.test(username)) return false;
  const client = requireSupabase();
  const { data, error } = await client.rpc("is_username_available", { candidate: username.trim() });
  if (error) throw new Error(error.message || "Could not check username availability.");
  return Boolean(data);
}

async function loadAccountForUser(user: User): Promise<AccountProfile> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("profiles")
    .select("username, display_name, level, rank, save_data")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message || "Could not load your cloud profile.");
  if (!data) throw new Error("Your account profile is not ready. Apply the Supabase setup in docs/authentication.md.");
  return formatAccount(user, data);
}

export async function restoreCurrentAccount() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  return data.user ? loadAccountForUser(data.user) : null;
}

export async function signUpAccount(input: {
  username: string;
  email: string;
  password: string;
  saveData: GarageSaveData;
}): Promise<{ account: AccountProfile | null; confirmationRequired: boolean }> {
  const client = requireSupabase();
  const username = input.username.trim();
  if (!USERNAME_PATTERN.test(username)) throw new Error("Use 3–20 letters, numbers, or underscores for the username.");
  if (!(await checkUsernameAvailability(username))) throw new Error(`Username '${username}' is already registered.`);
  const { data, error } = await client.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        username,
        display_name: username,
        level: 1,
        rank: "ROOKIE",
        save_data: normalizeGarageSave(input.saveData),
      },
    },
  });
  if (error) {
    if (/duplicate key|unique/i.test(error.message)) throw new Error(`Username '${username}' is already registered.`);
    throw error;
  }
  if (!data.session || !data.user) return { account: null, confirmationRequired: true };
  return { account: await loadAccountForUser(data.user), confirmationRequired: false };
}

export async function signInAccount(identity: string, password: string) {
  const client = requireSupabase();
  const login = identity.trim();
  if (login.includes("@")) {
    const { data, error } = await client.auth.signInWithPassword({ email: login, password });
    if (error) throw error;
    if (!data.user) throw new Error("Sign in failed. Check your credentials and try again.");
    return loadAccountForUser(data.user);
  }

  const { data, error } = await client.functions.invoke("username-login", {
    body: { username: login, password },
  });
  if (error) throw new Error(error.message || "Username sign-in is unavailable. Deploy the username-login function from docs/authentication.md.");
  const session = data?.session;
  if (!session?.access_token || !session?.refresh_token) throw new Error("Sign in failed. Check your credentials and try again.");
  const { data: sessionData, error: sessionError } = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (sessionError) throw sessionError;
  if (!sessionData.user) throw new Error("Sign in failed. Check your credentials and try again.");
  return loadAccountForUser(sessionData.user);
}

export async function linkGuestProgress(userId: string, guestSave: GarageSaveData) {
  const client = requireSupabase();
  const { data: current, error: readError } = await client
    .from("profiles")
    .select("save_data")
    .eq("id", userId)
    .single();
  if (readError) throw new Error(readError.message || "Could not load the account save before linking.");
  const saveData = mergeGarageSaves(current?.save_data, guestSave);
  const { error } = await client.from("profiles").update({ save_data: saveData }).eq("id", userId);
  if (error) throw new Error(error.message || "Could not attach your guest garage to this account.");
  return saveData;
}

export async function saveAccountProgress(userId: string, profile: PlayerProfile, saveData: GarageSaveData) {
  const client = requireSupabase();
  const { error } = await client
    .from("profiles")
    .update({ display_name: profile.displayName, save_data: normalizeGarageSave(saveData) })
    .eq("id", userId);
  if (error) throw new Error(error.message || "Could not save your cloud progress.");
}

export async function signOutAccount() {
  const client = requireSupabase();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw error;
}

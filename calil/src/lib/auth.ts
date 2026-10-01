import { supabase } from "./supabase";
import { tr } from "./i18n";

/**
 * OAuth providers shown on the login screen. Adding Apple later is a matter of
 * enabling it in Supabase and appending "apple" here.
 */
export const OAUTH_PROVIDERS = ["google"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number] | "apple";

const origin = () => window.location.origin;

export async function signInWithProvider(provider: OAuthProvider) {
  const { error } = await supabase().auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${origin()}/` },
  });
  if (error) throw error;
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase().auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin()}/` },
  });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase().auth.resetPasswordForEmail(email, {
    redirectTo: `${origin()}/reset-password`,
  });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await supabase().auth.updateUser({ password });
  if (error) throw error;
}

/** Permanently deletes the account and all its data (server side), then signs out. */
export async function deleteAccount() {
  const { data } = await supabase().auth.getSession();
  const r = await fetch("/api/account", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
  });
  if (!r.ok) throw new Error(tr("Couldn’t delete the account. Please try again."));
  await supabase().auth.signOut();
}

export async function signOut() {
  await supabase().auth.signOut();
}

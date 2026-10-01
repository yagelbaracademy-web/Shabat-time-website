import { supabase } from "./supabase";

/**
 * Anonymous feature counter: adds one to today's count for `event`.
 * No user id is sent or stored. Fire and forget; never blocks or throws.
 */
export type UsageEvent =
  | "dictate_voice"
  | "dictate_text"
  | "paste_list"
  | "import_file"
  | "swipe_start"
  | "swipe_delete"
  | "reorder_plans"
  | "warmup_set"
  | "rest_custom"
  | "machine_add"
  | "machine_switch"
  | "avatar_upload"
  | "workout_finish"
  | "workout_discard"
  | "pr"
  | "cardio";

export function track(event: UsageEvent) {
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    void supabase()
      .rpc("track", { ev: event })
      .then(
        () => {},
        () => {},
      );
  } catch {}
}

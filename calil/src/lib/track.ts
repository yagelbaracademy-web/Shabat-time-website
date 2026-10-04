import { log } from "./analytics";

/** Outcomes worth knowing beyond a tap (what actually happened). Recorded as "do:<event>". */
export type UsageEvent =
  | "dictate_voice"
  | "dictate_text"
  | "dictate_failed"
  | "dictate_voice_sent"
  | "dictate_voice_edited"
  | "dictate_voice_cleared"
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
  | "cardio"
  | "plan_days"
  | "repeat_workout"
  | "habit_pin";

export function track(event: UsageEvent) {
  try {
    log(`do:${event}`);
  } catch {}
}

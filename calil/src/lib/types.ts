// Row types mirror the Postgres tables 1:1 (snake_case) so the sync layer can
// send local rows to Supabase without any mapping.

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "cable"
  | "machine"
  | "bodyweight"
  | "kettlebell"
  | "other";

export interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  weight_unit: "kg" | "lb";
  rest_timer_enabled: boolean;
  default_rest_seconds: number;
  dictation_lang: string;
  /** Interface language. */
  language: "en" | "he";
  /** Hebrew form of address: neutral plural (default), masculine or feminine. */
  address: "neutral" | "m" | "f";
  /** Show built-in exercise names in Hebrew (display only). */
  exercise_names: "en" | "he";
  /** Rest time the user picked per exercise, in seconds (0 = no timer). */
  rest_by_exercise: Record<string, number>;
  /** Version of the terms/privacy policy accepted, and when (consent record). */
  terms_version: string | null;
  terms_accepted_at: string | null;
  created_at: string;
}

export interface Exercise {
  id: string;
  user_id: string | null; // null = built-in
  name: string;
  muscle_group: string | null;
  equipment: Equipment | null;
  /** What the user calls it ("the yellow row machine"); used by search and dictation. */
  aliases: string[];
  created_at: string;
}

/** A user's own name for any exercise, including shared built-ins. */
export interface ExerciseAlias {
  id: string;
  user_id: string;
  exercise_id: string;
  alias: string;
  created_at: string;
}

export interface WorkoutTemplate {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  /** User-chosen order (drag to reorder); null falls back to creation date. */
  position?: number | null;
  /** Fixed training days, 0 = Sunday … 6 = Saturday. Empty or missing = rotation. */
  weekdays?: number[] | null;
}

export interface TemplateExercise {
  id: string;
  template_id: string;
  exercise_id: string;
  position: number;
  target_sets: number | null;
  rep_min: number | null;
  rep_max: number | null;
  default_rest_seconds: number | null;
  /** Starting weight, used to prefill until there's history. */
  target_weight?: number | null;
  /** Cardio: time goal in minutes (instead of sets × reps). */
  target_minutes?: number | null;
  /** Coach notes: tempo, RPE, set type, setup. */
  note: string | null;
}

export interface Workout {
  id: string;
  user_id: string;
  template_id: string | null;
  name: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  overall_note: string | null;
  /** Set once, when the first set is ticked; unticking doesn't reset it. */
  clock_started_at?: string | null;
  paused_at?: string | null;
  paused_seconds?: number;
}

export interface WorkoutExercise {
  id: string;
  workout_id: string;
  exercise_id: string;
  position: number;
}

export interface WorkoutSet {
  id: string;
  workout_exercise_id: string;
  set_number: number;
  weight: number | null;
  reps: number | null;
  completed: boolean;
  /** Warm-up set: kept in the log, left out of records, volume and progress. */
  is_warmup?: boolean;
  /** Cardio: how long and how far (km, or miles for lb users). */
  duration_seconds?: number | null;
  distance?: number | null;
  note: string | null;
  completed_at: string | null;
}

export interface Tables {
  exercises: Exercise;
  exercise_aliases: ExerciseAlias;
  workout_templates: WorkoutTemplate;
  template_exercises: TemplateExercise;
  workouts: Workout;
  workout_exercises: WorkoutExercise;
  sets: WorkoutSet;
  profiles: Profile;
}

export type TableName = keyof Tables;

/** Tables that are stored as id → row maps in the local store. */
export type CollectionName = Exclude<TableName, "profiles">;

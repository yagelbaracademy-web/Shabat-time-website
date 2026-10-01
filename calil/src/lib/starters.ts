import type { Equipment } from "./types";

export interface StarterPlan {
  slug: string;
  name: string;
  focus: string;
  minutes: number;
  icon: Equipment;
  exercises: { name: string; sets: number; min: number; max: number; rest?: number }[];
}

/** Starter routines built from the built-in exercise library (matched by name). */
export const STARTER_PLANS: StarterPlan[] = [
  {
    slug: "push",
    name: "Push",
    focus: "Chest, shoulders, triceps",
    minutes: 45,
    icon: "barbell",
    exercises: [
      { name: "Bench Press", sets: 4, min: 6, max: 10, rest: 150 },
      { name: "Overhead Press", sets: 3, min: 6, max: 10, rest: 120 },
      { name: "Incline Dumbbell Press", sets: 3, min: 8, max: 12 },
      { name: "Lateral Raise", sets: 3, min: 12, max: 15, rest: 60 },
      { name: "Triceps Pushdown", sets: 3, min: 10, max: 12, rest: 60 },
    ],
  },
  {
    slug: "pull",
    name: "Pull",
    focus: "Back, biceps, rear delts",
    minutes: 45,
    icon: "cable",
    exercises: [
      { name: "Pull-up", sets: 3, min: 5, max: 10, rest: 120 },
      { name: "Barbell Row", sets: 4, min: 6, max: 10, rest: 120 },
      { name: "Lat Pulldown", sets: 3, min: 10, max: 12 },
      { name: "Face Pull", sets: 3, min: 12, max: 15, rest: 60 },
      { name: "Dumbbell Curl", sets: 3, min: 10, max: 12, rest: 60 },
    ],
  },
  {
    slug: "legs",
    name: "Legs",
    focus: "Quads, hamstrings, glutes",
    minutes: 50,
    icon: "barbell",
    exercises: [
      { name: "Squat", sets: 4, min: 5, max: 8, rest: 180 },
      { name: "Romanian Deadlift", sets: 3, min: 8, max: 10, rest: 120 },
      { name: "Leg Press", sets: 3, min: 10, max: 12 },
      { name: "Leg Curl", sets: 3, min: 10, max: 12, rest: 60 },
      { name: "Bulgarian Split Squat", sets: 3, min: 8, max: 10 },
      { name: "Calf Raise", sets: 3, min: 12, max: 15, rest: 60 },
    ],
  },
  {
    slug: "full-body",
    name: "Full Body",
    focus: "A balanced, total body workout",
    minutes: 45,
    icon: "kettlebell",
    exercises: [
      { name: "Squat", sets: 3, min: 6, max: 8, rest: 150 },
      { name: "Bench Press", sets: 3, min: 6, max: 10, rest: 120 },
      { name: "Seated Cable Row", sets: 3, min: 8, max: 12 },
      { name: "Romanian Deadlift", sets: 3, min: 8, max: 10 },
      { name: "Dumbbell Shoulder Press", sets: 2, min: 8, max: 12 },
      { name: "Dumbbell Curl", sets: 2, min: 10, max: 12, rest: 60 },
      { name: "Triceps Pushdown", sets: 2, min: 10, max: 12, rest: 60 },
      { name: "Plank", sets: 2, min: 30, max: 60, rest: 60 },
    ],
  },
];

export const MUSCLE_GROUPS = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Legs",
  "Glutes",
  "Calves",
  "Core",
  "Cardio",
  "Full body",
];

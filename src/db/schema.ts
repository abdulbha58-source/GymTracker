import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  real,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const workoutDays = pgTable("workout_days", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const exercises = pgTable(
  "exercises",
  {
    id: serial("id").primaryKey(),
    workoutDayId: integer("workout_day_id")
      .notNull()
      .references(() => workoutDays.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    notes: text("notes"),
    targetSets: integer("target_sets"),
    targetReps: integer("target_reps"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    dayIdx: index("exercises_workout_day_id_idx").on(t.workoutDayId),
  }),
);

export const workoutSessions = pgTable(
  "workout_sessions",
  {
    id: serial("id").primaryKey(),
    date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    workoutDayId: integer("workout_day_id")
      .notNull()
      .references(() => workoutDays.id, { onDelete: "cascade" }),
    notes: text("notes"),
  },
  (t) => ({
    dayIdx: index("workout_sessions_workout_day_id_idx").on(t.workoutDayId),
    dateIdx: index("workout_sessions_date_idx").on(t.date),
  }),
);

export const exerciseSets = pgTable(
  "exercise_sets",
  {
    id: serial("id").primaryKey(),
    workoutSessionId: integer("workout_session_id")
      .notNull()
      .references(() => workoutSessions.id, { onDelete: "cascade" }),
    exerciseId: integer("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    setNumber: integer("set_number").notNull(),
    weight: real("weight").notNull(),
    reps: integer("reps").notNull(),
  },
  (t) => ({
    sessionIdx: index("exercise_sets_session_id_idx").on(t.workoutSessionId),
    exerciseIdx: index("exercise_sets_exercise_id_idx").on(t.exerciseId),
  }),
);

export const workoutDaysRelations = relations(workoutDays, ({ many }) => ({
  exercises: many(exercises),
  sessions: many(workoutSessions),
}));

export const exercisesRelations = relations(exercises, ({ one, many }) => ({
  workoutDay: one(workoutDays, {
    fields: [exercises.workoutDayId],
    references: [workoutDays.id],
  }),
  sets: many(exerciseSets),
}));

export const workoutSessionsRelations = relations(
  workoutSessions,
  ({ one, many }) => ({
    workoutDay: one(workoutDays, {
      fields: [workoutSessions.workoutDayId],
      references: [workoutDays.id],
    }),
    sets: many(exerciseSets),
  }),
);

export const exerciseSetsRelations = relations(exerciseSets, ({ one }) => ({
  session: one(workoutSessions, {
    fields: [exerciseSets.workoutSessionId],
    references: [workoutSessions.id],
  }),
  exercise: one(exercises, {
    fields: [exerciseSets.exerciseId],
    references: [exercises.id],
  }),
}));

export type WorkoutDay = typeof workoutDays.$inferSelect;
export type NewWorkoutDay = typeof workoutDays.$inferInsert;
export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;
export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type NewWorkoutSession = typeof workoutSessions.$inferInsert;
export type ExerciseSet = typeof exerciseSets.$inferSelect;
export type NewExerciseSet = typeof exerciseSets.$inferInsert;

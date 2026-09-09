import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const interviewSessions = mysqlTable("interview_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  role: varchar("role", { length: 120 }).notNull(),
  level: mysqlEnum("level", ["foundation", "practitioner", "advanced"]).notNull(),
  focus: varchar("focus", { length: 120 }).notNull(),
  status: mysqlEnum("status", ["active", "completed"]).default("active").notNull(),
  questionCount: int("questionCount").notNull().default(5),
  score: int("score"),
  strengths: text("strengths"),
  improvements: text("improvements"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export const interviewQuestions = mysqlTable("interview_questions", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  position: int("position").notNull(),
  prompt: text("prompt").notNull(),
  answer: text("answer"),
  score: int("score"),
  feedback: text("feedback"),
  idealAnswer: text("idealAnswer"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type InterviewSession = typeof interviewSessions.$inferSelect;
export type InterviewQuestion = typeof interviewQuestions.$inferSelect;

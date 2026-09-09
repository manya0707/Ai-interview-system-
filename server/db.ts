import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, interviewQuestions, interviewSessions, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getInterviewHistory(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(interviewSessions).where(eq(interviewSessions.userId, userId)).orderBy(desc(interviewSessions.createdAt)).limit(12);
}

export async function getInterviewSession(sessionId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const sessions = await db.select().from(interviewSessions).where(and(eq(interviewSessions.id, sessionId), eq(interviewSessions.userId, userId))).limit(1);
  if (!sessions[0]) return undefined;
  const questions = await db.select().from(interviewQuestions).where(eq(interviewQuestions.sessionId, sessionId)).orderBy(interviewQuestions.position);
  return { session: sessions[0], questions };
}

export async function createInterviewSession(input: {
  userId: number;
  role: string;
  level: "foundation" | "practitioner" | "advanced";
  focus: string;
  questions: Array<{ prompt: string; idealAnswer?: string }>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const inserted = await db.insert(interviewSessions).values({
    userId: input.userId,
    role: input.role,
    level: input.level,
    focus: input.focus,
    questionCount: input.questions.length,
  });
  const sessionId = Number(inserted[0].insertId);
  await db.insert(interviewQuestions).values(input.questions.map((question, index) => ({
    sessionId,
    position: index + 1,
    prompt: question.prompt,
    idealAnswer: question.idealAnswer ?? null,
  })));
  return getInterviewSession(sessionId, input.userId);
}

export async function saveQuestionEvaluation(input: { sessionId: number; questionId: number; answer: string; score: number; feedback: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(interviewQuestions).set({ answer: input.answer, score: input.score, feedback: input.feedback }).where(and(eq(interviewQuestions.id, input.questionId), eq(interviewQuestions.sessionId, input.sessionId)));
}

export async function completeInterview(input: { sessionId: number; userId: number; score: number; strengths: string[]; improvements: string[] }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(interviewSessions).set({ status: "completed", score: input.score, strengths: JSON.stringify(input.strengths), improvements: JSON.stringify(input.improvements), completedAt: new Date() }).where(and(eq(interviewSessions.id, input.sessionId), eq(interviewSessions.userId, input.userId)));
  return getInterviewSession(input.sessionId, input.userId);
}

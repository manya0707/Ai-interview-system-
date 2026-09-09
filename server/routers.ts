import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { completeInterview, createInterviewSession, getInterviewHistory, getInterviewSession, saveQuestionEvaluation } from "./db";

const levelSchema = z.enum(["foundation", "practitioner", "advanced"]);
const questionSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: { prompt: { type: "string" }, idealAnswer: { type: "string" } },
        required: ["prompt", "idealAnswer"],
        additionalProperties: false,
      },
      minItems: 5,
      maxItems: 5,
    },
  },
  required: ["questions"],
  additionalProperties: false,
} as const;
const evaluationSchema = {
  type: "object",
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    feedback: { type: "string" },
    strengths: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
    improvements: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
  },
  required: ["score", "feedback", "strengths", "improvements"],
  additionalProperties: false,
} as const;

const fallbackQuestions = (role: string, focus: string, level: string) => [
  { prompt: `Give us your two-minute introduction and connect your experience to a ${role} role.`, idealAnswer: "A concise story that connects past experience, relevant skills, and motivation for the role." },
  { prompt: `Tell me about a ${level === "foundation" ? "project or challenge" : "high-impact situation"} where you used ${focus.toLowerCase()}. What did you do and what changed?`, idealAnswer: "A structured STAR answer with a clear personal contribution and measurable outcome." },
  { prompt: `What is one trade-off or difficult decision you would expect to face as a ${role}?`, idealAnswer: "A thoughtful trade-off, explicit assumptions, and a practical way to validate the decision." },
  { prompt: "Describe a time you received difficult feedback. How did you respond?", idealAnswer: "Ownership, specific behavior change, and evidence that the feedback improved future results." },
  { prompt: `Why this ${role} path, and what would you want to learn in your first 90 days?`, idealAnswer: "A role-specific motivation with a realistic learning plan and clear contribution goals." },
];

function textFromResponse(response: Awaited<ReturnType<typeof invokeLLM>>) {
  const content = response.choices[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

async function generateQuestions(role: string, focus: string, level: string) {
  try {
    const response = await invokeLLM({
      model: "gemini-3-flash-preview",
      messages: [
        { role: "system", content: "You are a rigorous but encouraging interview coach. Generate realistic questions for one candidate. Return only valid JSON matching the schema." },
        { role: "user", content: `Create exactly 5 interview questions for the ${role} role. Level: ${level}. Focus area: ${focus}. Include a short ideal-answer rubric for each. Mix behavioral, role-specific, and scenario questions.` },
      ],
      response_format: { type: "json_schema", json_schema: { name: "interview_questions", strict: true, schema: questionSchema } },
      maxTokens: 2200,
    });
    const parsed = JSON.parse(textFromResponse(response)) as { questions: Array<{ prompt: string; idealAnswer: string }> };
    if (parsed.questions?.length === 5) return parsed.questions;
  } catch (error) {
    console.warn("[InterviewLab] Falling back to local question bank:", error);
  }
  return fallbackQuestions(role, focus, level);
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  interviews: router({
    history: protectedProcedure.query(({ ctx }) => getInterviewHistory(ctx.user.id)),
    get: protectedProcedure.input(z.object({ sessionId: z.number().int().positive() })).query(({ ctx, input }) => getInterviewSession(input.sessionId, ctx.user.id)),
    start: protectedProcedure.input(z.object({ role: z.string().min(2).max(120), level: levelSchema, focus: z.string().min(2).max(120) })).mutation(async ({ ctx, input }) => {
      const questions = await generateQuestions(input.role, input.focus, input.level);
      const session = await createInterviewSession({ userId: ctx.user.id, ...input, questions });
      return session;
    }),
    evaluate: protectedProcedure.input(z.object({ sessionId: z.number().int().positive(), questionId: z.number().int().positive(), prompt: z.string(), answer: z.string().min(2).max(6000), idealAnswer: z.string().optional() })).mutation(async ({ ctx, input }) => {
      const owned = await getInterviewSession(input.sessionId, ctx.user.id);
      if (!owned) throw new Error("Interview session not found");
      let evaluation: { score: number; feedback: string; strengths: string[]; improvements: string[] };
      try {
        const response = await invokeLLM({
          model: "gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are an expert interview evaluator. Be specific, fair, and constructive. Score the answer against the question and rubric. Return only valid JSON." },
            { role: "user", content: `Question: ${input.prompt}\nCandidate answer: ${input.answer}\nIdeal rubric: ${input.idealAnswer ?? "Use strong structure, relevance, ownership, and evidence."}` },
          ],
          response_format: { type: "json_schema", json_schema: { name: "answer_evaluation", strict: true, schema: evaluationSchema } },
          maxTokens: 1800,
        });
        evaluation = JSON.parse(textFromResponse(response)) as typeof evaluation;
      } catch (error) {
        console.warn("[InterviewLab] Falling back to heuristic evaluation:", error);
        const hasStructure = /because|result|impact|learn|action|situation|challenge/i.test(input.answer);
        const lengthBonus = Math.min(20, Math.floor(input.answer.length / 180) * 5);
        evaluation = { score: Math.min(92, 52 + lengthBonus + (hasStructure ? 16 : 0)), feedback: "You addressed the prompt. Add a clearer structure, your specific contribution, and evidence of the result to make the answer more persuasive.", strengths: ["You responded directly to the question."], improvements: ["Use a concise STAR structure.", "Add a measurable outcome or concrete example."] };
      }
      await saveQuestionEvaluation({ sessionId: input.sessionId, questionId: input.questionId, answer: input.answer, score: evaluation.score, feedback: JSON.stringify({ feedback: evaluation.feedback, strengths: evaluation.strengths, improvements: evaluation.improvements }) });
      return evaluation;
    }),
    complete: protectedProcedure.input(z.object({ sessionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const interview = await getInterviewSession(input.sessionId, ctx.user.id);
      if (!interview) throw new Error("Interview session not found");
      const answered = interview.questions.filter(question => question.score !== null);
      const score = answered.length ? Math.round(answered.reduce((total, question) => total + (question.score ?? 0), 0) / answered.length) : 0;
      const strengths = score >= 80 ? ["Clear communication", "Strong role alignment", "Good use of examples"] : ["You completed the full practice round", "You showed willingness to reflect", "You have a clear baseline to build on"];
      const improvements = score >= 80 ? ["Make your strongest examples even more concise", "Quantify impact wherever possible", "Practice handling follow-up questions"] : ["Use the STAR structure more consistently", "Bring more specific evidence into answers", "Practice out loud to improve confidence and pacing"];
      return completeInterview({ sessionId: input.sessionId, userId: ctx.user.id, score, strengths, improvements });
    }),
  }),
});

export type AppRouter = typeof appRouter;

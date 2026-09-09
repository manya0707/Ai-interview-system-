import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function unauthenticatedContext(): TrpcContext {
  return {
    user: undefined,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("interviews", () => {
  it("requires authentication to read interview history", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext());
    await expect(caller.interviews.history()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requires authentication to start a practice loop", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext());
    await expect(caller.interviews.start({ role: "Software Engineer", level: "foundation", focus: "Communication" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

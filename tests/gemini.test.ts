import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@google/genai";
import { explain } from "../src/lib/server/gemini";
import { makeDemo, demoQuestion } from "../src/lib/demo";
import { demoAnswer, retrieve } from "../src/lib/retrieval";

const provider = vi.hoisted(() => ({ generate: vi.fn(), options: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    constructor(options: unknown) {
      provider.options(options);
    }
    models = { generateContent: provider.generate };
  },
  ThinkingLevel: { LOW: "LOW" },
  ApiError: class extends Error {
    status: number;
    constructor({ status, message }: { status: number; message: string }) {
      super(message);
      this.status = status;
    }
  },
}));
const context = retrieve(makeDemo(), demoQuestion);
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GEMINI_API_KEY", "test-server-key");
  vi.stubEnv("GEMINI_MODEL", "gemini-3.6-flash");
});
describe("Gemini provider boundary", () => {
  it("uses bounded low-thinking requests and validates the live response", async () => {
    const answer = demoAnswer(context);
    provider.generate.mockResolvedValue({ text: JSON.stringify(answer) });
    expect(await explain(demoQuestion, context)).toEqual(answer);
    expect(provider.options).toHaveBeenCalledWith(
      expect.objectContaining({
        httpOptions: expect.objectContaining({
          timeout: 60000,
          retryOptions: expect.objectContaining({ attempts: 2 }),
        }),
      }),
    );
    expect(provider.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          thinkingConfig: { thinkingLevel: "LOW" },
          maxOutputTokens: 4000,
          abortSignal: expect.any(AbortSignal),
        }),
      }),
    );
  });
  it("turns request timeouts into a retryable explanation error", async () => {
    provider.generate.mockRejectedValue(
      new DOMException("secret-provider-request", "AbortError"),
    );
    await expect(explain(demoQuestion, context)).rejects.toMatchObject({
      status: 504,
      message: expect.stringContaining("took too long"),
    });
  });
  it.each([
    [429, 429, "quota"],
    [403, 503, "API key"],
    [404, 503, "model"],
    [503, 503, "temporarily unavailable"],
  ])(
    "sanitizes provider HTTP %i errors",
    async (providerStatus, status, text) => {
      provider.generate.mockRejectedValue(
        new ApiError({
          status: Number(providerStatus),
          message: "secret-provider-body",
        }),
      );
      await expect(explain(demoQuestion, context)).rejects.toMatchObject({
        status,
        message: expect.stringContaining(String(text)),
      });
    },
  );
  it("rejects unsupported citations returned by the provider", async () => {
    const answer = demoAnswer(context);
    answer.connection.recordIds = ["another-project-record"];
    provider.generate.mockResolvedValue({ text: JSON.stringify(answer) });
    await expect(explain(demoQuestion, context)).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining("unsupported citation"),
    });
  });
});

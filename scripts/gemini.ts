import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { makeDemo, demoQuestion } from "../src/lib/demo";
import { retrieve } from "../src/lib/retrieval";
import { explain } from "../src/lib/server/gemini";
import { AppError } from "../src/lib/server/errors";
import { ApiError } from "@google/genai";
async function main() {
  const context = retrieve(makeDemo("live-provider-check"), demoQuestion);
  const answer = await explain(demoQuestion, context);
  console.log(
    `Gemini structured explanation verified: ${answer.facts.length} facts, ${answer.supportingEdgeIds.length} valid graph citations. Synthetic context only.`,
  );
}
main().catch((error) => {
  const details = error as {
    name?: string;
    cause?: { code?: string };
    message?: string;
  };
  const networkCode = details.cause?.code;
  console.error("Provider diagnostic:", {
    errorType: details.name,
    networkCode:
      networkCode && /^[A-Z0-9_]+$/.test(networkCode) ? networkCode : undefined,
    timeout: /timeout|timed out|abort/i.test(details.message || ""),
    fetchFailure: /fetch failed/i.test(details.message || ""),
  });
  console.error(
    error instanceof AppError
      ? error.message
      : error instanceof ApiError
        ? `Gemini request failed with HTTP ${error.status}. Check model availability, credentials, or quota.`
        : "Gemini request failed. Check the configured key, model availability, quota, and network access.",
  );
  process.exitCode = 1;
});

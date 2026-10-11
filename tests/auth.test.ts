import { it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), initialize: vi.fn() }));
vi.mock("firebase-admin/app", () => ({
  cert: vi.fn(),
  getApps: () => [],
  initializeApp: mocks.initialize,
}));
vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken: mocks.verify }),
}));
import { identity } from "../src/lib/server/auth";
beforeEach(() => {
  vi.stubEnv("FIREBASE_ADMIN_PROJECT_ID", "test");
  vi.stubEnv("FIREBASE_ADMIN_CLIENT_EMAIL", "test@example.com");
  vi.stubEnv("FIREBASE_ADMIN_PRIVATE_KEY", "test-only");
  mocks.verify.mockReset();
});
it("derives the UID exclusively from a verified and non-revoked Firebase token", async () => {
  mocks.verify.mockResolvedValue({ uid: "verified-user" });
  const request = new Request("http://localhost/api/projects?userId=attacker", {
    headers: { Authorization: "Bearer valid-token", "X-User-Id": "attacker" },
  });
  expect(await identity(request)).toBe("verified-user");
  expect(mocks.verify).toHaveBeenCalledWith("valid-token", true);
});
it("rejects absent, invalid, and revoked tokens", async () => {
  await expect(
    identity(new Request("http://localhost/api/projects")),
  ).rejects.toMatchObject({ status: 401 });
  mocks.verify.mockRejectedValue(new Error("revoked token secret"));
  await expect(
    identity(
      new Request("http://localhost/api/projects", {
        headers: { Authorization: "Bearer revoked" },
      }),
    ),
  ).rejects.toMatchObject({
    status: 401,
    message: "Your sign-in could not be verified. Sign in again.",
  });
});

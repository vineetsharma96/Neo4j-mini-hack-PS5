import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { AppError } from "./errors";
export async function identity(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.{1,8000})$/)?.[1];
  if (!token) throw new AppError(401, "Sign in to access project memory.");
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey)
    throw new AppError(
      503,
      "Configure Firebase Admin credentials on the server, then restart the app.",
    );
  const app =
    getApps()[0] ||
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  try {
    return (await getAuth(app).verifyIdToken(token, true)).uid;
  } catch {
    throw new AppError(
      401,
      "Your sign-in could not be verified. Sign in again.",
    );
  }
}

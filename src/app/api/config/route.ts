export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({
    firebaseAdmin: !!(
      process.env.FIREBASE_ADMIN_PROJECT_ID &&
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
      process.env.FIREBASE_ADMIN_PRIVATE_KEY
    ),
    neo4j: !!(
      process.env.NEO4J_URI &&
      process.env.NEO4J_USERNAME &&
      process.env.NEO4J_PASSWORD
    ),
    gemini: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL),
  });
}

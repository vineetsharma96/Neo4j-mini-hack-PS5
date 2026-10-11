import neo4j, { type ManagedTransaction } from "neo4j-driver";
import { AppError } from "./errors";
let driver: ReturnType<typeof neo4j.driver> | undefined;
export function getDriver() {
  const {
    NEO4J_URI: uri,
    NEO4J_USERNAME: username,
    NEO4J_PASSWORD: password,
  } = process.env;
  if (!uri || !username || !password)
    throw new AppError(
      503,
      "Configure NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD on the server.",
    );
  return (driver ||= neo4j.driver(uri, neo4j.auth.basic(username, password), {
    connectionTimeout: 10000,
    maxTransactionRetryTime: 10000,
    connectionAcquisitionTimeout: 10000,
  }));
}
export async function transaction<T>(
  write: boolean,
  work: (tx: ManagedTransaction) => Promise<T>,
) {
  const session = getDriver().session({
    database: process.env.NEO4J_DATABASE || "neo4j",
  });
  try {
    return await (write
      ? session.executeWrite(work)
      : session.executeRead(work));
  } finally {
    await session.close();
  }
}
export const schema = [
  "CREATE CONSTRAINT tracereason_user_uid IF NOT EXISTS FOR (n:TraceReasonUser) REQUIRE n.firebaseUid IS UNIQUE",
  "CREATE CONSTRAINT tracereason_project_id IF NOT EXISTS FOR (n:TraceReasonProject) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT tracereason_record_id IF NOT EXISTS FOR (n:TraceReasonRecord) REQUIRE n.id IS UNIQUE",
  "CREATE INDEX tracereason_record_project IF NOT EXISTS FOR (n:TraceReasonRecord) ON (n.projectId)",
  "CREATE INDEX tracereason_record_kind IF NOT EXISTS FOR (n:TraceReasonRecord) ON (n.projectId, n.kind)",
];

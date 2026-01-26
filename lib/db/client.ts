// Neon Database client configuration
import { neon, neonConfig, NeonQueryFunction } from '@neondatabase/serverless';

// Enable connection pooling for serverless
neonConfig.fetchConnectionCache = true;

// Create SQL query function
export const sql = neon(process.env.DATABASE_URL!);

// Type for the sql function
export type SqlClient = NeonQueryFunction<false, false>;

// Helper for transactions (note: Neon serverless has limited transaction support)
// For full transaction support, consider using @neondatabase/serverless with WebSocket
export async function withTransaction<T>(
  callback: (sql: SqlClient) => Promise<T>
): Promise<T> {
  // For serverless, we run queries sequentially
  // True transactions require WebSocket connection
  return callback(sql);
}

// Neon Database client configuration
import { neon, neonConfig } from '@neondatabase/serverless';

// Enable connection pooling for serverless
neonConfig.fetchConnectionCache = true;

// Create SQL query function
export const sql = neon(process.env.DATABASE_URL!);

// Helper for transactions
export async function withTransaction<T>(
  callback: (sql: typeof import('@neondatabase/serverless').neon) => Promise<T>
): Promise<T> {
  const client = neon(process.env.DATABASE_URL!);
  try {
    await client`BEGIN`;
    const result = await callback(client);
    await client`COMMIT`;
    return result;
  } catch (error) {
    await client`ROLLBACK`;
    throw error;
  }
}

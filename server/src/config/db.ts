import { Pool } from "pg";
import { env } from "./env";

export const db = new Pool({
  connectionString: env.DATABASE_URL,
});

export const connectDB = async () => {
  const client = await db.connect();

  try {
    const result = await client.query("SELECT NOW()");
    return result.rows[0];
  } finally {
    client.release();
  }
};

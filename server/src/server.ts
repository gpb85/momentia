import app from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { connectDB } from "./config/db";

const PORT = Number(env.PORT);

const startServer = async () => {
  try {
    const dbResult = await connectDB();
    logger.info(`Database connected at ${dbResult.now}`);

    app.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error(error, "failed to start server");
    process.exit(1);
  }
};

startServer();

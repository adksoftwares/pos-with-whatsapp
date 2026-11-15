import app from './app';
import { env } from './config/env';
import { ensurePostgres } from './db/ensureDb';

const startServer = async () => {
  try {
    await ensurePostgres();
    
    app.listen(env.PORT, () => {
      console.log(`🚀 Server is running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

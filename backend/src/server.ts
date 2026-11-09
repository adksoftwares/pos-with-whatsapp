import app from './app';
import { env } from './config/env';

const startServer = async () => {
  try {
    // Here we can initialize database connection (Prisma) before starting
    
    app.listen(env.PORT, () => {
      console.log(`🚀 Server is running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

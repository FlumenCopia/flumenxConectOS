import app from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/db';
import { logger } from './config/logger';

const startServer = async () => {
  // Connect to MongoDB
  await connectDatabase();

  const server = app.listen(env.PORT, () => {
    logger.info(`==================================================`);
    logger.info(`🚀 flumenxConectOS API Server running`);
    logger.info(`   Port: http://localhost:${env.PORT}`);
    logger.info(`   Environment: ${env.NODE_ENV}`);
    logger.info(`   Health endpoint: http://localhost:${env.PORT}/api/v1/health`);
    logger.info(`==================================================`);
  });

  const handleShutdown = async (signal: string) => {
    logger.info(`${signal} received. Initiating graceful shutdown...`);
    server.close(async () => {
      logger.info('HTTP server closed.');
      await disconnectDatabase();
      process.exit(0);
    });

    // Force exit if hanging after 10 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  process.on('unhandledRejection', (reason: any) => {
    logger.error('Unhandled Promise Rejection:', reason);
  });

  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });
};

startServer();

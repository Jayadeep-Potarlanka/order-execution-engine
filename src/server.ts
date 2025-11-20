import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { config } from './config';
import { OrderQueueService } from './services/order-queue.service';
import { WebSocketService } from './services/websocket.service';
import { OrderProcessorWorker } from './workers/order-processor.worker';
import { Database } from './database/db';
import { orderRoutes } from './routes/order.routes';

async function start() {
  const fastify = Fastify({
    logger: {
      level: 'info',
    },
  });

  // Register CORS plugin - IMPORTANT: Must be before other routes
  await fastify.register(cors, {
    origin: true, // Allow all origins for development
    credentials: true,
  });

  // Register WebSocket plugin
  await fastify.register(websocket);

  // Initialize services
  console.log('🚀 Initializing services...');
  const db = new Database();
  const queueService = new OrderQueueService();
  const wsService = new WebSocketService();
  const worker = new OrderProcessorWorker(wsService, db);

  // Register routes
  await fastify.register(async (instance) => {
    await orderRoutes(instance, queueService, wsService, db);
  });

  // Health check
  fastify.get('/health', async () => {
    return { status: 'healthy', timestamp: new Date() };
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await worker.close();
    await queueService.close();
    await fastify.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Start server
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 Server listening on port ${config.port}`);
    console.log(`📊 Queue concurrency: ${config.queue.concurrency}`);
    console.log(`🔄 Max retries: ${config.queue.maxRetries}`);
    console.log(`${'='.repeat(60)}\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();

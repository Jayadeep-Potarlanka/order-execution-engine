import { Queue, QueueOptions } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config';
import { Order } from '../types/order.types';

export class OrderQueueService {
  private queue: Queue;
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      maxRetriesPerRequest: null,
    });

    const queueOptions: QueueOptions = {
      connection: this.redis,
      defaultJobOptions: {
        attempts: config.queue.maxRetries,
        backoff: {
          type: 'exponential',
          delay: config.queue.retryDelay,
        },
        removeOnComplete: {
          count: 1000,
        },
        removeOnFail: {
          count: 5000,
        },
      },
    };

    this.queue = new Queue('orders', queueOptions);
    console.log('✅ Order queue initialized');
  }

  async addOrder(order: Order): Promise<void> {
    await this.queue.add('process-order', order, {
      jobId: order.orderId,
    });
    console.log(`📥 Order queued: ${order.orderId}`);
  }

  async getQueueMetrics() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }

  getQueue(): Queue {
    return this.queue;
  }

  async close(): Promise<void> {
    await this.queue.close();
    await this.redis.quit();
  }
}

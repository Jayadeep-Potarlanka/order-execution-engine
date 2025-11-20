import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config';
import { Order, OrderStatus } from '../types/order.types';
import { DexRouterService } from '../services/dex-router.service';
import { WebSocketService } from '../services/websocket.service';
import { Database } from '../database/db';

export class OrderProcessorWorker {
  private worker: Worker;
  private dexRouter: DexRouterService;
  private wsService: WebSocketService;
  private db: Database;

  constructor(wsService: WebSocketService, db: Database) {
    this.dexRouter = new DexRouterService();
    this.wsService = wsService;
    this.db = db;

    const connection = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker(
      'orders',
      async (job: Job<Order>) => this.processOrder(job),
      {
        connection,
        concurrency: config.queue.concurrency,
      }
    );

    this.setupEventHandlers();
    console.log(`✅ Worker started with concurrency: ${config.queue.concurrency}`);
  }

  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      console.log(`✅ Job completed: ${job.id}`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`❌ Job failed: ${job?.id}`, err.message);
    });
  }

  private async processOrder(job: Job<Order>): Promise<void> {
    const order = job.data;
    const startTime = Date.now();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 Processing Order: ${order.orderId}`);
    console.log(`   ${order.amountIn} ${order.tokenIn} → ${order.tokenOut}`);
    console.log(`${'='.repeat(60)}`);

    try {
      // Step 1: PENDING
      await job.updateProgress(10);
      this.updateStatus(order.orderId, OrderStatus.PENDING);
      await this.sleep(500);

      // Step 2: ROUTING
      await job.updateProgress(30);
      this.updateStatus(order.orderId, OrderStatus.ROUTING, {
        message: 'Comparing DEX prices...',
      });

      const bestQuote = await this.dexRouter.getBestQuote(
        order.tokenIn,
        order.tokenOut,
        order.amountIn
      );

      await this.db.updateOrderStatus(order.orderId, OrderStatus.ROUTING, {
        selectedDex: bestQuote.dex,
      });

      // Step 3: BUILDING
      await job.updateProgress(50);
      this.updateStatus(order.orderId, OrderStatus.BUILDING, {
        selectedDex: bestQuote.dex,
        estimatedOutput: bestQuote.estimatedOutput,
        estimatedPrice: bestQuote.effectivePrice,
      });

      const minAmountOut = bestQuote.estimatedOutput * (1 - order.slippage);
      console.log(`   Min output (slippage protected): ${minAmountOut.toFixed(4)}`);
      await this.sleep(800);

      // Step 4: SUBMITTED
      await job.updateProgress(70);
      this.updateStatus(order.orderId, OrderStatus.SUBMITTED, {
        selectedDex: bestQuote.dex,
        message: 'Transaction submitted to blockchain...',
      });

      const { txHash, executedPrice, actualOutput } = await this.dexRouter.executeSwap(
        bestQuote.dex,
        order.tokenIn,
        order.tokenOut,
        order.amountIn,
        minAmountOut
      );

      // Step 5: CONFIRMED
      await job.updateProgress(100);
      const executionTime = Date.now() - startTime;
      
      this.updateStatus(order.orderId, OrderStatus.CONFIRMED, {
        txHash,
        executedPrice,
        actualOutput,
        selectedDex: bestQuote.dex,
        executionTime: `${(executionTime / 1000).toFixed(2)}s`,
      });

      await this.db.updateOrderStatus(order.orderId, OrderStatus.CONFIRMED, {
        selectedDex: bestQuote.dex,
        executionPrice: executedPrice,
        txHash,
      });

      console.log(`\n✅ Order Completed: ${order.orderId}`);
      console.log(`   Execution time: ${(executionTime / 1000).toFixed(2)}s`);
      console.log(`${'='.repeat(60)}\n`);

    } catch (error: any) {
      console.error(`\n❌ Order Failed: ${order.orderId}`);
      console.error(`   Error: ${error.message}`);
      
      this.updateStatus(order.orderId, OrderStatus.FAILED, {
        error: error.message,
      });

      await this.db.updateOrderStatus(order.orderId, OrderStatus.FAILED, {
        error: error.message,
      });

      throw error;
    }
  }

  private updateStatus(orderId: string, status: OrderStatus, data?: any): void {
    this.wsService.sendStatus(orderId, status, data);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}

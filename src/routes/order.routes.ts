import { FastifyInstance, FastifyRequest } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import {
  OrderRequest,
  Order,
  OrderStatus,
  OrderType,
} from '../types/order.types';
import { OrderQueueService } from '../services/order-queue.service';
import { WebSocketService } from '../services/websocket.service';
import { Database } from '../database/db';

export async function orderRoutes(
  fastify: FastifyInstance,
  queueService: OrderQueueService,
  wsService: WebSocketService,
  db: Database
) {
  // POST /api/orders/execute - Submit order (HTTP only)
  fastify.post('/api/orders/execute', async (request: FastifyRequest, reply) => {
    const orderRequest = request.body as OrderRequest;

    // Validate order request
    if (
      !orderRequest.tokenIn ||
      !orderRequest.tokenOut ||
      !orderRequest.amountIn ||
      orderRequest.slippage === undefined ||
      !orderRequest.walletAddress
    ) {
      return reply.code(400).send({ error: 'Invalid order request' });
    }

    // Create order
    const orderId = uuidv4();
    const order: Order = {
      ...orderRequest,
      orderId,
      orderType: orderRequest.orderType || OrderType.MARKET,
      status: OrderStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save to database
    await db.saveOrder(order);

    // Add to queue
    await queueService.addOrder(order);

    // Return order ID with WebSocket URL for status updates
    return reply.code(200).send({
      orderId,
      status: OrderStatus.PENDING,
      message: 'Order submitted successfully. Connect to WebSocket for live updates.',
      wsUrl: `ws://localhost:3000/api/orders/ws?orderId=${orderId}`,
    });
  });

  // GET /api/orders/ws - WebSocket endpoint for order status updates
  fastify.get('/api/orders/ws', { websocket: true }, (socket, request) => {
    // Extract orderId from query params
    const url = new URL(request.url, 'http://localhost');
    const orderId = url.searchParams.get('orderId');

    if (!orderId) {
      socket.send(JSON.stringify({ error: 'Missing orderId parameter' }));
      socket.close();
      return;
    }

    // Register WebSocket connection
    wsService.registerConnection(orderId, socket);

    socket.on('message', (message: any) => {
      console.log(`📨 Received message from client: ${message}`);
    });

    socket.on('error', (error: Error) => {
      console.error(`❌ WebSocket error: ${error.message}`);
    });
  });

  // GET /api/orders/:orderId - Get order details
  fastify.get('/api/orders/:orderId', async (request: FastifyRequest, reply) => {
    const { orderId } = request.params as { orderId: string };
    const order = await db.getOrder(orderId);

    if (!order) {
      return reply.code(404).send({ error: 'Order not found' });
    }

    return reply.send(order);
  });

  // GET /api/orders/history/:walletAddress - Get order history
  fastify.get('/api/orders/history/:walletAddress', async (request: FastifyRequest, reply) => {
    const { walletAddress } = request.params as { walletAddress: string };
    const orders = await db.getOrderHistory(walletAddress);
    return reply.send(orders);
  });

  // GET /api/queue/metrics - Get queue metrics
  fastify.get('/api/queue/metrics', async (_request, reply) => {
    const metrics = await queueService.getQueueMetrics();
    return reply.send(metrics);
  });
}

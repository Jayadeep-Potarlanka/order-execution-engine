import { WebSocket } from 'ws';
import { WebSocketMessage, OrderStatus } from '../types/order.types';

export class WebSocketService {
  private connections: Map<string, WebSocket> = new Map();

  registerConnection(orderId: string, socket: WebSocket): void {
    this.connections.set(orderId, socket);
    console.log(`📡 WebSocket connected: ${orderId}`);

    this.sendStatus(orderId, OrderStatus.PENDING, {
      message: 'WebSocket connection established',
    });

    socket.on('close', () => {
      this.connections.delete(orderId);
      console.log(`📡 WebSocket disconnected: ${orderId}`);
    });

    socket.on('error', (error: Error) => {
      console.error(`❌ WebSocket error for ${orderId}:`, error.message);
      this.connections.delete(orderId);
    });
  }

  sendStatus(orderId: string, status: OrderStatus, data?: any): void {
    const socket = this.connections.get(orderId);
    
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn(`⚠️ No active WebSocket for ${orderId}`);
      return;
    }

    const message: WebSocketMessage = {
      orderId,
      status,
      data,
      timestamp: new Date(),
    };

    try {
      socket.send(JSON.stringify(message));
      console.log(`📤 ${orderId}: ${status}`);
    } catch (error: any) {
      console.error(`❌ Failed to send message to ${orderId}:`, error.message);
    }
  }

  closeConnection(orderId: string): void {
    const socket = this.connections.get(orderId);
    if (socket) {
      socket.close();
      this.connections.delete(orderId);
    }
  }

  getActiveConnections(): number {
    return this.connections.size;
  }
}

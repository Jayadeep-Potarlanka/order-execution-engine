import { Pool } from 'pg';
import { config } from '../config';
import { Order, OrderStatus } from '../types/order.types';

export class Database {
  private pool: Pool;

  constructor() {
    this.pool = new Pool(config.postgres);
    this.initializeSchema();
  }

  private async initializeSchema() {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS orders (
          order_id VARCHAR(36) PRIMARY KEY,
          wallet_address VARCHAR(44) NOT NULL,
          token_in VARCHAR(44) NOT NULL,
          token_out VARCHAR(44) NOT NULL,
          amount_in NUMERIC NOT NULL,
          slippage NUMERIC NOT NULL,
          order_type VARCHAR(20) NOT NULL,
          status VARCHAR(20) NOT NULL,
          selected_dex VARCHAR(20),
          execution_price NUMERIC,
          tx_hash VARCHAR(88),
          error_message TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_orders_wallet ON orders(wallet_address);
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
        CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
      `);
      console.log('✅ Database schema initialized');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
    } finally {
      client.release();
    }
  }

  async saveOrder(order: Order): Promise<void> {
    await this.pool.query(
      `INSERT INTO orders (order_id, wallet_address, token_in, token_out, amount_in, slippage, order_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        order.orderId,
        order.walletAddress,
        order.tokenIn,
        order.tokenOut,
        order.amountIn,
        order.slippage,
        order.orderType,
        order.status,
      ]
    );
  }

  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    additionalData?: {
      selectedDex?: string;
      executionPrice?: number;
      txHash?: string;
      error?: string;
    }
  ): Promise<void> {
    const fields = ['status = $2', 'updated_at = NOW()'];
    const values: any[] = [orderId, status];
    let paramIndex = 3;

    if (additionalData?.selectedDex) {
      fields.push(`selected_dex = $${paramIndex++}`);
      values.push(additionalData.selectedDex);
    }
    if (additionalData?.executionPrice) {
      fields.push(`execution_price = $${paramIndex++}`);
      values.push(additionalData.executionPrice);
    }
    if (additionalData?.txHash) {
      fields.push(`tx_hash = $${paramIndex++}`);
      values.push(additionalData.txHash);
    }
    if (additionalData?.error) {
      fields.push(`error_message = $${paramIndex++}`);
      values.push(additionalData.error);
    }

    await this.pool.query(
      `UPDATE orders SET ${fields.join(', ')} WHERE order_id = $1`,
      values
    );
  }

  async getOrder(orderId: string): Promise<Order | null> {
    const result = await this.pool.query(
      'SELECT * FROM orders WHERE order_id = $1',
      [orderId]
    );
    return result.rows[0] || null;
  }

  async getOrderHistory(walletAddress: string, limit: number = 50): Promise<Order[]> {
    const result = await this.pool.query(
      'SELECT * FROM orders WHERE wallet_address = $1 ORDER BY created_at DESC LIMIT $2',
      [walletAddress, limit]
    );
    return result.rows;
  }
}

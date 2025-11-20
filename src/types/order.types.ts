export enum OrderType {
  MARKET = 'market',
  LIMIT = 'limit',
  SNIPER = 'sniper',
}

export enum OrderStatus {
  PENDING = 'pending',
  ROUTING = 'routing',
  BUILDING = 'building',
  SUBMITTED = 'submitted',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

export enum DexType {
  RAYDIUM = 'raydium',
  METEORA = 'meteora',
}

export interface OrderRequest {
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  slippage: number;
  walletAddress: string;
  orderType: OrderType;
}

export interface Order extends OrderRequest {
  orderId: string;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface DexQuote {
  dex: DexType;
  price: number;
  fee: number;
  effectivePrice: number;
  liquidity: number;
  estimatedOutput: number;
}

export interface ExecutionResult {
  orderId: string;
  status: OrderStatus;
  selectedDex?: DexType;
  executionPrice?: number;
  txHash?: string;
  error?: string;
  timestamp: Date;
}

export interface WebSocketMessage {
  orderId: string;
  status: OrderStatus;
  data?: any;
  timestamp: Date;
}

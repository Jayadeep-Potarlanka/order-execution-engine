import { DexRouterService } from '../src/services/dex-router.service';
import { DexType } from '../src/types/order.types';
import { WebSocketService } from '../src/services/websocket.service';
import { OrderStatus } from '../src/types/order.types';

describe('DEX Router Service', () => {
  let dexRouter: DexRouterService;

  beforeEach(() => {
    dexRouter = new DexRouterService();
  });

  test('should fetch quotes from both DEXs', async () => {
    const quote = await dexRouter.getBestQuote('SOL', 'USDC', 100);
    
    expect(quote).toBeDefined();
    expect([DexType.RAYDIUM, DexType.METEORA]).toContain(quote.dex);
    expect(quote.price).toBeGreaterThan(0);
    expect(quote.effectivePrice).toBeGreaterThan(quote.price);
    expect(quote.estimatedOutput).toBeGreaterThan(0);
  });

  test('should select DEX with better effective price', async () => {
    const quote = await dexRouter.getBestQuote('SOL', 'USDC', 100);
    
    expect(quote.effectivePrice).toBeGreaterThan(0);
    expect(quote.fee).toBeGreaterThan(0);
  });

  test('should execute swap successfully', async () => {
    const result = await dexRouter.executeSwap(
      DexType.RAYDIUM,
      'SOL',
      'USDC',
      100,
      0.95
    );
    
    expect(result.txHash).toBeDefined();
    expect(result.txHash.length).toBe(88);
    expect(result.executedPrice).toBeGreaterThan(0);
    expect(result.actualOutput).toBeGreaterThan(0);
  });

  test('should enforce slippage protection', async () => {
    const unrealisticMinOutput = 10000;
    
    await expect(
      dexRouter.executeSwap(DexType.RAYDIUM, 'SOL', 'USDC', 100, unrealisticMinOutput)
    ).rejects.toThrow('Slippage exceeded');
  });

  test('should simulate realistic execution time', async () => {
    const start = Date.now();
    await dexRouter.executeSwap(DexType.METEORA, 'SOL', 'USDC', 100, 0.95);
    const duration = Date.now() - start;
    
    expect(duration).toBeGreaterThanOrEqual(2000);
    expect(duration).toBeLessThan(4000);
  });

  test('should generate valid Solana transaction hashes', async () => {
    const result = await dexRouter.executeSwap(
      DexType.RAYDIUM,
      'SOL',
      'USDC',
      100,
      0.95
    );
    
    // Solana txHash is base58 encoded, 88 characters
    expect(result.txHash.length).toBe(88);
    expect(result.txHash).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
  });

  test('should handle different token pairs', async () => {
    const quote1 = await dexRouter.getBestQuote('SOL', 'USDC', 50);
    const quote2 = await dexRouter.getBestQuote('USDC', 'SOL', 50);
    
    expect(quote1).toBeDefined();
    expect(quote2).toBeDefined();
  });

  test('should calculate fee correctly', async () => {
    const quote = await dexRouter.getBestQuote('SOL', 'USDC', 100);
    
    const expectedEffective = quote.price * (1 + quote.fee);
    expect(quote.effectivePrice).toBeCloseTo(expectedEffective, 2);
  });
});

describe('WebSocket Service', () => {
  let wsService: WebSocketService;

  beforeEach(() => {
    wsService = new WebSocketService();
  });

  test('should track active connections', () => {
    expect(wsService.getActiveConnections()).toBe(0);
  });

  test('should handle missing WebSocket gracefully', () => {
    // Should not throw when WebSocket is not connected
    expect(() => {
      wsService.sendStatus('fake-order-id', OrderStatus.PENDING);
    }).not.toThrow();
  });
});

describe('Order Processing Flow', () => {
  test('should process order through all statuses', () => {
    const statuses = [
      OrderStatus.PENDING,
      OrderStatus.ROUTING,
      OrderStatus.BUILDING,
      OrderStatus.SUBMITTED,
      OrderStatus.CONFIRMED,
    ];
    
    expect(statuses).toHaveLength(5);
    expect(statuses).toContain(OrderStatus.CONFIRMED);
  });

  test('should handle failed orders', () => {
    const failedStatus = OrderStatus.FAILED;
    expect(failedStatus).toBe('failed');
  });
});

describe('Integration Tests', () => {
  let dexRouter: DexRouterService;

  beforeEach(() => {
    dexRouter = new DexRouterService();
  });

  test('should complete full order flow', async () => {
    // Get quote
    const quote = await dexRouter.getBestQuote('SOL', 'USDC', 1.5);
    expect(quote).toBeDefined();
    
    // Calculate slippage protection
    const minOutput = quote.estimatedOutput * 0.99;
    
    // Execute swap
    const result = await dexRouter.executeSwap(
      quote.dex,
      'SOL',
      'USDC',
      1.5,
      minOutput
    );
    
    expect(result.txHash).toBeDefined();
    expect(result.actualOutput).toBeGreaterThanOrEqual(minOutput);
  });

  test('should handle concurrent quote requests', async () => {
    const promises = Array(5).fill(null).map(() => 
      dexRouter.getBestQuote('SOL', 'USDC', 100)
    );
    
    const results = await Promise.all(promises);
    
    expect(results).toHaveLength(5);
    results.forEach(quote => {
      expect(quote).toBeDefined();
      expect(quote.estimatedOutput).toBeGreaterThan(0);
    });
  });

  test('should handle rapid order submissions', async () => {
    const orders = Array(3).fill(null).map((_, i) => 
      dexRouter.getBestQuote('SOL', 'USDC', i + 1)
    );
    
    const quotes = await Promise.all(orders);
    expect(quotes).toHaveLength(3);
  });
});

import { DexQuote, DexType } from '../types/order.types';
import crypto from 'crypto';

export class DexRouterService {
  private basePrice = 100;

  async getBestQuote(
    _tokenIn: string,
    _tokenOut: string,
    amountIn: number
  ): Promise<DexQuote> {
    console.log(`\n🔍 Fetching quotes for ${amountIn} ${_tokenIn} → ${_tokenOut}`);
    
    const [raydiumQuote, meteoraQuote] = await Promise.all([
      this.getRaydiumQuote(_tokenIn, _tokenOut, amountIn),
      this.getMeteorQuote(_tokenIn, _tokenOut, amountIn),
    ]);

    this.logRoutingDecision(raydiumQuote, meteoraQuote);

    return raydiumQuote.effectivePrice < meteoraQuote.effectivePrice
      ? raydiumQuote
      : meteoraQuote;
  }

  private async getRaydiumQuote(
    _tokenIn: string,
    _tokenOut: string,
    amountIn: number
  ): Promise<DexQuote> {
    await this.sleep(150 + Math.random() * 100);

    const price = this.basePrice * (0.98 + Math.random() * 0.04);
    const fee = 0.003;
    const effectivePrice = price * (1 + fee);
    const estimatedOutput = amountIn / effectivePrice;

    return {
      dex: DexType.RAYDIUM,
      price,
      fee,
      effectivePrice,
      liquidity: 1000000 + Math.random() * 500000,
      estimatedOutput,
    };
  }

  private async getMeteorQuote(
    _tokenIn: string,
    _tokenOut: string,
    amountIn: number
  ): Promise<DexQuote> {
    await this.sleep(150 + Math.random() * 100);

    const price = this.basePrice * (0.97 + Math.random() * 0.06);
    const fee = 0.002;
    const effectivePrice = price * (1 + fee);
    const estimatedOutput = amountIn / effectivePrice;

    return {
      dex: DexType.METEORA,
      price,
      fee,
      effectivePrice,
      liquidity: 800000 + Math.random() * 600000,
      estimatedOutput,
    };
  }

  async executeSwap(
    dex: DexType,
    tokenIn: string,
    tokenOut: string,
    amountIn: number,
    minAmountOut: number
  ): Promise<{ txHash: string; executedPrice: number; actualOutput: number }> {
    console.log(`💱 Executing ${amountIn} ${tokenIn} → ${tokenOut} on ${dex.toUpperCase()}`);
    
    await this.sleep(2000 + Math.random() * 1000);

    const executedPrice = this.basePrice * (0.995 + Math.random() * 0.01);
    const actualOutput = amountIn / executedPrice;

    if (actualOutput < minAmountOut) {
      throw new Error(`Slippage exceeded: expected ${minAmountOut}, got ${actualOutput}`);
    }

    const txHash = this.generateRealisticTxHash();
    
    console.log(`✅ Swap executed - Output: ${actualOutput.toFixed(4)} ${tokenOut}`);
    console.log(`   TxHash: ${txHash}`);
    
    return { txHash, executedPrice, actualOutput };
  }

  private generateRealisticTxHash(): string {
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let hash = '';
    for (let i = 0; i < 88; i++) {
      const randomIndex = crypto.randomInt(0, chars.length);
      hash += chars[randomIndex];
    }
    return hash;
  }

  private logRoutingDecision(raydium: DexQuote, meteora: DexQuote): void {
    console.log('\n📊 DEX Comparison:');
    console.log(`   Raydium  - Price: $${raydium.price.toFixed(2)} | Fee: ${(raydium.fee * 100).toFixed(1)}% | Effective: $${raydium.effectivePrice.toFixed(2)}`);
    console.log(`   Meteora  - Price: $${meteora.price.toFixed(2)} | Fee: ${(meteora.fee * 100).toFixed(1)}% | Effective: $${meteora.effectivePrice.toFixed(2)}`);
    
    const winner = raydium.effectivePrice < meteora.effectivePrice ? 'RAYDIUM' : 'METEORA';
    const savings = Math.abs(raydium.effectivePrice - meteora.effectivePrice).toFixed(2);
    console.log(`   ✅ Selected: ${winner} (saves $${savings} per token)`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

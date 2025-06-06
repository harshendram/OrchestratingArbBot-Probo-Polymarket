import { ethers } from "ethers";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Wallet } from "@ethersproject/wallet";
import { Chain, ClobClient, getContractConfig, Side } from "./mocks/clob-client";
import { getUsdcContract } from "./mocks/approveAllowances";
import { Depth, OrderResult, MarketData } from "./types";
import { logger } from "./utils/logger";
import { getConfig } from "./config";

/**
 * Initialize the Polymarket client
 * @returns ClobClient instance
 */
function initializeClient() {
    const config = getConfig();
    
    if (!config.ethPrivateKey) {
        throw new Error("ETH_PRIVATE_KEY is not set");
    }
    
    const provider = new JsonRpcProvider(config.rpcUrl);
    const signer = new Wallet(config.ethPrivateKey, provider);
    
    return new ClobClient(config.clobApiUrl, Chain.POLYGON, signer, {
        key: config.polymarketApiKey,
        secret: config.polymarketApiSecret,
        passphrase: config.polymarketPassPhrase,
    });
}

// Initialize client with error handling
let clobClient: ClobClient;
try {
    clobClient = initializeClient();
} catch (error) {
    logger.error("Failed to initialize Polymarket client", error);
    throw error;
}

/**
 * Approve token allowance for trading on Polymarket
 * @param tokenId The token ID
 * @returns A promise that resolves when the allowance is approved
 */
export async function approveAllowance(tokenId: string): Promise<boolean> {
    try {
        logger.info(`Approving allowance for token ${tokenId}`);
        
        const config = getConfig();
        if (config.dryRun) {
            logger.info("DRY RUN: Would approve token allowance on Polymarket");
            return true;
        }
        
        const usdc = getUsdcContract(true, clobClient.signer);
        const contractConfig = getContractConfig(Chain.POLYGON);
        
        const txn = await usdc.approve(contractConfig.conditionalTokens, ethers.constants.MaxUint256, {
            gasPrice: 100_000_000_000,
            gasLimit: 200_000,
        });
        
        logger.info(`Setting USDC allowance for CTF: ${txn.hash}`);
        await txn.wait();
        
        logger.info("Allowance approval complete");
        return true;
    } catch (error) {
        logger.error("Failed to approve allowance", error);
        throw error;
    }
}

/**
 * Create an order on Polymarket
 * @param tokenId The token ID
 * @param price Order price
 * @param size Order quantity
 * @param side Order side (buy/sell)
 * @returns A promise resolving to order result
 */
export async function createOrder(
    tokenId: string, 
    price: number, 
    size: number,
    side: 'buy' | 'sell' = 'buy'
): Promise<OrderResult> {
    try {
        logger.info(`Creating ${side} order on Polymarket for ${size} units at price ${price}`);
        
        const config = getConfig();
        if (config.dryRun) {
            logger.info(`DRY RUN: Would create ${side} order on Polymarket for ${size} units at price ${price}`);
            return {
                success: true,
                orderId: 'dry-run-order-id',
                exchangeResponse: { dryRun: true }
            };
        }
        
        // Create order object
        const order = await clobClient.createOrder({
            tokenID: tokenId,
            price,
            side: side === 'buy' ? Side.BUY : Side.SELL,
            size,
            feeRateBps: 0,
        });
        
        // Post order to exchange
        const response = await clobClient.postOrder(order);
        
        logger.info('Polymarket order created successfully', response);
        
        return {
            success: true,
            orderId: response.orderID || 'unknown-order-id',
            exchangeResponse: response
        };
    } catch (error) {
        logger.error('Failed to create Polymarket order', {
            error: error instanceof Error ? error.message : String(error),
            tokenId,
            price,
            size,
            side
        });
        
        return {
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
            exchangeResponse: null
        };
    }
}

/**
 * Get market depth from Polymarket
 * @param tokenId The token ID to query
 * @returns A promise resolving to market depth data
 */
export async function getDepth(tokenId: string): Promise<Depth> {
    try {
        logger.debug(`Fetching Polymarket depth for token ${tokenId}`);
        
        const response = await clobClient.getOrderBook(tokenId);
        
        if (!response || !response.bids || !response.asks) {
            throw new Error('Invalid response format from Polymarket API');
        }
        
        let depth: Depth = {buy: {}, sell: {}};
          // Parse bids (buy orders)
        response.bids.forEach((bid: { price: number | string; size: number | string }) => {
            depth.buy[bid.price.toString()] = bid.size.toString();
        });
        
        // Parse asks (sell orders)
        response.asks.forEach((ask: { price: number | string; size: number | string }) => {
            depth.sell[ask.price.toString()] = ask.size.toString();
        });
        
        const marketData: MarketData = {
            marketId: tokenId,
            depthData: depth,
            timestamp: new Date().toISOString()
        };
        
        logger.debug('Polymarket depth data retrieved successfully', {
            buyLevels: response.bids.length,
            sellLevels: response.asks.length
        });
        
        return depth;
    } catch (error) {
        logger.error(`Error getting Polymarket market depth for token ${tokenId}`, error);
        throw error;
    }
}

/**
 * Get order status from Polymarket
 * @param orderId The order ID to query
 * @returns A promise resolving to order status
 */
export async function getOrderStatus(orderId: string): Promise<any> {
    try {
        logger.debug(`Fetching Polymarket order status for order ${orderId}`);
        
        const config = getConfig();
        if (config.dryRun) {
            return { status: 'FILLED', dryRun: true };
        }
        
        const response = await clobClient.getOrder(orderId);
        logger.debug('Polymarket order status retrieved', response);
        
        return response;
    } catch (error) {
        logger.error(`Failed to get Polymarket order status for order ${orderId}`, error);
        throw error;
    }
}
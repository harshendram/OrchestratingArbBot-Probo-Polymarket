import axios from "axios";
import { AxiosRequestConfig, AxiosResponse } from "axios";
import { Depth, OrderResult, MarketData } from "./types";
import { logger } from "./utils/logger";
import { getConfig } from "./config";

/**
 * Get market depth from Probo
 * @param marketId The market ID to query
 * @returns A promise resolving to market depth data
 */
export async function getDepth(marketId: number): Promise<Depth> {
    const config = getConfig();
    
    const requestConfig: AxiosRequestConfig = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://prod.api.probo.in/api/v3/tms/trade/bestAvailablePrice?eventId=${marketId}`,
        headers: { 
            'accept': '*/*', 
            'accept-language': 'en-US,en;q=0.9', 
            'appid': 'in.probo.pro', 
            'authorization': `Bearer ${config.proboAuthToken}`,
            'content-type': 'application/json', 
            'origin': 'https://probo.in', 
            'priority': 'u=1, i', 
            'referer': 'https://probo.in/', 
            'sec-ch-ua': '"Chromium";v="136", "Not-A.Brand";v="99", "Google Chrome";v="136"', 
            'sec-ch-ua-mobile': '?0', 
            'sec-ch-ua-platform': '"Windows"', 
            'sec-fetch-dest': 'empty', 
            'sec-fetch-mode': 'cors', 
            'sec-fetch-site': 'same-site', 
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', 
            'x-device-os': 'ANDROID', 
            'x-version-name': '10'
        },
        timeout: 10000 // 10 seconds timeout
    };
    
    try {
        logger.debug(`Fetching Probo depth for market ${marketId}`);
        const response: AxiosResponse = await axios.request(requestConfig);
        
        if (!response.data || !response.data.data || !response.data.data.available_qty) {
            throw new Error('Invalid response format from Probo API');
        }
        
        let book: Depth = { buy: {}, sell: {} };
        
        // Parse buy orders
        if (response.data.data.available_qty.buy) {
            Object.keys(response.data.data.available_qty.buy).forEach((key: string) => {
                book.buy[key] = response.data.data.available_qty.buy[key].toString();
            });
        }
        
        // Parse sell orders
        if (response.data.data.available_qty.sell) {
            Object.keys(response.data.data.available_qty.sell).forEach((key: string) => {
                book.sell[key] = response.data.data.available_qty.sell[key].toString();
            });
        }
        
        const marketData: MarketData = {
            marketId,
            depthData: book,
            timestamp: new Date().toISOString()
        };
        
        logger.debug('Probo depth data retrieved successfully', {
            buyLevels: Object.keys(book.buy).length,
            sellLevels: Object.keys(book.sell).length
        });
        
        return book;
    } catch (error) {
        logger.error(`Error getting Probo market depth for market ${marketId}`, error);
        throw error;
    }
}

/**
 * Create an order on Probo
 * @param marketId The market ID
 * @param side Order side (buy/sell)
 * @param size Order quantity
 * @param price Order price
 * @returns A promise resolving to order result
 */
export async function createOrder(
    marketId: number, 
    side: 'buy' | 'sell', 
    size: number, 
    price: number
): Promise<OrderResult> {
    const config = getConfig();
    
    if (config.dryRun) {
        logger.info(`DRY RUN: Would create ${side} order on Probo for ${size} units at price ${price}`);
        return {
            success: true,
            orderId: 'dry-run-order-id',
            exchangeResponse: { dryRun: true }
        };
    }
    
    const orderData = {
        event_id: marketId,
        offer_type: side,
        order_type: "LO",
        l1_order_quantity: size,
        l1_expected_price: price,
        advanced_options: {
            auto_cancel: {
                minutes: 1,
                disable_trigger: true
            },
            book_profit: {
                price: 8,
                quantity: 5,
                disable_trigger: true
            },
            stop_loss: {
                price: 6.5,
                quantity: 5,
                disable_trigger: true
            }
        }
    };

    const requestConfig: AxiosRequestConfig = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://prod.api.probo.in/api/v1/oms/order/initiate',
        headers: { 
            'accept': '*/*', 
            'accept-language': 'en-US,en;q=0.9', 
            'appid': 'in.probo.pro', 
            'authorization': `Bearer ${config.proboAuthToken}`, 
            'content-type': 'application/json', 
            'origin': 'https://probo.in', 
            'priority': 'u=1, i', 
            'referer': 'https://probo.in/', 
            'sec-ch-ua': '"Chromium";v="136", "Not-A.Brand";v="99", "Google Chrome";v="136"', 
            'sec-ch-ua-mobile': '?0', 
            'sec-ch-ua-platform': '"Windows"', 
            'sec-fetch-dest': 'empty', 
            'sec-fetch-mode': 'cors', 
            'sec-fetch-site': 'same-site', 
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', 
            'x-device-os': 'ANDROID', 
            'x-version-name': '10'
        },
        data: JSON.stringify(orderData),
        timeout: 15000 // 15 seconds timeout
    };

    try {
        logger.info(`Creating ${side} order on Probo for ${size} units at price ${price}`);
        const response = await axios.request(requestConfig);
        
        if (!response.data) {
            throw new Error('Empty response received from Probo');
        }
        
        if (response.data.errors && response.data.errors.length > 0) {
            throw new Error(`Probo API error: ${response.data.errors[0].message}`);
        }
        
        logger.info('Probo order created successfully', response.data);
        
        return {
            success: true,
            orderId: response.data.data?.order_id || 'unknown-order-id',
            exchangeResponse: response.data
        };
    } catch (error) {        logger.error('Failed to create Probo order', {
            error: error instanceof Error ? error.message : String(error),
            marketId, 
            side, 
            size, 
            price
        });
        
        return {
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
            exchangeResponse: error instanceof Error && 'response' in error ? (error as any).response?.data : null
        };
    }
}

/**
 * Get order status from Probo
 * @param orderId The order ID to query
 * @returns A promise resolving to order status
 */
export async function getOrderStatus(orderId: string): Promise<any> {
    const config = getConfig();
    
    const requestConfig: AxiosRequestConfig = {
        method: 'get',
        url: `https://prod.api.probo.in/api/v1/oms/order/${orderId}`,
        headers: { 
            'accept': '*/*', 
            'accept-language': 'en-US,en;q=0.9', 
            'appid': 'in.probo.pro', 
            'authorization': `Bearer ${config.proboAuthToken}`,
            'content-type': 'application/json', 
            'origin': 'https://probo.in', 
            'referer': 'https://probo.in/', 
            'sec-ch-ua': '"Chromium";v="136", "Not-A.Brand";v="99", "Google Chrome";v="136"', 
            'sec-ch-ua-mobile': '?0', 
            'sec-ch-ua-platform': '"Windows"', 
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', 
            'x-device-os': 'ANDROID', 
            'x-version-name': '10'
        },
        timeout: 5000
    };
    
    try {
        logger.debug(`Fetching Probo order status for order ${orderId}`);
        const response = await axios.request(requestConfig);
        
        if (!response.data) {
            throw new Error('Empty response received from Probo');
        }
        
        logger.debug('Probo order status retrieved', response.data);
        return response.data;
    } catch (error) {
        logger.error(`Failed to get Probo order status for order ${orderId}`, error);
        throw error;
    }
}
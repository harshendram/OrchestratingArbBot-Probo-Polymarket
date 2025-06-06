// Mock implementation for the clob-client functionality
export enum Chain {
    POLYGON = 'polygon'
}

export enum Side {
    BUY = 'buy',
    SELL = 'sell'
}

export class ClobClient {
    signer: any;

    constructor(host: string, chain: Chain, signer: any, credentials: any) {
        this.signer = signer;
        // In a real implementation, this would connect to the service
    }

    async getOrderBook(tokenId: string) {
        // Mock implementation returning simplified order book
        return {
            bids: [{ price: '0.6', size: '200' }],
            asks: [{ price: '0.8', size: '300' }]
        };
    }

    async createOrder(orderParams: any) {
        // Mock implementation returning a dummy order
        return {
            id: 'mock-order-id-' + Math.random().toString(36).substring(7),
            ...orderParams
        };
    }

    async postOrder(order: any) {
        // Mock implementation
        return {
            orderID: order.id || 'mock-order-id',
            status: 'OPEN'
        };
    }

    async getOrder(orderId: string) {
        return {
            orderID: orderId,
            status: 'FILLED'
        };
    }
}

export function getContractConfig(chain: Chain) {
    // Mock implementation
    return {
        conditionalTokens: '0xmockConditionalTokensAddress'
    };
}

export interface Depth {
    buy: { [key: string]: string };
    sell: { [key: string]: string };
}

export interface ArbOpportunity {
    found: boolean;
    isViable: boolean;
    profitPercent: number;
    polymarketPrice: number;
    proboPrice: number;
    polymarketQty: number;
    proboQty: number;
    reason?: string;
}

export interface OrderResult {
    success: boolean;
    orderId?: string;
    error?: Error;
    exchangeResponse?: any;
}

export interface ExecutionResult {
    polymarketOrder: OrderResult;
    proboOrder: OrderResult;
    opportunity: ArbOpportunity;
    timestamp: string;
}

export interface MarketData {
    marketId: string | number;
    depthData: Depth;
    timestamp: string;
}

export enum Exchange {
    POLYMARKET = 'polymarket',
    PROBO = 'probo'
}

export enum OrderSide {
    BUY = 'buy',
    SELL = 'sell'
}



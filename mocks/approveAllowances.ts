// Mock implementation for approveAllowances
import { ethers } from 'ethers';

export function getUsdcContract(isProd: boolean, signer: any) {
    return {
        approve: async (tokenAddress: string, amount: typeof ethers.constants.MaxUint256, options: any) => {
            // Mock transaction response
            return {
                hash: '0xmockTransactionHash' + Math.random().toString(36).substring(7),
                wait: async () => {
                    return {
                        status: 1, 
                        blockNumber: 123456
                    };
                }
            };
        }
    };
}

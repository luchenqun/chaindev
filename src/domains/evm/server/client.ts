import { createPublicClient } from 'viem';
import { createEvmTransport } from '@/domains/evm/lib/transport';

export function createEvmClient(rpcUrl: string) {
  return createPublicClient({
    transport: createEvmTransport(rpcUrl),
  });
}

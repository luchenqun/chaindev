import { http, webSocket } from 'viem';

export function isWebSocketUrl(url: string) {
  return url.startsWith('ws://') || url.startsWith('wss://');
}

export function createEvmTransport(rpcUrl: string) {
  return isWebSocketUrl(rpcUrl)
    ? webSocket(rpcUrl)
    : http(rpcUrl, {
        // Coalesce concurrent JSON-RPC calls into a single HTTP batch request.
        batch: {
          wait: 12,
          batchSize: 100,
        },
      });
}

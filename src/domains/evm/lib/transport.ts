import { http, webSocket } from "viem";

export function isWebSocketUrl(url: string) {
  return url.startsWith("ws://") || url.startsWith("wss://");
}

export function createEvmTransport(rpcUrl: string) {
  return isWebSocketUrl(rpcUrl) ? webSocket(rpcUrl) : http(rpcUrl);
}

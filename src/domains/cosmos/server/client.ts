import { StargateClient } from '@cosmjs/stargate';
export async function getCosmosClient(rpcUrl: string) {
  return StargateClient.connect(rpcUrl);
}

export function getCosmosRestUrl(restUrl: string) {
  return restUrl;
}

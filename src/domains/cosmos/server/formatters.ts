export function formatCosmosBlock(payload: {
  blockId: { hash: string };
  block: { header: { height: string; time?: string } };
}) {
  return {
    height: payload.block.header.height,
    hash: payload.blockId.hash,
    timestamp: payload.block.header.time ?? null,
  };
}

export function formatCosmosTx(payload: {
  hash: string;
  height: number;
  code: number;
  gasUsed: bigint | number;
  rawLog: string;
}) {
  return {
    hash: payload.hash,
    height: String(payload.height),
    code: payload.code,
    gasUsed: Number(payload.gasUsed),
    rawLog: payload.rawLog,
  };
}

export type QueryMatch =
  | { type: 'evm-hash'; value: string }
  | { type: 'evm-address'; value: string }
  | { type: 'cosmos-tx'; value: string }
  | { type: 'cosmos-address'; value: string }
  | { type: 'numeric'; value: string }
  | { type: 'unknown'; value: string };

export function parseQuery(raw: string): QueryMatch {
  const value = raw.trim();

  if (/^0x[a-fA-F0-9]{64}$/.test(value)) {
    return { type: 'evm-hash', value };
  }

  if (/^0x[a-fA-F0-9]{40}$/.test(value)) {
    return { type: 'evm-address', value };
  }

  if (/^[A-F0-9]{64}$/.test(value)) {
    return { type: 'cosmos-tx', value };
  }

  if (/^[a-z]+1[0-9a-z]{20,}$/.test(value)) {
    return { type: 'cosmos-address', value };
  }

  if (/^\d+$/.test(value)) {
    return { type: 'numeric', value };
  }

  return { type: 'unknown', value };
}

export type EvmRpcMethodCategory = 'ethereum-json-rpc' | 'debug' | 'trace';

type EvmRpcParamType = 'string' | 'boolean' | 'integer' | 'object' | 'array';

export type EvmRpcParamDefinition = {
  name: string;
  type: EvmRpcParamType;
  required?: boolean;
  description?: string;
  defaultValue?: unknown;
};

export type EvmRpcMethodDefinition = {
  category: EvmRpcMethodCategory;
  name: string;
  summary: string;
  docsUrl: string;
  params: EvmRpcParamDefinition[];
  notes?: string[];
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_HASH = `0x${'0'.repeat(64)}`;

function quickNodeDoc(method: string) {
  return `https://www.quicknode.com/docs/ethereum/${method}`;
}

function stringParam(name: string, options: Omit<EvmRpcParamDefinition, 'name' | 'type'> = {}): EvmRpcParamDefinition {
  return {
    name,
    type: 'string',
    ...options,
  };
}

function booleanParam(name: string, options: Omit<EvmRpcParamDefinition, 'name' | 'type'> = {}): EvmRpcParamDefinition {
  return {
    name,
    type: 'boolean',
    ...options,
  };
}

function integerParam(name: string, options: Omit<EvmRpcParamDefinition, 'name' | 'type'> = {}): EvmRpcParamDefinition {
  return {
    name,
    type: 'integer',
    ...options,
  };
}

function objectParam(name: string, options: Omit<EvmRpcParamDefinition, 'name' | 'type'> = {}): EvmRpcParamDefinition {
  return {
    name,
    type: 'object',
    ...options,
  };
}

function arrayParam(name: string, options: Omit<EvmRpcParamDefinition, 'name' | 'type'> = {}): EvmRpcParamDefinition {
  return {
    name,
    type: 'array',
    ...options,
  };
}

function method(
  category: EvmRpcMethodCategory,
  name: string,
  summary: string,
  params: EvmRpcParamDefinition[] = [],
  notes?: string[],
): EvmRpcMethodDefinition {
  return {
    category,
    name,
    summary,
    docsUrl: quickNodeDoc(name),
    params,
    notes,
  };
}

const callObject = {
  to: ZERO_ADDRESS,
  data: '0x',
};

const traceConfig = {
  tracer: 'callTracer',
  timeout: '10s',
};

export const EVM_RPC_METHOD_CATALOG: EvmRpcMethodDefinition[] = [
  method('ethereum-json-rpc', 'eth_accounts', 'Returns the list of wallet addresses managed by the current node.'),
  method('ethereum-json-rpc', 'eth_blobBaseFee', 'Returns the expected blob base fee for the next block.'),
  method('ethereum-json-rpc', 'eth_blockNumber', 'Returns the latest block number on the chain.'),
  method(
    'ethereum-json-rpc',
    'eth_call',
    'Executes a read-only contract call without broadcasting a transaction.',
    [
      objectParam('transaction', { required: true, defaultValue: callObject }),
      stringParam('blockNumber', { required: true, defaultValue: 'latest' }),
      objectParam('stateOverride'),
    ],
  ),
  method(
    'ethereum-json-rpc',
    'eth_callMany',
    'Simulates multiple calls or bundles in a batch without writing to the chain.',
    [
      arrayParam('bundles', { required: true, defaultValue: [] }),
      objectParam('simulationContext'),
      objectParam('stateOverride'),
      integerParam('timeoutMs'),
    ],
  ),
  method('ethereum-json-rpc', 'eth_chainId', 'Returns the current network chain ID.'),
  method(
    'ethereum-json-rpc',
    'eth_estimateGas',
    'Estimates the gas required to execute a transaction.',
    [
      objectParam('transaction', { required: true, defaultValue: callObject }),
      stringParam('blockNumber', { defaultValue: 'latest' }),
      objectParam('stateOverride'),
    ],
  ),
  method(
    'ethereum-json-rpc',
    'eth_feeHistory',
    'Returns gas fee statistics for a range of historical blocks.',
    [
      stringParam('blockCount', { required: true, defaultValue: '0x4' }),
      stringParam('newestBlock', { required: true, defaultValue: 'latest' }),
      arrayParam('rewardPercentiles', { required: true, defaultValue: [25, 75] }),
    ],
  ),
  method('ethereum-json-rpc', 'eth_gasPrice', 'Returns the suggested gas price for the current network.'),
  method(
    'ethereum-json-rpc',
    'eth_getAccount',
    'Returns account details for an address at a specific block.',
    [
      stringParam('address', { required: true, defaultValue: ZERO_ADDRESS }),
      stringParam('blockReference', { required: true, defaultValue: 'latest' }),
    ],
  ),
  method(
    'ethereum-json-rpc',
    'eth_getBalance',
    'Returns the balance for an address.',
    [
      stringParam('address', { required: true, defaultValue: ZERO_ADDRESS }),
      stringParam('blockNumber', { required: true, defaultValue: 'latest' }),
    ],
  ),
  method(
    'ethereum-json-rpc',
    'eth_getBlockByHash',
    'Returns a block by block hash.',
    [
      stringParam('hash', { required: true, defaultValue: ZERO_HASH }),
      booleanParam('includeTransactions', { required: true, defaultValue: false }),
    ],
  ),
  method(
    'ethereum-json-rpc',
    'eth_getBlockByNumber',
    'Returns a block by block number.',
    [
      stringParam('blockNumber', { required: true, defaultValue: 'latest' }),
      booleanParam('includeTransactions', { required: true, defaultValue: false }),
    ],
  ),
  method(
    'ethereum-json-rpc',
    'eth_getBlockReceipts',
    'Returns all transaction receipts for a specific block.',
    [stringParam('blockNumber', { required: true, defaultValue: 'latest' })],
  ),
  method(
    'ethereum-json-rpc',
    'eth_getBlockTransactionCountByHash',
    'Returns the number of transactions in a block by block hash.',
    [stringParam('hash', { required: true, defaultValue: ZERO_HASH })],
  ),
  method(
    'ethereum-json-rpc',
    'eth_getBlockTransactionCountByNumber',
    'Returns the number of transactions in a block by block number.',
    [stringParam('blockNumber', { required: true, defaultValue: 'latest' })],
  ),
  method(
    'ethereum-json-rpc',
    'eth_getCode',
    'Returns the contract bytecode at an address.',
    [
      stringParam('address', { required: true, defaultValue: ZERO_ADDRESS }),
      stringParam('blockNumber', { required: true, defaultValue: 'latest' }),
    ],
  ),
  method(
    'ethereum-json-rpc',
    'eth_getFilterChanges',
    'Polls a filter for changes since the previous call.',
    [stringParam('filterID', { required: true, defaultValue: '0x0' })],
  ),
  method(
    'ethereum-json-rpc',
    'eth_getFilterLogs',
    'Returns all logs for a filter id.',
    [stringParam('id', { required: true, defaultValue: '0x0' })],
  ),
  method(
    'ethereum-json-rpc',
    'eth_getLogs',
    'Returns logs that match a filter object.',
    [
      objectParam('filter', {
        required: true,
        defaultValue: {
          fromBlock: 'latest',
          toBlock: 'latest',
          address: ZERO_ADDRESS,
          topics: [],
        },
      }),
    ],
  ),
  method(
    'ethereum-json-rpc',
    'eth_getProof',
    'Returns the Merkle proof for an account and storage slots.',
    [
      stringParam('address', { required: true, defaultValue: ZERO_ADDRESS }),
      arrayParam('storageKeys', { required: true, defaultValue: [ZERO_HASH] }),
      stringParam('blockNumber', { defaultValue: 'latest' }),
    ],
  ),
  method(
    'ethereum-json-rpc',
    'eth_getRawTransactionByHash',
    'Returns the raw transaction data for a transaction hash.',
    [stringParam('hash', { required: true, defaultValue: ZERO_HASH })],
  ),
  method(
    'ethereum-json-rpc',
    'eth_getStorageAt',
    'Returns the value at a specific contract storage slot.',
    [
      stringParam('address', { required: true, defaultValue: ZERO_ADDRESS }),
      stringParam('position', { required: true, defaultValue: '0x0' }),
      stringParam('blockNumber', { required: true, defaultValue: 'latest' }),
    ],
  ),
  method(
    'ethereum-json-rpc',
    'eth_getTransactionByBlockHashAndIndex',
    'Returns a transaction by block hash and transaction index.',
    [
      stringParam('blockHash', { required: true, defaultValue: ZERO_HASH }),
      stringParam('index', { required: true, defaultValue: '0x0' }),
    ],
  ),
  method(
    'ethereum-json-rpc',
    'eth_getTransactionByBlockNumberAndIndex',
    'Returns a transaction by block number and transaction index.',
    [
      stringParam('blockNumber', { required: true, defaultValue: 'latest' }),
      stringParam('index', { required: true, defaultValue: '0x0' }),
    ],
  ),
  method(
    'ethereum-json-rpc',
    'eth_getTransactionByHash',
    'Returns a transaction by transaction hash.',
    [stringParam('hash', { required: true, defaultValue: ZERO_HASH })],
  ),
  method(
    'ethereum-json-rpc',
    'eth_getTransactionBySenderAndNonce',
    'Returns a transaction by sender address and nonce.',
    [
      stringParam('sender', { required: true, defaultValue: ZERO_ADDRESS }),
      stringParam('nonce', { required: true, defaultValue: '0x0' }),
    ],
  ),
  method(
    'ethereum-json-rpc',
    'eth_getTransactionCount',
    'Returns the transaction count for an address.',
    [
      stringParam('address', { required: true, defaultValue: ZERO_ADDRESS }),
      stringParam('blockNumber', { required: true, defaultValue: 'latest' }),
    ],
  ),
  method(
    'ethereum-json-rpc',
    'eth_getTransactionReceipt',
    'Returns the transaction receipt for a transaction hash.',
    [stringParam('hash', { required: true, defaultValue: ZERO_HASH })],
  ),
  method(
    'ethereum-json-rpc',
    'eth_getUncleCountByBlockHash',
    'Returns the uncle count for a block by block hash.',
    [stringParam('hash', { required: true, defaultValue: ZERO_HASH })],
  ),
  method(
    'ethereum-json-rpc',
    'eth_getUncleCountByBlockNumber',
    'Returns the uncle count for a block by block number.',
    [stringParam('blockNumber', { required: true, defaultValue: 'latest' })],
  ),
  method('ethereum-json-rpc', 'eth_hashrate', 'Returns the current node hashrate.'),
  method('ethereum-json-rpc', 'eth_maxPriorityFeePerGas', 'Returns the suggested max priority fee per gas.'),
  method('ethereum-json-rpc', 'eth_mining', 'Returns whether the node is currently mining.'),
  method('ethereum-json-rpc', 'eth_newBlockFilter', 'Creates a new block filter.'),
  method(
    'ethereum-json-rpc',
    'eth_newFilter',
    'Creates a new log filter.',
    [
      objectParam('filter', {
        required: true,
        defaultValue: {
          fromBlock: 'latest',
          toBlock: 'latest',
          address: ZERO_ADDRESS,
          topics: [],
        },
      }),
    ],
  ),
  method('ethereum-json-rpc', 'eth_newPendingTransactionFilter', 'Creates a new pending transaction filter.'),
  method(
    'ethereum-json-rpc',
    'eth_sendRawTransaction',
    'Broadcasts a signed raw transaction.',
    [stringParam('data', { required: true, defaultValue: '0x' })],
  ),
  method(
    'ethereum-json-rpc',
    'eth_signTransaction',
    'Requests the node to sign a transaction. QuickNode documents this method as unsupported.',
    [objectParam('transaction', { required: true, defaultValue: callObject })],
    ['QuickNode documents this method as unsupported.'],
  ),
  method(
    'ethereum-json-rpc',
    'eth_simulateV1',
    'Simulates a set of transactions and returns the execution results.',
    [
      objectParam('simulationRequest', { required: true, defaultValue: {} }),
      stringParam('blockParameter', { defaultValue: 'latest' }),
    ],
  ),
  method(
    'ethereum-json-rpc',
    'eth_submitWork',
    'Submits a proof-of-work solution.',
    [
      stringParam('nonce', { required: true, defaultValue: '0x0' }),
      stringParam('hash', { required: true, defaultValue: ZERO_HASH }),
      stringParam('digest', { required: true, defaultValue: ZERO_HASH }),
    ],
  ),
  method(
    'ethereum-json-rpc',
    'eth_subscribe',
    'Subscribes to chain events.',
    [
      stringParam('subscription_name', { required: true, defaultValue: 'newHeads' }),
      booleanParam('flag'),
      objectParam('data'),
    ],
    ['This method typically requires the active EVM provider to use WebSocket RPC.'],
  ),
  method('ethereum-json-rpc', 'eth_syncing', 'Returns the node synchronization status.'),
  method(
    'ethereum-json-rpc',
    'eth_uninstallFilter',
    'Uninstalls a filter by id.',
    [stringParam('filterID', { required: true, defaultValue: '0x0' })],
  ),
  method(
    'ethereum-json-rpc',
    'eth_unsubscribe',
    'Cancels an existing subscription.',
    [stringParam('subscription_id', { required: true, defaultValue: '0x0' })],
    ['This method typically requires the active EVM provider to use WebSocket RPC.'],
  ),
  method('ethereum-json-rpc', 'net_listening', 'Returns whether the node is listening for network connections.'),
  method('ethereum-json-rpc', 'net_peerCount', 'Returns the current peer count.'),
  method('ethereum-json-rpc', 'net_version', 'Returns the current network id.'),
  method(
    'ethereum-json-rpc',
    'txpool_content',
    'Returns pending and queued transaction details from the txpool.',
    [],
    ['This method is typically available only on Geth-style nodes.'],
  ),
  method(
    'ethereum-json-rpc',
    'txpool_contentFrom',
    'Returns txpool content filtered by sender address.',
    [stringParam('address', { required: true, defaultValue: ZERO_ADDRESS })],
  ),
  method(
    'ethereum-json-rpc',
    'txpool_inspect',
    'Returns a textual summary of the txpool.',
    [],
    ['This method is typically available only on Geth-style nodes.'],
  ),
  method(
    'ethereum-json-rpc',
    'txpool_status',
    'Returns the counts of pending and queued transactions in the txpool.',
    [],
    ['This method is typically available only on Geth-style nodes.'],
  ),
  method('ethereum-json-rpc', 'web3_clientVersion', 'Returns the current chain client version.'),
  method(
    'ethereum-json-rpc',
    'web3_sha3',
    'Computes the Keccak-256 hash of the input hex data.',
    [stringParam('data', { required: true, defaultValue: '0x68656c6c6f20776f726c64' })],
  ),

  method('debug', 'debug_getBadBlocks', 'Returns the list of bad blocks observed by the node.'),
  method('debug', 'debug_getTrieFlushInterval', 'Returns the in-memory trie flush interval.'),
  method(
    'debug',
    'debug_storageRangeAt',
    'Returns a range of contract storage at a specific execution point.',
    [
      stringParam('blockReference', { required: true, defaultValue: 'latest' }),
      integerParam('txIndex', { required: true, defaultValue: 0 }),
      stringParam('address', { required: true, defaultValue: ZERO_ADDRESS }),
      stringParam('startKey', { required: true, defaultValue: ZERO_HASH }),
      stringParam('limit', { required: true, defaultValue: '0x1' }),
    ],
  ),
  method(
    'debug',
    'debug_traceBlock',
    'Traces all transactions in an RLP-encoded block at opcode level.',
    [
      stringParam('block', { required: true, defaultValue: '0x' }),
      objectParam('tracer', { required: true, defaultValue: traceConfig }),
    ],
  ),
  method(
    'debug',
    'debug_traceBlockByHash',
    'Traces all transactions in a block by block hash.',
    [
      stringParam('blockHash', { required: true, defaultValue: ZERO_HASH }),
      objectParam('tracer', { required: true, defaultValue: traceConfig }),
    ],
  ),
  method(
    'debug',
    'debug_traceBlockByNumber',
    'Traces all transactions in a block by block number.',
    [
      stringParam('blockNumber', { required: true, defaultValue: 'latest' }),
      objectParam('tracer', { required: true, defaultValue: traceConfig }),
    ],
  ),
  method(
    'debug',
    'debug_traceCall',
    'Traces an eth_call in the context of a specific block.',
    [
      objectParam('transaction', { required: true, defaultValue: callObject }),
      stringParam('blockReference', { required: true, defaultValue: 'latest' }),
      objectParam('tracer', { required: true, defaultValue: traceConfig }),
    ],
  ),
  method(
    'debug',
    'debug_traceTransaction',
    'Traces the full execution of a transaction by transaction hash.',
    [
      stringParam('transactionHash', { required: true, defaultValue: ZERO_HASH }),
      objectParam('tracer', { defaultValue: traceConfig }),
    ],
  ),

  method(
    'trace',
    'trace_block',
    'Returns the traces produced by a specific block.',
    [stringParam('blockNumber', { required: true, defaultValue: 'latest' })],
    ['This method typically requires an Erigon-style node with trace namespace support.'],
  ),
  method(
    'trace',
    'trace_call',
    'Simulates a call and returns trace results.',
    [
      objectParam('transaction', { required: true, defaultValue: callObject }),
      arrayParam('traceTypes', { required: true, defaultValue: ['trace'] }),
      stringParam('blockNumber', { defaultValue: 'latest' }),
    ],
    ['This method typically requires an Erigon-style node with trace namespace support.'],
  ),
  method(
    'trace',
    'trace_callMany',
    'Executes multiple trace_call operations in the same block context.',
    [
      arrayParam('calls', { required: true, defaultValue: [] }),
      stringParam('blockNumber', { defaultValue: 'latest' }),
    ],
    ['This method typically requires an Erigon-style node with trace namespace support.'],
  ),
  method(
    'trace',
    'trace_filter',
    'Returns trace results that match a filter object.',
    [
      objectParam('filter', {
        required: true,
        defaultValue: {
          fromBlock: 'latest',
          toBlock: 'latest',
          fromAddress: [],
          toAddress: [],
          after: 0,
          count: 10,
        },
      }),
    ],
    ['This method typically requires an Erigon-style node with trace namespace support.'],
  ),
  method(
    'trace',
    'trace_rawTransaction',
    'Simulates a raw transaction and returns trace results.',
    [
      stringParam('data', { required: true, defaultValue: '0x' }),
      arrayParam('traceTypes', { required: true, defaultValue: ['trace'] }),
    ],
    ['This method typically requires an Erigon-style node with trace namespace support.'],
  ),
  method(
    'trace',
    'trace_replayBlockTransactions',
    'Replays all transactions in a block and returns trace results.',
    [
      stringParam('blockNumber', { required: true, defaultValue: 'latest' }),
      arrayParam('traceTypes', { required: true, defaultValue: ['trace'] }),
    ],
    ['This method typically requires an Erigon-style node with trace namespace support.'],
  ),
  method(
    'trace',
    'trace_replayTransaction',
    'Replays a single transaction and returns trace results.',
    [
      stringParam('hash', { required: true, defaultValue: ZERO_HASH }),
      arrayParam('traceTypes', { required: true, defaultValue: ['trace'] }),
    ],
    ['This method typically requires an Erigon-style node with trace namespace support.'],
  ),
  method(
    'trace',
    'trace_transaction',
    'Returns all traces for a transaction.',
    [stringParam('hash', { required: true, defaultValue: ZERO_HASH })],
    ['This method typically requires an Erigon-style node with trace namespace support.'],
  ),
];

export function getEvmRpcCategoryLabel(category: EvmRpcMethodCategory) {
  switch (category) {
    case 'ethereum-json-rpc':
      return 'Ethereum JSON-RPC API';
    case 'debug':
      return 'Debug API';
    case 'trace':
      return 'Trace API';
  }
}

export function createEvmRpcParamsTemplate(methodDefinition: EvmRpcMethodDefinition) {
  let lastIncludedIndex = -1;

  for (let index = 0; index < methodDefinition.params.length; index += 1) {
    const param = methodDefinition.params[index];

    if (param.required || param.defaultValue !== undefined) {
      lastIncludedIndex = index;
    }
  }

  return methodDefinition.params.slice(0, lastIncludedIndex + 1).map((param) => {
    if (param.defaultValue !== undefined) {
      return JSON.parse(JSON.stringify(param.defaultValue)) as unknown;
    }

    switch (param.type) {
      case 'boolean':
        return false;
      case 'integer':
        return 0;
      case 'object':
        return {};
      case 'array':
        return [];
      case 'string':
        return '';
    }
  });
}

export type SystemContractArtifact = {
  contractName: string;
  abi: unknown;
  bytecode: string | null;
};

export const EVM_SYSTEM_ARTIFACTS: SystemContractArtifact[] = [
  {
    contractName: 'EvmAuth',
    abi: [
      {
        inputs: [
          {
            components: [
              { internalType: 'bytes', name: 'key', type: 'bytes' },
              { internalType: 'uint64', name: 'offset', type: 'uint64' },
              { internalType: 'uint64', name: 'limit', type: 'uint64' },
              { internalType: 'bool', name: 'countTotal', type: 'bool' },
              { internalType: 'bool', name: 'reverse', type: 'bool' },
            ],
            internalType: 'struct PageRequest',
            name: 'pageRequest',
            type: 'tuple',
          },
        ],
        name: 'accounts',
        outputs: [
          {
            components: [
              { internalType: 'string', name: 'typeUrl', type: 'string' },
              { internalType: 'bytes', name: 'value', type: 'bytes' },
            ],
            internalType: 'struct ProtoAny[]',
            name: 'accounts_',
            type: 'tuple[]',
          },
          {
            components: [
              { internalType: 'bytes', name: 'nextKey', type: 'bytes' },
              { internalType: 'uint64', name: 'total', type: 'uint64' },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            components: [
              { internalType: 'bytes', name: 'key', type: 'bytes' },
              { internalType: 'uint64', name: 'offset', type: 'uint64' },
              { internalType: 'uint64', name: 'limit', type: 'uint64' },
              { internalType: 'bool', name: 'countTotal', type: 'bool' },
              { internalType: 'bool', name: 'reverse', type: 'bool' },
            ],
            internalType: 'struct PageRequest',
            name: 'pageRequest',
            type: 'tuple',
          },
        ],
        name: 'accountsAsJSON',
        outputs: [
          { internalType: 'string', name: 'accountsJson', type: 'string' },
          {
            components: [
              { internalType: 'bytes', name: 'nextKey', type: 'bytes' },
              { internalType: 'uint64', name: 'total', type: 'uint64' },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
        name: 'account',
        outputs: [
          {
            components: [
              { internalType: 'string', name: 'typeUrl', type: 'string' },
              { internalType: 'bytes', name: 'value', type: 'bytes' },
            ],
            internalType: 'struct ProtoAny',
            name: 'account_',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
        name: 'accountAsJSON',
        outputs: [{ internalType: 'string', name: 'accountJson', type: 'string' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'uint64', name: 'accountId', type: 'uint64' }],
        name: 'accountAddressByID',
        outputs: [{ internalType: 'string', name: 'accountAddress', type: 'string' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'params',
        outputs: [
          {
            components: [
              { internalType: 'uint64', name: 'maxMemoCharacters', type: 'uint64' },
              { internalType: 'uint64', name: 'txSigLimit', type: 'uint64' },
              { internalType: 'uint64', name: 'txSizeCostPerByte', type: 'uint64' },
              { internalType: 'uint64', name: 'sigVerifyCostED25519', type: 'uint64' },
              { internalType: 'uint64', name: 'sigVerifyCostSecp256k1', type: 'uint64' },
            ],
            internalType: 'struct AuthParams',
            name: 'params_',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'moduleAccounts',
        outputs: [
          {
            components: [
              { internalType: 'string', name: 'typeUrl', type: 'string' },
              { internalType: 'bytes', name: 'value', type: 'bytes' },
            ],
            internalType: 'struct ProtoAny[]',
            name: 'accounts_',
            type: 'tuple[]',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'moduleAccountsAsJSON',
        outputs: [{ internalType: 'string', name: 'accountsJson', type: 'string' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'string', name: 'name', type: 'string' }],
        name: 'moduleAccountByName',
        outputs: [
          {
            components: [
              { internalType: 'string', name: 'typeUrl', type: 'string' },
              { internalType: 'bytes', name: 'value', type: 'bytes' },
            ],
            internalType: 'struct ProtoAny',
            name: 'account_',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'string', name: 'name', type: 'string' }],
        name: 'moduleAccountByNameAsJSON',
        outputs: [{ internalType: 'string', name: 'accountJson', type: 'string' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'bech32Prefix',
        outputs: [{ internalType: 'string', name: 'bech32Prefix_', type: 'string' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'bytes', name: 'addressBytes', type: 'bytes' }],
        name: 'addressBytesToString',
        outputs: [{ internalType: 'string', name: 'addressString', type: 'string' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'string', name: 'addressString', type: 'string' }],
        name: 'addressStringToBytes',
        outputs: [{ internalType: 'bytes', name: 'addressBytes', type: 'bytes' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
        name: 'accountInfo',
        outputs: [
          {
            components: [
              { internalType: 'string', name: 'address', type: 'string' },
              {
                components: [
                  { internalType: 'string', name: 'typeUrl', type: 'string' },
                  { internalType: 'bytes', name: 'value', type: 'bytes' },
                ],
                internalType: 'struct ProtoAny',
                name: 'pubKey',
                type: 'tuple',
              },
              { internalType: 'uint64', name: 'accountNumber', type: 'uint64' },
              { internalType: 'uint64', name: 'sequence', type: 'uint64' },
            ],
            internalType: 'struct AccountInfo',
            name: 'info',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    bytecode: null,
  },
  {
    contractName: 'EvmBank',
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'fromAddress',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'toAddress',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'string',
            name: 'coins',
            type: 'string',
          },
        ],
        name: 'Send',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'fromAddress',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'toAddress',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'string',
            name: 'coins',
            type: 'string',
          },
        ],
        name: 'MultiSend',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'qoeAddress',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'string',
            name: 'coins',
            type: 'string',
          },
        ],
        name: 'MintCoins',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'qoeAddress',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'toAddress',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'string',
            name: 'coins',
            type: 'string',
          },
        ],
        name: 'DistributeCoins',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'fromAddress',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'string',
            name: 'coins',
            type: 'string',
          },
        ],
        name: 'BurnCoins',
        type: 'event',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'account',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'denom',
            type: 'string',
          },
        ],
        name: 'balance',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
            ],
            internalType: 'struct Coin',
            name: 'balance',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'account',
            type: 'address',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'key',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'offset',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'limit',
                type: 'uint64',
              },
              {
                internalType: 'bool',
                name: 'countTotal',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'reverse',
                type: 'bool',
              },
            ],
            internalType: 'struct PageRequest',
            name: 'pagination',
            type: 'tuple',
          },
        ],
        name: 'spendableBalances',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
            ],
            internalType: 'struct Coin[]',
            name: 'balances',
            type: 'tuple[]',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'nextKey',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'total',
                type: 'uint64',
              },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'account',
            type: 'address',
          },
        ],
        name: 'allBalances',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
            ],
            internalType: 'struct Coin[]',
            name: 'balances',
            type: 'tuple[]',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'account',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'denom',
            type: 'string',
          },
        ],
        name: 'spendableBalanceByDenom',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
            ],
            internalType: 'struct Coin',
            name: 'balance',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'totalSupply',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
            ],
            internalType: 'struct Coin[]',
            name: 'supply',
            type: 'tuple[]',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'denom',
            type: 'string',
          },
        ],
        name: 'supplyOf',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
            ],
            internalType: 'struct Coin',
            name: 'amount',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'params',
        outputs: [
          {
            components: [
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'bool',
                    name: 'enabled',
                    type: 'bool',
                  },
                ],
                internalType: 'struct SendEnabled[]',
                name: 'sendEnabled',
                type: 'tuple[]',
              },
              {
                internalType: 'bool',
                name: 'defaultSendEnabled',
                type: 'bool',
              },
            ],
            internalType: 'struct BankParams',
            name: 'params_',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            components: [
              {
                internalType: 'bytes',
                name: 'key',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'offset',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'limit',
                type: 'uint64',
              },
              {
                internalType: 'bool',
                name: 'countTotal',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'reverse',
                type: 'bool',
              },
            ],
            internalType: 'struct PageRequest',
            name: 'pagination',
            type: 'tuple',
          },
        ],
        name: 'denomsMetadata',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'description',
                type: 'string',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint32',
                    name: 'exponent',
                    type: 'uint32',
                  },
                  {
                    internalType: 'string[]',
                    name: 'aliases',
                    type: 'string[]',
                  },
                ],
                internalType: 'struct DenomUnit[]',
                name: 'denomUnits',
                type: 'tuple[]',
              },
              {
                internalType: 'string',
                name: 'base',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'display',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'name',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'symbol',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'uri',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'uriHash',
                type: 'string',
              },
            ],
            internalType: 'struct Metadata[]',
            name: 'metadatas',
            type: 'tuple[]',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'nextKey',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'total',
                type: 'uint64',
              },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'denom',
            type: 'string',
          },
        ],
        name: 'denomMetadata',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'description',
                type: 'string',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint32',
                    name: 'exponent',
                    type: 'uint32',
                  },
                  {
                    internalType: 'string[]',
                    name: 'aliases',
                    type: 'string[]',
                  },
                ],
                internalType: 'struct DenomUnit[]',
                name: 'denomUnits',
                type: 'tuple[]',
              },
              {
                internalType: 'string',
                name: 'base',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'display',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'name',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'symbol',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'uri',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'uriHash',
                type: 'string',
              },
            ],
            internalType: 'struct Metadata',
            name: 'metadata_',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'denom',
            type: 'string',
          },
        ],
        name: 'denomMetadataByQueryString',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'description',
                type: 'string',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint32',
                    name: 'exponent',
                    type: 'uint32',
                  },
                  {
                    internalType: 'string[]',
                    name: 'aliases',
                    type: 'string[]',
                  },
                ],
                internalType: 'struct DenomUnit[]',
                name: 'denomUnits',
                type: 'tuple[]',
              },
              {
                internalType: 'string',
                name: 'base',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'display',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'name',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'symbol',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'uri',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'uriHash',
                type: 'string',
              },
            ],
            internalType: 'struct Metadata',
            name: 'metadata_',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'denom',
            type: 'string',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'key',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'offset',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'limit',
                type: 'uint64',
              },
              {
                internalType: 'bool',
                name: 'countTotal',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'reverse',
                type: 'bool',
              },
            ],
            internalType: 'struct PageRequest',
            name: 'pagination',
            type: 'tuple',
          },
        ],
        name: 'denomOwners',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'address',
                type: 'string',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct Coin',
                name: 'balance',
                type: 'tuple',
              },
            ],
            internalType: 'struct DenomOwner[]',
            name: 'denomOwners_',
            type: 'tuple[]',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'nextKey',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'total',
                type: 'uint64',
              },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'denom',
            type: 'string',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'key',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'offset',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'limit',
                type: 'uint64',
              },
              {
                internalType: 'bool',
                name: 'countTotal',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'reverse',
                type: 'bool',
              },
            ],
            internalType: 'struct PageRequest',
            name: 'pagination',
            type: 'tuple',
          },
        ],
        name: 'denomOwnersByQuery',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'address',
                type: 'string',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct Coin',
                name: 'balance',
                type: 'tuple',
              },
            ],
            internalType: 'struct DenomOwner[]',
            name: 'denomOwners_',
            type: 'tuple[]',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'nextKey',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'total',
                type: 'uint64',
              },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string[]',
            name: 'denoms',
            type: 'string[]',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'key',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'offset',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'limit',
                type: 'uint64',
              },
              {
                internalType: 'bool',
                name: 'countTotal',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'reverse',
                type: 'bool',
              },
            ],
            internalType: 'struct PageRequest',
            name: 'pagination',
            type: 'tuple',
          },
        ],
        name: 'sendEnabled',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'bool',
                name: 'enabled',
                type: 'bool',
              },
            ],
            internalType: 'struct SendEnabled[]',
            name: 'sendEnabled_',
            type: 'tuple[]',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'nextKey',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'total',
                type: 'uint64',
              },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'fromAddress',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'toAddress',
            type: 'address',
          },
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
            ],
            internalType: 'struct Coin[]',
            name: 'amount',
            type: 'tuple[]',
          },
        ],
        name: 'send',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'fromAddress',
            type: 'address',
          },
          {
            components: [
              {
                internalType: 'address',
                name: 'toAddress',
                type: 'address',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct Coin[]',
                name: 'amount',
                type: 'tuple[]',
              },
            ],
            internalType: 'struct Output[]',
            name: 'outputs',
            type: 'tuple[]',
          },
        ],
        name: 'multiSend',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'qoeAddress',
            type: 'address',
          },
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
            ],
            internalType: 'struct Coin[]',
            name: 'amount',
            type: 'tuple[]',
          },
        ],
        name: 'mintCoins',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'qoeAddress',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'toAddress',
            type: 'address',
          },
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
            ],
            internalType: 'struct Coin[]',
            name: 'amount',
            type: 'tuple[]',
          },
        ],
        name: 'distributeCoins',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'fromAddress',
            type: 'address',
          },
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
            ],
            internalType: 'struct Coin[]',
            name: 'amount',
            type: 'tuple[]',
          },
        ],
        name: 'burnCoins',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    bytecode: null,
  },
  {
    contractName: 'EvmIBank',
    abi: [
      {
        inputs: [
          {
            internalType: 'address',
            name: 'account',
            type: 'address',
          },
        ],
        name: 'balances',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'contractAddress',
                type: 'address',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
            ],
            internalType: 'struct Balance[]',
            name: 'balances',
            type: 'tuple[]',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'erc20Address',
            type: 'address',
          },
        ],
        name: 'supplyOf',
        outputs: [
          {
            internalType: 'uint256',
            name: 'totalSupply',
            type: 'uint256',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'totalSupply',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'contractAddress',
                type: 'address',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
            ],
            internalType: 'struct Balance[]',
            name: 'totalSupply',
            type: 'tuple[]',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    bytecode: null,
  },
  {
    contractName: 'EvmBech32',
    abi: [
      {
        inputs: [
          {
            internalType: 'string',
            name: 'bech32Address',
            type: 'string',
          },
        ],
        name: 'bech32ToHex',
        outputs: [
          {
            internalType: 'address',
            name: 'addr',
            type: 'address',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'addr',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'prefix',
            type: 'string',
          },
        ],
        name: 'hexToBech32',
        outputs: [
          {
            internalType: 'string',
            name: 'bech32Address',
            type: 'string',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    bytecode: null,
  },
  {
    contractName: 'EvmBlacklist',
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'qoe',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'user',
            type: 'address',
          },
        ],
        name: 'AddToBlacklist',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'qoe',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'user',
            type: 'address',
          },
        ],
        name: 'RemoveFromBlacklist',
        type: 'event',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'user',
            type: 'address',
          },
        ],
        name: 'addToBlacklist',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            components: [
              {
                internalType: 'bytes',
                name: 'key',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'offset',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'limit',
                type: 'uint64',
              },
              {
                internalType: 'bool',
                name: 'countTotal',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'reverse',
                type: 'bool',
              },
            ],
            internalType: 'struct PageRequest',
            name: 'pagination',
            type: 'tuple',
          },
        ],
        name: 'blacklists',
        outputs: [
          {
            internalType: 'address[]',
            name: 'blacklists',
            type: 'address[]',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'nextKey',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'total',
                type: 'uint64',
              },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'user',
            type: 'address',
          },
        ],
        name: 'inBlacklist',
        outputs: [
          {
            internalType: 'bool',
            name: 'inBlacklist',
            type: 'bool',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'user',
            type: 'address',
          },
        ],
        name: 'removeFromBlacklist',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    bytecode: null,
  },
  {
    contractName: 'EvmDistribution',
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'qoeAddress',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'string',
            name: 'coins',
            type: 'string',
          },
        ],
        name: 'DividendRewards',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'qoeAddress',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'toAddress',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'string',
            name: 'coins',
            type: 'string',
          },
        ],
        name: 'WithdrawRoyaltyFee',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'delegatorAddress',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        name: 'ClaimRewards',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'depositor',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'validatorAddress',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'string',
            name: 'denom',
            type: 'string',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        name: 'DepositValidatorRewardsPool',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'depositor',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'string',
            name: 'denom',
            type: 'string',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        name: 'FundCommunityPool',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'caller',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'string',
            name: 'withdrawerAddress',
            type: 'string',
          },
        ],
        name: 'SetWithdrawerAddress',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'delegatorAddress',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'validatorAddress',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        name: 'WithdrawDelegatorReward',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'string',
            name: 'validatorAddress',
            type: 'string',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'commission',
            type: 'uint256',
          },
        ],
        name: 'WithdrawValidatorCommission',
        type: 'event',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'delegatorAddress',
            type: 'address',
          },
          {
            internalType: 'uint32',
            name: 'maxRetrieve',
            type: 'uint32',
          },
        ],
        name: 'claimRewards',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [],
        name: 'params',
        outputs: [
          {
            components: [
              {
                components: [
                  {
                    internalType: 'uint256',
                    name: 'value',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint8',
                    name: 'precision',
                    type: 'uint8',
                  },
                ],
                internalType: 'struct Dec',
                name: 'communityTax',
                type: 'tuple',
              },
              {
                components: [
                  {
                    internalType: 'uint256',
                    name: 'value',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint8',
                    name: 'precision',
                    type: 'uint8',
                  },
                ],
                internalType: 'struct Dec',
                name: 'baseProposerReward',
                type: 'tuple',
              },
              {
                components: [
                  {
                    internalType: 'uint256',
                    name: 'value',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint8',
                    name: 'precision',
                    type: 'uint8',
                  },
                ],
                internalType: 'struct Dec',
                name: 'bonusProposerReward',
                type: 'tuple',
              },
              {
                internalType: 'bool',
                name: 'withdrawAddrEnabled',
                type: 'bool',
              },
            ],
            internalType: 'struct DistributionParams',
            name: 'params_',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'communityPool',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
              {
                internalType: 'uint8',
                name: 'precision',
                type: 'uint8',
              },
            ],
            internalType: 'struct DecCoin[]',
            name: 'coins',
            type: 'tuple[]',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'delegatorAddress',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'validatorAddress',
            type: 'string',
          },
        ],
        name: 'delegatorStartingInfo',
        outputs: [
          {
            components: [
              {
                internalType: 'uint64',
                name: 'previousPeriod',
                type: 'uint64',
              },
              {
                components: [
                  {
                    internalType: 'uint256',
                    name: 'value',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint8',
                    name: 'precision',
                    type: 'uint8',
                  },
                ],
                internalType: 'struct Dec',
                name: 'stake',
                type: 'tuple',
              },
              {
                internalType: 'uint64',
                name: 'height',
                type: 'uint64',
              },
            ],
            internalType: 'struct DelegatorStartingInfo',
            name: 'startingInfo',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'delegatorAddress',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'validatorAddress',
            type: 'string',
          },
        ],
        name: 'delegationRewards',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
              {
                internalType: 'uint8',
                name: 'precision',
                type: 'uint8',
              },
            ],
            internalType: 'struct DecCoin[]',
            name: 'rewards',
            type: 'tuple[]',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'delegatorAddress',
            type: 'address',
          },
        ],
        name: 'delegationTotalRewards',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'validatorAddress',
                type: 'string',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint8',
                    name: 'precision',
                    type: 'uint8',
                  },
                ],
                internalType: 'struct DecCoin[]',
                name: 'reward',
                type: 'tuple[]',
              },
            ],
            internalType: 'struct DelegationDelegatorReward[]',
            name: 'rewards',
            type: 'tuple[]',
          },
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
              {
                internalType: 'uint8',
                name: 'precision',
                type: 'uint8',
              },
            ],
            internalType: 'struct DecCoin[]',
            name: 'total',
            type: 'tuple[]',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'delegatorAddress',
            type: 'address',
          },
        ],
        name: 'delegatorValidators',
        outputs: [
          {
            internalType: 'string[]',
            name: 'validators',
            type: 'string[]',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'delegatorAddress',
            type: 'address',
          },
        ],
        name: 'delegatorWithdrawAddress',
        outputs: [
          {
            internalType: 'string',
            name: 'withdrawAddress',
            type: 'string',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'depositor',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'validatorAddress',
            type: 'string',
          },
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
            ],
            internalType: 'struct Coin[]',
            name: 'amount',
            type: 'tuple[]',
          },
        ],
        name: 'depositValidatorRewardsPool',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'depositor',
            type: 'address',
          },
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
            ],
            internalType: 'struct Coin[]',
            name: 'amount',
            type: 'tuple[]',
          },
        ],
        name: 'fundCommunityPool',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'delegatorAddress',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'withdrawerAddress',
            type: 'string',
          },
        ],
        name: 'setWithdrawAddress',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'validatorAddress',
            type: 'string',
          },
        ],
        name: 'validatorCommission',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
              {
                internalType: 'uint8',
                name: 'precision',
                type: 'uint8',
              },
            ],
            internalType: 'struct DecCoin[]',
            name: 'commission',
            type: 'tuple[]',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'validatorAddress',
            type: 'string',
          },
        ],
        name: 'validatorCurrentRewards',
        outputs: [
          {
            components: [
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint8',
                    name: 'precision',
                    type: 'uint8',
                  },
                ],
                internalType: 'struct DecCoin[]',
                name: 'rewards',
                type: 'tuple[]',
              },
              {
                internalType: 'uint64',
                name: 'period',
                type: 'uint64',
              },
            ],
            internalType: 'struct ValidatorCurrentRewards',
            name: 'rewards',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'validatorAddress',
            type: 'string',
          },
        ],
        name: 'validatorDistributionInfo',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'operatorAddress',
                type: 'string',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint8',
                    name: 'precision',
                    type: 'uint8',
                  },
                ],
                internalType: 'struct DecCoin[]',
                name: 'selfBondRewards',
                type: 'tuple[]',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint8',
                    name: 'precision',
                    type: 'uint8',
                  },
                ],
                internalType: 'struct DecCoin[]',
                name: 'commission',
                type: 'tuple[]',
              },
            ],
            internalType: 'struct ValidatorDistributionInfo',
            name: 'distributionInfo',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'validatorAddress',
            type: 'string',
          },
          {
            internalType: 'uint64',
            name: 'period',
            type: 'uint64',
          },
        ],
        name: 'validatorHistoricalRewards',
        outputs: [
          {
            components: [
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint8',
                    name: 'precision',
                    type: 'uint8',
                  },
                ],
                internalType: 'struct DecCoin[]',
                name: 'cumulativeRewardRatio',
                type: 'tuple[]',
              },
              {
                internalType: 'uint32',
                name: 'referenceCount',
                type: 'uint32',
              },
            ],
            internalType: 'struct ValidatorHistoricalRewards',
            name: 'rewards',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'validatorAddress',
            type: 'string',
          },
        ],
        name: 'validatorOutstandingRewards',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
              {
                internalType: 'uint8',
                name: 'precision',
                type: 'uint8',
              },
            ],
            internalType: 'struct DecCoin[]',
            name: 'rewards',
            type: 'tuple[]',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'validatorAddress',
            type: 'string',
          },
          {
            internalType: 'uint64',
            name: 'startingHeight',
            type: 'uint64',
          },
          {
            internalType: 'uint64',
            name: 'endingHeight',
            type: 'uint64',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'key',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'offset',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'limit',
                type: 'uint64',
              },
              {
                internalType: 'bool',
                name: 'countTotal',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'reverse',
                type: 'bool',
              },
            ],
            internalType: 'struct PageRequest',
            name: 'pageRequest',
            type: 'tuple',
          },
        ],
        name: 'validatorSlashes',
        outputs: [
          {
            components: [
              {
                internalType: 'uint64',
                name: 'validatorPeriod',
                type: 'uint64',
              },
              {
                components: [
                  {
                    internalType: 'uint256',
                    name: 'value',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint8',
                    name: 'precision',
                    type: 'uint8',
                  },
                ],
                internalType: 'struct Dec',
                name: 'fraction',
                type: 'tuple',
              },
            ],
            internalType: 'struct ValidatorSlashEvent[]',
            name: 'slashes',
            type: 'tuple[]',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'nextKey',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'total',
                type: 'uint64',
              },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'delegatorAddress',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'validatorAddress',
            type: 'string',
          },
        ],
        name: 'withdrawDelegatorRewards',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
            ],
            internalType: 'struct Coin[]',
            name: 'amount',
            type: 'tuple[]',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'validatorAddress',
            type: 'string',
          },
        ],
        name: 'withdrawValidatorCommission',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
            ],
            internalType: 'struct Coin[]',
            name: 'amount',
            type: 'tuple[]',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'qoeAddress',
            type: 'address',
          },
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
            ],
            internalType: 'struct Coin[]',
            name: 'amount',
            type: 'tuple[]',
          },
        ],
        name: 'dividendRewards',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'qoeAddress',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'toAddress',
            type: 'address',
          },
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
            ],
            internalType: 'struct Coin[]',
            name: 'amount',
            type: 'tuple[]',
          },
        ],
        name: 'withdrawRoyaltyFee',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [],
        name: 'royaltyFee',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
              {
                internalType: 'uint8',
                name: 'precision',
                type: 'uint8',
              },
            ],
            internalType: 'struct DecCoin[]',
            name: 'royaltyFee',
            type: 'tuple[]',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    bytecode: null,
  },
  {
    contractName: 'EvmErc20',
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'sender',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'contractAddress',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'receiver',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        name: 'ConvertERC20',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'sender',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'receiver',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'string',
            name: 'denom',
            type: 'string',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        name: 'ConvertCoin',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'sender',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'erc20Address',
            type: 'address',
          },
        ],
        name: 'RegisterERC20',
        type: 'event',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'contractAddress',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'receiver',
            type: 'string',
          },
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        name: 'convertERC20',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'denom',
            type: 'string',
          },
          {
            internalType: 'address',
            name: 'receiver',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        name: 'convertCoin',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [],
        name: 'params',
        outputs: [
          {
            components: [
              {
                internalType: 'bool',
                name: 'enableErc20',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'permissionlessRegistration',
                type: 'bool',
              },
            ],
            internalType: 'struct ERC20ModuleParams',
            name: 'params_',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address[]',
            name: 'erc20Addresses',
            type: 'address[]',
          },
        ],
        name: 'registerERC20',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'token',
            type: 'string',
          },
        ],
        name: 'tokenPair',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'erc20Address',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'bool',
                name: 'enabled',
                type: 'bool',
              },
              {
                internalType: 'int32',
                name: 'contractOwner',
                type: 'int32',
              },
            ],
            internalType: 'struct ERC20TokenPair',
            name: 'tokenPair_',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            components: [
              {
                internalType: 'bytes',
                name: 'key',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'offset',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'limit',
                type: 'uint64',
              },
              {
                internalType: 'bool',
                name: 'countTotal',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'reverse',
                type: 'bool',
              },
            ],
            internalType: 'struct PageRequest',
            name: 'pageRequest',
            type: 'tuple',
          },
        ],
        name: 'tokenPairs',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'erc20Address',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'bool',
                name: 'enabled',
                type: 'bool',
              },
              {
                internalType: 'int32',
                name: 'contractOwner',
                type: 'int32',
              },
            ],
            internalType: 'struct ERC20TokenPair[]',
            name: 'tokenPairs_',
            type: 'tuple[]',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'nextKey',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'total',
                type: 'uint64',
              },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    bytecode: null,
  },
  {
    contractName: 'EvmIERC20',
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'owner',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'spender',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'value',
            type: 'uint256',
          },
        ],
        name: 'Approval',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'from',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'to',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'value',
            type: 'uint256',
          },
        ],
        name: 'Transfer',
        type: 'event',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'owner',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'spender',
            type: 'address',
          },
        ],
        name: 'allowance',
        outputs: [
          {
            internalType: 'uint256',
            name: '',
            type: 'uint256',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'spender',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        name: 'approve',
        outputs: [
          {
            internalType: 'bool',
            name: '',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'account',
            type: 'address',
          },
        ],
        name: 'balanceOf',
        outputs: [
          {
            internalType: 'uint256',
            name: '',
            type: 'uint256',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'decimals',
        outputs: [
          {
            internalType: 'uint8',
            name: '',
            type: 'uint8',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'name',
        outputs: [
          {
            internalType: 'string',
            name: '',
            type: 'string',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'symbol',
        outputs: [
          {
            internalType: 'string',
            name: '',
            type: 'string',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'totalSupply',
        outputs: [
          {
            internalType: 'uint256',
            name: '',
            type: 'uint256',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'to',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        name: 'transfer',
        outputs: [
          {
            internalType: 'bool',
            name: '',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'from',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'to',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        name: 'transferFrom',
        outputs: [
          {
            internalType: 'bool',
            name: '',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    bytecode: null,
  },
  {
    contractName: 'EvmEvidence',
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'submitter',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'bytes',
            name: 'hash',
            type: 'bytes',
          },
          {
            indexed: false,
            internalType: 'string',
            name: 'consensusAddress',
            type: 'string',
          },
        ],
        name: 'SubmitEquivocation',
        type: 'event',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'hash',
            type: 'string',
          },
        ],
        name: 'evidence',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'hash',
                type: 'string',
              },
              {
                internalType: 'int64',
                name: 'height',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'timeUnix',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'power',
                type: 'int64',
              },
              {
                internalType: 'string',
                name: 'consensusAddress',
                type: 'string',
              },
            ],
            internalType: 'struct EvidenceData',
            name: 'evidence_',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            components: [
              {
                internalType: 'bytes',
                name: 'key',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'offset',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'limit',
                type: 'uint64',
              },
              {
                internalType: 'bool',
                name: 'countTotal',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'reverse',
                type: 'bool',
              },
            ],
            internalType: 'struct PageRequest',
            name: 'pageRequest',
            type: 'tuple',
          },
        ],
        name: 'allEvidence',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'hash',
                type: 'string',
              },
              {
                internalType: 'int64',
                name: 'height',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'timeUnix',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'power',
                type: 'int64',
              },
              {
                internalType: 'string',
                name: 'consensusAddress',
                type: 'string',
              },
            ],
            internalType: 'struct EvidenceData[]',
            name: 'evidence_',
            type: 'tuple[]',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'nextKey',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'total',
                type: 'uint64',
              },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'int64',
            name: 'height',
            type: 'int64',
          },
          {
            internalType: 'int64',
            name: 'timeUnix',
            type: 'int64',
          },
          {
            internalType: 'int64',
            name: 'power',
            type: 'int64',
          },
          {
            internalType: 'string',
            name: 'consensusAddress',
            type: 'string',
          },
        ],
        name: 'submitEquivocation',
        outputs: [
          {
            internalType: 'bytes',
            name: 'hash',
            type: 'bytes',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    bytecode: null,
  },
  {
    contractName: 'EvmFeemarket',
    abi: [
      {
        inputs: [],
        name: 'params',
        outputs: [
          {
            components: [
              {
                internalType: 'bool',
                name: 'noBaseFee',
                type: 'bool',
              },
              {
                internalType: 'uint32',
                name: 'baseFeeChangeDenominator',
                type: 'uint32',
              },
              {
                internalType: 'uint32',
                name: 'elasticityMultiplier',
                type: 'uint32',
              },
              {
                internalType: 'int64',
                name: 'enableHeight',
                type: 'int64',
              },
              {
                internalType: 'string',
                name: 'baseFee',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'minGasPrice',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'minGasMultiplier',
                type: 'string',
              },
            ],
            internalType: 'struct FeemarketParams',
            name: 'params_',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'baseFee',
        outputs: [
          {
            internalType: 'string',
            name: 'baseFee_',
            type: 'string',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'blockGas',
        outputs: [
          {
            internalType: 'int64',
            name: 'gas',
            type: 'int64',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    bytecode: null,
  },
  {
    contractName: 'EvmGaswaiver',
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'owner',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'contractAddress',
            type: 'address',
          },
        ],
        name: 'GrantGasWaiverGranter',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'sender',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'contractAddress',
            type: 'address',
          },
        ],
        name: 'RevokeGasWaiverGranter',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'granter',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'contractAddress',
            type: 'address',
          },
        ],
        name: 'ApplyGasWaiverGranter',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'sender',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'contractAddress',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'applicant',
            type: 'address',
          },
        ],
        name: 'CancelApplication',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'owner',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'contractAddress',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'granter',
            type: 'address',
          },
        ],
        name: 'ApproveApplication',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'owner',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'contractAddress',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'grantee',
            type: 'address',
          },
        ],
        name: 'GrantPremiumGasWaiver',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'granter',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'contractAddress',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'grantee',
            type: 'address',
          },
        ],
        name: 'RevokePremiumGasWaiver',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'granter',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'contractAddress',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'grantee',
            type: 'address',
          },
        ],
        name: 'UpdateAllowance',
        type: 'event',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'contractAddress',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'expiration',
            type: 'string',
          },
          {
            components: [
              {
                internalType: 'uint8',
                name: 'allowanceType',
                type: 'uint8',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct Coin',
                name: 'spendLimit',
                type: 'tuple',
              },
              {
                internalType: 'int64',
                name: 'period',
                type: 'int64',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct Coin',
                name: 'periodSpendLimit',
                type: 'tuple',
              },
              {
                internalType: 'int64',
                name: 'periodReset',
                type: 'int64',
              },
            ],
            internalType: 'struct Allowance',
            name: 'allowance',
            type: 'tuple',
          },
        ],
        name: 'grantGasWaiverGranter',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'contractAddress',
            type: 'address',
          },
        ],
        name: 'revokeGasWaiverGranter',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'contractAddress',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'expiration',
            type: 'string',
          },
          {
            components: [
              {
                internalType: 'uint8',
                name: 'allowanceType',
                type: 'uint8',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct Coin',
                name: 'spendLimit',
                type: 'tuple',
              },
              {
                internalType: 'int64',
                name: 'period',
                type: 'int64',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct Coin',
                name: 'periodSpendLimit',
                type: 'tuple',
              },
              {
                internalType: 'int64',
                name: 'periodReset',
                type: 'int64',
              },
            ],
            internalType: 'struct Allowance',
            name: 'allowance',
            type: 'tuple',
          },
          {
            internalType: 'int64',
            name: 'applyPeriod',
            type: 'int64',
          },
        ],
        name: 'applyGasWaiverGranter',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'contractAddress',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'applicant',
            type: 'address',
          },
        ],
        name: 'cancelApplication',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'contractAddress',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'granter',
            type: 'address',
          },
        ],
        name: 'approveApplication',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'contractAddress',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'grantee',
            type: 'address',
          },
          {
            components: [
              {
                internalType: 'uint8',
                name: 'allowanceType',
                type: 'uint8',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct Coin',
                name: 'spendLimit',
                type: 'tuple',
              },
              {
                internalType: 'int64',
                name: 'period',
                type: 'int64',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct Coin',
                name: 'periodSpendLimit',
                type: 'tuple',
              },
              {
                internalType: 'int64',
                name: 'periodReset',
                type: 'int64',
              },
            ],
            internalType: 'struct Allowance',
            name: 'allowance',
            type: 'tuple',
          },
        ],
        name: 'grantPremiumGasWaiver',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'contractAddress',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'grantee',
            type: 'address',
          },
        ],
        name: 'revokePremiumGasWaiver',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'contractAddress',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'grantee',
            type: 'address',
          },
          {
            components: [
              {
                internalType: 'uint8',
                name: 'allowanceType',
                type: 'uint8',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct Coin',
                name: 'spendLimit',
                type: 'tuple',
              },
              {
                internalType: 'int64',
                name: 'period',
                type: 'int64',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct Coin',
                name: 'periodSpendLimit',
                type: 'tuple',
              },
              {
                internalType: 'int64',
                name: 'periodReset',
                type: 'int64',
              },
            ],
            internalType: 'struct Allowance',
            name: 'allowance',
            type: 'tuple',
          },
        ],
        name: 'updateAllowance',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'contractAddress',
            type: 'address',
          },
        ],
        name: 'gasWaiverGranterInfo',
        outputs: [
          {
            internalType: 'address',
            name: 'granter',
            type: 'address',
          },
          {
            internalType: 'int64',
            name: 'expiration',
            type: 'int64',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'contractAddress',
            type: 'address',
          },
        ],
        name: 'normalGasWaiver',
        outputs: [
          {
            internalType: 'address',
            name: 'granter',
            type: 'address',
          },
          {
            components: [
              {
                internalType: 'address',
                name: 'contractAddress',
                type: 'address',
              },
              {
                components: [
                  {
                    internalType: 'uint8',
                    name: 'allowanceType',
                    type: 'uint8',
                  },
                  {
                    components: [
                      {
                        internalType: 'string',
                        name: 'denom',
                        type: 'string',
                      },
                      {
                        internalType: 'uint256',
                        name: 'amount',
                        type: 'uint256',
                      },
                    ],
                    internalType: 'struct Coin',
                    name: 'spendLimit',
                    type: 'tuple',
                  },
                  {
                    internalType: 'int64',
                    name: 'period',
                    type: 'int64',
                  },
                  {
                    components: [
                      {
                        internalType: 'string',
                        name: 'denom',
                        type: 'string',
                      },
                      {
                        internalType: 'uint256',
                        name: 'amount',
                        type: 'uint256',
                      },
                    ],
                    internalType: 'struct Coin',
                    name: 'periodSpendLimit',
                    type: 'tuple',
                  },
                  {
                    internalType: 'int64',
                    name: 'periodReset',
                    type: 'int64',
                  },
                ],
                internalType: 'struct Allowance',
                name: 'allowance',
                type: 'tuple',
              },
              {
                internalType: 'address',
                name: 'owner',
                type: 'address',
              },
              {
                internalType: 'int64',
                name: 'createdAt',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'updateAt',
                type: 'int64',
              },
            ],
            internalType: 'struct NormalGasWaiver',
            name: 'waiver',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'contractAddress',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'grantee',
            type: 'address',
          },
        ],
        name: 'normalGasWaiverMeter',
        outputs: [
          {
            components: [
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct Coin',
                name: 'totalUsage',
                type: 'tuple',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct Coin',
                name: 'periodicUsage',
                type: 'tuple',
              },
              {
                internalType: 'int64',
                name: 'periodReset',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'period',
                type: 'int64',
              },
            ],
            internalType: 'struct AccountGasWaiverMeter',
            name: 'meter',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'granter',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'owner',
            type: 'address',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'key',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'offset',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'limit',
                type: 'uint64',
              },
              {
                internalType: 'bool',
                name: 'countTotal',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'reverse',
                type: 'bool',
              },
            ],
            internalType: 'struct PageRequest',
            name: 'pagination',
            type: 'tuple',
          },
        ],
        name: 'gasWaiverApplications',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'granter',
                type: 'address',
              },
              {
                internalType: 'string',
                name: 'expiration',
                type: 'string',
              },
              {
                internalType: 'address',
                name: 'contractAddress',
                type: 'address',
              },
              {
                components: [
                  {
                    internalType: 'uint8',
                    name: 'allowanceType',
                    type: 'uint8',
                  },
                  {
                    components: [
                      {
                        internalType: 'string',
                        name: 'denom',
                        type: 'string',
                      },
                      {
                        internalType: 'uint256',
                        name: 'amount',
                        type: 'uint256',
                      },
                    ],
                    internalType: 'struct Coin',
                    name: 'spendLimit',
                    type: 'tuple',
                  },
                  {
                    internalType: 'int64',
                    name: 'period',
                    type: 'int64',
                  },
                  {
                    components: [
                      {
                        internalType: 'string',
                        name: 'denom',
                        type: 'string',
                      },
                      {
                        internalType: 'uint256',
                        name: 'amount',
                        type: 'uint256',
                      },
                    ],
                    internalType: 'struct Coin',
                    name: 'periodSpendLimit',
                    type: 'tuple',
                  },
                  {
                    internalType: 'int64',
                    name: 'periodReset',
                    type: 'int64',
                  },
                ],
                internalType: 'struct Allowance',
                name: 'allowance',
                type: 'tuple',
              },
              {
                internalType: 'address',
                name: 'owner',
                type: 'address',
              },
              {
                internalType: 'string',
                name: 'applyEndTime',
                type: 'string',
              },
            ],
            internalType: 'struct GasWaiverApplication[]',
            name: 'applications',
            type: 'tuple[]',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'nextKey',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'total',
                type: 'uint64',
              },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'contractAddress',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'grantee',
            type: 'address',
          },
        ],
        name: 'premiumGasWaiver',
        outputs: [
          {
            internalType: 'address',
            name: 'granter',
            type: 'address',
          },
          {
            components: [
              {
                internalType: 'address',
                name: 'contractAddress',
                type: 'address',
              },
              {
                components: [
                  {
                    internalType: 'uint8',
                    name: 'allowanceType',
                    type: 'uint8',
                  },
                  {
                    components: [
                      {
                        internalType: 'string',
                        name: 'denom',
                        type: 'string',
                      },
                      {
                        internalType: 'uint256',
                        name: 'amount',
                        type: 'uint256',
                      },
                    ],
                    internalType: 'struct Coin',
                    name: 'spendLimit',
                    type: 'tuple',
                  },
                  {
                    internalType: 'int64',
                    name: 'period',
                    type: 'int64',
                  },
                  {
                    components: [
                      {
                        internalType: 'string',
                        name: 'denom',
                        type: 'string',
                      },
                      {
                        internalType: 'uint256',
                        name: 'amount',
                        type: 'uint256',
                      },
                    ],
                    internalType: 'struct Coin',
                    name: 'periodSpendLimit',
                    type: 'tuple',
                  },
                  {
                    internalType: 'int64',
                    name: 'periodReset',
                    type: 'int64',
                  },
                ],
                internalType: 'struct Allowance',
                name: 'allowance',
                type: 'tuple',
              },
              {
                internalType: 'address',
                name: 'owner',
                type: 'address',
              },
              {
                internalType: 'int64',
                name: 'createdAt',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'updateAt',
                type: 'int64',
              },
            ],
            internalType: 'struct NormalGasWaiver',
            name: 'waiver',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'contractAddress',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'grantee',
            type: 'address',
          },
        ],
        name: 'premiumGasWaiverMeter',
        outputs: [
          {
            components: [
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct Coin',
                name: 'totalUsage',
                type: 'tuple',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct Coin',
                name: 'periodicUsage',
                type: 'tuple',
              },
              {
                internalType: 'int64',
                name: 'periodReset',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'period',
                type: 'int64',
              },
            ],
            internalType: 'struct AccountGasWaiverMeter',
            name: 'meter',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'owner',
            type: 'address',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'key',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'offset',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'limit',
                type: 'uint64',
              },
              {
                internalType: 'bool',
                name: 'countTotal',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'reverse',
                type: 'bool',
              },
            ],
            internalType: 'struct PageRequest',
            name: 'pagination',
            type: 'tuple',
          },
        ],
        name: 'normalGasWaivers',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'contractAddress',
                type: 'address',
              },
              {
                components: [
                  {
                    internalType: 'uint8',
                    name: 'allowanceType',
                    type: 'uint8',
                  },
                  {
                    components: [
                      {
                        internalType: 'string',
                        name: 'denom',
                        type: 'string',
                      },
                      {
                        internalType: 'uint256',
                        name: 'amount',
                        type: 'uint256',
                      },
                    ],
                    internalType: 'struct Coin',
                    name: 'spendLimit',
                    type: 'tuple',
                  },
                  {
                    internalType: 'int64',
                    name: 'period',
                    type: 'int64',
                  },
                  {
                    components: [
                      {
                        internalType: 'string',
                        name: 'denom',
                        type: 'string',
                      },
                      {
                        internalType: 'uint256',
                        name: 'amount',
                        type: 'uint256',
                      },
                    ],
                    internalType: 'struct Coin',
                    name: 'periodSpendLimit',
                    type: 'tuple',
                  },
                  {
                    internalType: 'int64',
                    name: 'periodReset',
                    type: 'int64',
                  },
                ],
                internalType: 'struct Allowance',
                name: 'allowance',
                type: 'tuple',
              },
              {
                internalType: 'address',
                name: 'owner',
                type: 'address',
              },
              {
                internalType: 'int64',
                name: 'createdAt',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'updateAt',
                type: 'int64',
              },
            ],
            internalType: 'struct NormalGasWaiver[]',
            name: 'waivers',
            type: 'tuple[]',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'nextKey',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'total',
                type: 'uint64',
              },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'contractAddress',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'granter',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'grantee',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        name: 'UseGasWaiver',
        type: 'event',
      },
    ],
    bytecode: null,
  },
  {
    contractName: 'EvmGov',
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'voter',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint64',
            name: 'proposalId',
            type: 'uint64',
          },
        ],
        name: 'Veto',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'voter',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint64',
            name: 'proposalId',
            type: 'uint64',
          },
        ],
        name: 'SkipVeto',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'authority',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'penaltyPool',
            type: 'address',
          },
        ],
        name: 'SetPenaltyPool',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'proposer',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint64',
            name: 'proposalId',
            type: 'uint64',
          },
        ],
        name: 'CancelProposal',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'depositor',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint64',
            name: 'proposalId',
            type: 'uint64',
          },
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
            ],
            indexed: false,
            internalType: 'struct Coin[]',
            name: 'amount',
            type: 'tuple[]',
          },
        ],
        name: 'Deposit',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'proposer',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint64',
            name: 'proposalId',
            type: 'uint64',
          },
        ],
        name: 'SubmitProposal',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'voter',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint64',
            name: 'proposalId',
            type: 'uint64',
          },
          {
            indexed: false,
            internalType: 'enum VoteOption',
            name: 'option',
            type: 'uint8',
          },
        ],
        name: 'Vote',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'voter',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint64',
            name: 'proposalId',
            type: 'uint64',
          },
          {
            components: [
              {
                internalType: 'enum VoteOption',
                name: 'option',
                type: 'uint8',
              },
              {
                internalType: 'string',
                name: 'weight',
                type: 'string',
              },
            ],
            indexed: false,
            internalType: 'struct WeightedVoteOption[]',
            name: 'options',
            type: 'tuple[]',
          },
        ],
        name: 'VoteWeighted',
        type: 'event',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'proposer',
            type: 'address',
          },
          {
            internalType: 'uint64',
            name: 'proposalId',
            type: 'uint64',
          },
        ],
        name: 'cancelProposal',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'depositor',
            type: 'address',
          },
          {
            internalType: 'uint64',
            name: 'proposalId',
            type: 'uint64',
          },
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
            ],
            internalType: 'struct Coin[]',
            name: 'amount',
            type: 'tuple[]',
          },
        ],
        name: 'deposit',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [],
        name: 'getConstitution',
        outputs: [
          {
            internalType: 'string',
            name: 'constitution',
            type: 'string',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'uint64',
            name: 'proposalId',
            type: 'uint64',
          },
          {
            internalType: 'address',
            name: 'depositor',
            type: 'address',
          },
        ],
        name: 'getDeposit',
        outputs: [
          {
            components: [
              {
                internalType: 'uint64',
                name: 'proposalId',
                type: 'uint64',
              },
              {
                internalType: 'address',
                name: 'depositor',
                type: 'address',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct Coin[]',
                name: 'amount',
                type: 'tuple[]',
              },
            ],
            internalType: 'struct DepositData',
            name: 'deposit',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'uint64',
            name: 'proposalId',
            type: 'uint64',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'key',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'offset',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'limit',
                type: 'uint64',
              },
              {
                internalType: 'bool',
                name: 'countTotal',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'reverse',
                type: 'bool',
              },
            ],
            internalType: 'struct PageRequest',
            name: 'pagination',
            type: 'tuple',
          },
        ],
        name: 'getDeposits',
        outputs: [
          {
            components: [
              {
                internalType: 'uint64',
                name: 'proposalId',
                type: 'uint64',
              },
              {
                internalType: 'address',
                name: 'depositor',
                type: 'address',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct Coin[]',
                name: 'amount',
                type: 'tuple[]',
              },
            ],
            internalType: 'struct DepositData[]',
            name: 'deposits',
            type: 'tuple[]',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'nextKey',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'total',
                type: 'uint64',
              },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'getParams',
        outputs: [
          {
            components: [
              {
                internalType: 'int64',
                name: 'votingPeriod',
                type: 'int64',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct Coin[]',
                name: 'minDeposit',
                type: 'tuple[]',
              },
              {
                internalType: 'int64',
                name: 'maxDepositPeriod',
                type: 'int64',
              },
              {
                internalType: 'string',
                name: 'quorum',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'threshold',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'vetoThreshold',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'minInitialDepositRatio',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'proposalCancelRatio',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'proposalCancelDest',
                type: 'string',
              },
              {
                internalType: 'int64',
                name: 'expeditedVotingPeriod',
                type: 'int64',
              },
              {
                internalType: 'string',
                name: 'expeditedThreshold',
                type: 'string',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct Coin[]',
                name: 'expeditedMinDeposit',
                type: 'tuple[]',
              },
              {
                internalType: 'bool',
                name: 'burnVoteQuorum',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'burnProposalDepositPrevote',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'burnVoteVeto',
                type: 'bool',
              },
              {
                internalType: 'string',
                name: 'minDepositRatio',
                type: 'string',
              },
            ],
            internalType: 'struct Params',
            name: 'params',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'uint64',
            name: 'proposalId',
            type: 'uint64',
          },
        ],
        name: 'getProposal',
        outputs: [
          {
            components: [
              {
                internalType: 'uint64',
                name: 'id',
                type: 'uint64',
              },
              {
                internalType: 'string[]',
                name: 'messages',
                type: 'string[]',
              },
              {
                internalType: 'uint32',
                name: 'status',
                type: 'uint32',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'yes',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'abstain',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'no',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'noWithVeto',
                    type: 'string',
                  },
                ],
                internalType: 'struct TallyResultData',
                name: 'finalTallyResult',
                type: 'tuple',
              },
              {
                internalType: 'int64',
                name: 'submitTime',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'depositEndTime',
                type: 'int64',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct Coin[]',
                name: 'totalDeposit',
                type: 'tuple[]',
              },
              {
                internalType: 'int64',
                name: 'votingStartTime',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'votingEndTime',
                type: 'int64',
              },
              {
                internalType: 'string',
                name: 'metadata',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'title',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'summary',
                type: 'string',
              },
              {
                internalType: 'address',
                name: 'proposer',
                type: 'address',
              },
            ],
            internalType: 'struct ProposalData',
            name: 'proposal',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'uint32',
            name: 'proposalStatus',
            type: 'uint32',
          },
          {
            internalType: 'address',
            name: 'voter',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'depositor',
            type: 'address',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'key',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'offset',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'limit',
                type: 'uint64',
              },
              {
                internalType: 'bool',
                name: 'countTotal',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'reverse',
                type: 'bool',
              },
            ],
            internalType: 'struct PageRequest',
            name: 'pagination',
            type: 'tuple',
          },
        ],
        name: 'getProposals',
        outputs: [
          {
            components: [
              {
                internalType: 'uint64',
                name: 'id',
                type: 'uint64',
              },
              {
                internalType: 'string[]',
                name: 'messages',
                type: 'string[]',
              },
              {
                internalType: 'uint32',
                name: 'status',
                type: 'uint32',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'yes',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'abstain',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'no',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'noWithVeto',
                    type: 'string',
                  },
                ],
                internalType: 'struct TallyResultData',
                name: 'finalTallyResult',
                type: 'tuple',
              },
              {
                internalType: 'int64',
                name: 'submitTime',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'depositEndTime',
                type: 'int64',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct Coin[]',
                name: 'totalDeposit',
                type: 'tuple[]',
              },
              {
                internalType: 'int64',
                name: 'votingStartTime',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'votingEndTime',
                type: 'int64',
              },
              {
                internalType: 'string',
                name: 'metadata',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'title',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'summary',
                type: 'string',
              },
              {
                internalType: 'address',
                name: 'proposer',
                type: 'address',
              },
            ],
            internalType: 'struct ProposalData[]',
            name: 'proposals',
            type: 'tuple[]',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'nextKey',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'total',
                type: 'uint64',
              },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'uint64',
            name: 'proposalId',
            type: 'uint64',
          },
        ],
        name: 'getTallyResult',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'yes',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'abstain',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'no',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'noWithVeto',
                type: 'string',
              },
            ],
            internalType: 'struct TallyResultData',
            name: 'tallyResult',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'uint64',
            name: 'proposalId',
            type: 'uint64',
          },
          {
            internalType: 'address',
            name: 'voter',
            type: 'address',
          },
        ],
        name: 'getVote',
        outputs: [
          {
            components: [
              {
                internalType: 'uint64',
                name: 'proposalId',
                type: 'uint64',
              },
              {
                internalType: 'address',
                name: 'voter',
                type: 'address',
              },
              {
                components: [
                  {
                    internalType: 'enum VoteOption',
                    name: 'option',
                    type: 'uint8',
                  },
                  {
                    internalType: 'string',
                    name: 'weight',
                    type: 'string',
                  },
                ],
                internalType: 'struct WeightedVoteOption[]',
                name: 'options',
                type: 'tuple[]',
              },
              {
                internalType: 'string',
                name: 'metadata',
                type: 'string',
              },
            ],
            internalType: 'struct WeightedVote',
            name: 'vote',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'uint64',
            name: 'proposalId',
            type: 'uint64',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'key',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'offset',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'limit',
                type: 'uint64',
              },
              {
                internalType: 'bool',
                name: 'countTotal',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'reverse',
                type: 'bool',
              },
            ],
            internalType: 'struct PageRequest',
            name: 'pagination',
            type: 'tuple',
          },
        ],
        name: 'getVotes',
        outputs: [
          {
            components: [
              {
                internalType: 'uint64',
                name: 'proposalId',
                type: 'uint64',
              },
              {
                internalType: 'address',
                name: 'voter',
                type: 'address',
              },
              {
                components: [
                  {
                    internalType: 'enum VoteOption',
                    name: 'option',
                    type: 'uint8',
                  },
                  {
                    internalType: 'string',
                    name: 'weight',
                    type: 'string',
                  },
                ],
                internalType: 'struct WeightedVoteOption[]',
                name: 'options',
                type: 'tuple[]',
              },
              {
                internalType: 'string',
                name: 'metadata',
                type: 'string',
              },
            ],
            internalType: 'struct WeightedVote[]',
            name: 'votes',
            type: 'tuple[]',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'nextKey',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'total',
                type: 'uint64',
              },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'proposer',
            type: 'address',
          },
          {
            internalType: 'bytes',
            name: 'jsonProposal',
            type: 'bytes',
          },
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
            ],
            internalType: 'struct Coin[]',
            name: 'deposit',
            type: 'tuple[]',
          },
        ],
        name: 'submitProposal',
        outputs: [
          {
            internalType: 'uint64',
            name: 'proposalId',
            type: 'uint64',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'voter',
            type: 'address',
          },
          {
            internalType: 'uint64',
            name: 'proposalId',
            type: 'uint64',
          },
          {
            internalType: 'enum VoteOption',
            name: 'option',
            type: 'uint8',
          },
          {
            internalType: 'string',
            name: 'metadata',
            type: 'string',
          },
        ],
        name: 'vote',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'voter',
            type: 'address',
          },
          {
            internalType: 'uint64',
            name: 'proposalId',
            type: 'uint64',
          },
          {
            components: [
              {
                internalType: 'enum VoteOption',
                name: 'option',
                type: 'uint8',
              },
              {
                internalType: 'string',
                name: 'weight',
                type: 'string',
              },
            ],
            internalType: 'struct WeightedVoteOption[]',
            name: 'options',
            type: 'tuple[]',
          },
          {
            internalType: 'string',
            name: 'metadata',
            type: 'string',
          },
        ],
        name: 'voteWeighted',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'voter',
            type: 'address',
          },
          {
            internalType: 'uint64',
            name: 'proposalId',
            type: 'uint64',
          },
        ],
        name: 'veto',
        outputs: [
          {
            internalType: 'uint64',
            name: 'proposalId',
            type: 'uint64',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'voter',
            type: 'address',
          },
          {
            internalType: 'uint64',
            name: 'proposalId',
            type: 'uint64',
          },
        ],
        name: 'skipVeto',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'authority',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'address',
            type: 'address',
          },
        ],
        name: 'setPenaltyPool',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [],
        name: 'vetoParams',
        outputs: [
          {
            components: [
              {
                internalType: 'uint64',
                name: 'vetoPeriod',
                type: 'uint64',
              },
            ],
            internalType: 'struct VetoParams',
            name: 'vetoParams',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'penaltyPool',
        outputs: [
          {
            internalType: 'address',
            name: 'address',
            type: 'address',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'uint64',
            name: 'proposalId',
            type: 'uint64',
          },
        ],
        name: 'proposalVeto',
        outputs: [
          {
            components: [
              {
                internalType: 'uint64',
                name: 'proposalId',
                type: 'uint64',
              },
              {
                internalType: 'int64',
                name: 'vetoStartTime',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'vetoEndTime',
                type: 'int64',
              },
              {
                internalType: 'bool',
                name: 'inVetoPeriod',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'vetoed',
                type: 'bool',
              },
            ],
            internalType: 'struct ProposalVetoData',
            name: 'proposalVeto',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'uint64',
            name: 'proposalId',
            type: 'uint64',
          },
        ],
        name: 'proposalDetails',
        outputs: [
          {
            components: [
              {
                internalType: 'uint64',
                name: 'id',
                type: 'uint64',
              },
              {
                internalType: 'string[]',
                name: 'messages',
                type: 'string[]',
              },
              {
                internalType: 'uint32',
                name: 'status',
                type: 'uint32',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'yes',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'abstain',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'no',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'noWithVeto',
                    type: 'string',
                  },
                ],
                internalType: 'struct TallyResultData',
                name: 'finalTallyResult',
                type: 'tuple',
              },
              {
                internalType: 'int64',
                name: 'submitTime',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'depositEndTime',
                type: 'int64',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct Coin[]',
                name: 'totalDeposit',
                type: 'tuple[]',
              },
              {
                internalType: 'int64',
                name: 'votingStartTime',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'votingEndTime',
                type: 'int64',
              },
              {
                internalType: 'string',
                name: 'metadata',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'title',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'summary',
                type: 'string',
              },
              {
                internalType: 'address',
                name: 'proposer',
                type: 'address',
              },
            ],
            internalType: 'struct ProposalData',
            name: 'proposal',
            type: 'tuple',
          },
          {
            internalType: 'uint32',
            name: 'customStatus',
            type: 'uint32',
          },
          {
            components: [
              {
                internalType: 'uint64',
                name: 'proposalId',
                type: 'uint64',
              },
              {
                internalType: 'int64',
                name: 'vetoStartTime',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'vetoEndTime',
                type: 'int64',
              },
              {
                internalType: 'bool',
                name: 'inVetoPeriod',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'vetoed',
                type: 'bool',
              },
            ],
            internalType: 'struct ProposalVetoData',
            name: 'proposalVeto',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    bytecode: null,
  },
  {
    contractName: 'EvmIcs02',
    abi: [
      {
        type: 'function',
        name: 'getClientState',
        inputs: [
          {
            name: 'clientId',
            type: 'string',
            internalType: 'string',
          },
        ],
        outputs: [
          {
            name: '',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
        stateMutability: 'view',
      },
      {
        type: 'function',
        name: 'updateClient',
        inputs: [
          {
            name: 'clientId',
            type: 'string',
            internalType: 'string',
          },
          {
            name: 'updateMsg',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
        outputs: [
          {
            name: '',
            type: 'uint8',
            internalType: 'enum ICS02I.UpdateResult',
          },
        ],
        stateMutability: 'nonpayable',
      },
      {
        type: 'function',
        name: 'verifyMembership',
        inputs: [
          {
            name: 'clientId',
            type: 'string',
            internalType: 'string',
          },
          {
            name: 'proof',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'proofHeight',
            type: 'tuple',
            internalType: 'struct Height',
            components: [
              {
                name: 'revisionNumber',
                type: 'uint64',
                internalType: 'uint64',
              },
              {
                name: 'revisionHeight',
                type: 'uint64',
                internalType: 'uint64',
              },
            ],
          },
          {
            name: 'path',
            type: 'bytes[]',
            internalType: 'bytes[]',
          },
          {
            name: 'value',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
        outputs: [
          {
            name: '',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
        stateMutability: 'nonpayable',
      },
      {
        type: 'function',
        name: 'verifyNonMembership',
        inputs: [
          {
            name: 'clientId',
            type: 'string',
            internalType: 'string',
          },
          {
            name: 'proof',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'proofHeight',
            type: 'tuple',
            internalType: 'struct Height',
            components: [
              {
                name: 'revisionNumber',
                type: 'uint64',
                internalType: 'uint64',
              },
              {
                name: 'revisionHeight',
                type: 'uint64',
                internalType: 'uint64',
              },
            ],
          },
          {
            name: 'path',
            type: 'bytes[]',
            internalType: 'bytes[]',
          },
        ],
        outputs: [
          {
            name: '',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
        stateMutability: 'nonpayable',
      },
    ],
    bytecode: null,
  },
  {
    contractName: 'EvmIcs20',
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'sender',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'string',
            name: 'receiver',
            type: 'string',
          },
          {
            indexed: false,
            internalType: 'string',
            name: 'sourcePort',
            type: 'string',
          },
          {
            indexed: false,
            internalType: 'string',
            name: 'sourceChannel',
            type: 'string',
          },
          {
            indexed: false,
            internalType: 'string',
            name: 'denom',
            type: 'string',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
          {
            indexed: false,
            internalType: 'string',
            name: 'memo',
            type: 'string',
          },
        ],
        name: 'IBCTransfer',
        type: 'event',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'hash',
            type: 'string',
          },
        ],
        name: 'denom',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'base',
                type: 'string',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'portId',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'channelId',
                    type: 'string',
                  },
                ],
                internalType: 'struct Hop[]',
                name: 'trace',
                type: 'tuple[]',
              },
            ],
            internalType: 'struct Denom',
            name: 'denom',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'trace',
            type: 'string',
          },
        ],
        name: 'denomHash',
        outputs: [
          {
            internalType: 'string',
            name: 'hash',
            type: 'string',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            components: [
              {
                internalType: 'bytes',
                name: 'key',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'offset',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'limit',
                type: 'uint64',
              },
              {
                internalType: 'bool',
                name: 'countTotal',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'reverse',
                type: 'bool',
              },
            ],
            internalType: 'struct PageRequest',
            name: 'pageRequest',
            type: 'tuple',
          },
        ],
        name: 'denoms',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'base',
                type: 'string',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'portId',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'channelId',
                    type: 'string',
                  },
                ],
                internalType: 'struct Hop[]',
                name: 'trace',
                type: 'tuple[]',
              },
            ],
            internalType: 'struct Denom[]',
            name: 'denoms',
            type: 'tuple[]',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'nextKey',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'total',
                type: 'uint64',
              },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'sourcePort',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'sourceChannel',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'denom',
            type: 'string',
          },
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
          {
            internalType: 'address',
            name: 'sender',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'receiver',
            type: 'string',
          },
          {
            components: [
              {
                internalType: 'uint64',
                name: 'revisionNumber',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'revisionHeight',
                type: 'uint64',
              },
            ],
            internalType: 'struct Height',
            name: 'timeoutHeight',
            type: 'tuple',
          },
          {
            internalType: 'uint64',
            name: 'timeoutTimestamp',
            type: 'uint64',
          },
          {
            internalType: 'string',
            name: 'memo',
            type: 'string',
          },
        ],
        name: 'transfer',
        outputs: [
          {
            internalType: 'uint64',
            name: 'nextSequence',
            type: 'uint64',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    bytecode: null,
  },
  {
    contractName: 'EvmQrx',
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: '_from',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: '_to',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: '_value',
            type: 'uint256',
          },
        ],
        name: 'Transfer',
        type: 'event',
      },
      {
        inputs: [],
        name: 'name',
        outputs: [
          {
            internalType: 'string',
            name: '',
            type: 'string',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'symbol',
        outputs: [
          {
            internalType: 'string',
            name: '',
            type: 'string',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'decimals',
        outputs: [
          {
            internalType: 'uint8',
            name: '',
            type: 'uint8',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'totalSupply',
        outputs: [
          {
            internalType: 'uint256',
            name: '',
            type: 'uint256',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'account',
            type: 'address',
          },
        ],
        name: 'balanceOf',
        outputs: [
          {
            internalType: 'uint256',
            name: '',
            type: 'uint256',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'to',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        name: 'transfer',
        outputs: [
          {
            internalType: 'bool',
            name: '',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'bytes4',
            name: 'interfaceId',
            type: 'bytes4',
          },
        ],
        name: 'supportsInterface',
        outputs: [
          {
            internalType: 'bool',
            name: '',
            type: 'bool',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    bytecode: null,
  },
  {
    contractName: 'EvmSlashing',
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'validator',
            type: 'address',
          },
        ],
        name: 'ValidatorUnjailed',
        type: 'event',
      },
      {
        inputs: [],
        name: 'getParams',
        outputs: [
          {
            components: [
              {
                internalType: 'int64',
                name: 'signedBlocksWindow',
                type: 'int64',
              },
              {
                components: [
                  {
                    internalType: 'uint256',
                    name: 'value',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint8',
                    name: 'precision',
                    type: 'uint8',
                  },
                ],
                internalType: 'struct Dec',
                name: 'minSignedPerWindow',
                type: 'tuple',
              },
              {
                internalType: 'int64',
                name: 'downtimeJailDuration',
                type: 'int64',
              },
              {
                components: [
                  {
                    internalType: 'uint256',
                    name: 'value',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint8',
                    name: 'precision',
                    type: 'uint8',
                  },
                ],
                internalType: 'struct Dec',
                name: 'slashFractionDoubleSign',
                type: 'tuple',
              },
              {
                components: [
                  {
                    internalType: 'uint256',
                    name: 'value',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint8',
                    name: 'precision',
                    type: 'uint8',
                  },
                ],
                internalType: 'struct Dec',
                name: 'slashFractionDowntime',
                type: 'tuple',
              },
            ],
            internalType: 'struct Params',
            name: 'params',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'consAddress',
            type: 'address',
          },
        ],
        name: 'getSigningInfo',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'validatorAddress',
                type: 'address',
              },
              {
                internalType: 'int64',
                name: 'startHeight',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'indexOffset',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'jailedUntil',
                type: 'int64',
              },
              {
                internalType: 'bool',
                name: 'tombstoned',
                type: 'bool',
              },
              {
                internalType: 'int64',
                name: 'missedBlocksCounter',
                type: 'int64',
              },
            ],
            internalType: 'struct SigningInfo',
            name: 'signingInfo',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            components: [
              {
                internalType: 'bytes',
                name: 'key',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'offset',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'limit',
                type: 'uint64',
              },
              {
                internalType: 'bool',
                name: 'countTotal',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'reverse',
                type: 'bool',
              },
            ],
            internalType: 'struct PageRequest',
            name: 'pagination',
            type: 'tuple',
          },
        ],
        name: 'getSigningInfos',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'validatorAddress',
                type: 'address',
              },
              {
                internalType: 'int64',
                name: 'startHeight',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'indexOffset',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'jailedUntil',
                type: 'int64',
              },
              {
                internalType: 'bool',
                name: 'tombstoned',
                type: 'bool',
              },
              {
                internalType: 'int64',
                name: 'missedBlocksCounter',
                type: 'int64',
              },
            ],
            internalType: 'struct SigningInfo[]',
            name: 'signingInfos',
            type: 'tuple[]',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'nextKey',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'total',
                type: 'uint64',
              },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'validatorAddress',
            type: 'address',
          },
        ],
        name: 'unjail',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    bytecode: null,
  },
  {
    contractName: 'EvmStaking',
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'qoeAddress',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint64',
            name: 'ippId',
            type: 'uint64',
          },
        ],
        name: 'CreateInvestmentProgramPool',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'qoeAddress',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'validatorAddress',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint64',
            name: 'ippId',
            type: 'uint64',
          },
        ],
        name: 'AllocateInvestmentProgramPool',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'qoeAddress',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint64',
            name: 'ippId',
            type: 'uint64',
          },
        ],
        name: 'EditInvestmentProgramPool',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'qoeAddress',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint32',
            name: 'maxCommissionRateFrequency',
            type: 'uint32',
          },
        ],
        name: 'EditParamsMaxCommissionRateFrequency',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'delegatorAddress',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'validatorAddress',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'creationHeight',
            type: 'uint256',
          },
        ],
        name: 'CancelUnbondingDelegation',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'validatorAddress',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'value',
            type: 'uint256',
          },
        ],
        name: 'CreateValidator',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'delegatorAddress',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'validatorAddress',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'newShares',
            type: 'uint256',
          },
        ],
        name: 'Delegate',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'validatorAddress',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'int256',
            name: 'commissionRate',
            type: 'int256',
          },
          {
            indexed: false,
            internalType: 'int256',
            name: 'minSelfDelegation',
            type: 'int256',
          },
        ],
        name: 'EditValidator',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'delegatorAddress',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'validatorSrcAddress',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'validatorDstAddress',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'completionTime',
            type: 'uint256',
          },
        ],
        name: 'Redelegate',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'delegatorAddress',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'validatorAddress',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'completionTime',
            type: 'uint256',
          },
        ],
        name: 'Unbond',
        type: 'event',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'delegatorAddress',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'validatorAddress',
            type: 'string',
          },
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'creationHeight',
            type: 'uint256',
          },
        ],
        name: 'cancelUnbondingDelegation',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'moniker',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'identity',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'website',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'securityContact',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'details',
                type: 'string',
              },
            ],
            internalType: 'struct Description',
            name: 'description',
            type: 'tuple',
          },
          {
            components: [
              {
                internalType: 'uint256',
                name: 'rate',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'maxRate',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'maxChangeRate',
                type: 'uint256',
              },
            ],
            internalType: 'struct CommissionRates',
            name: 'commissionRates',
            type: 'tuple',
          },
          {
            internalType: 'uint256',
            name: 'minSelfDelegation',
            type: 'uint256',
          },
          {
            internalType: 'address',
            name: 'validatorAddress',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'pubkey',
            type: 'string',
          },
          {
            internalType: 'uint256',
            name: 'value',
            type: 'uint256',
          },
        ],
        name: 'createValidator',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'delegatorAddress',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'validatorAddress',
            type: 'string',
          },
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        name: 'delegate',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'delegatorAddress',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'validatorAddress',
            type: 'string',
          },
        ],
        name: 'delegation',
        outputs: [
          {
            internalType: 'uint256',
            name: 'shares',
            type: 'uint256',
          },
          {
            components: [
              {
                internalType: 'string',
                name: 'denom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
            ],
            internalType: 'struct Coin',
            name: 'balance',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'moniker',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'identity',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'website',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'securityContact',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'details',
                type: 'string',
              },
            ],
            internalType: 'struct Description',
            name: 'description',
            type: 'tuple',
          },
          {
            internalType: 'address',
            name: 'validatorAddress',
            type: 'address',
          },
          {
            internalType: 'int256',
            name: 'commissionRate',
            type: 'int256',
          },
          {
            internalType: 'int256',
            name: 'minSelfDelegation',
            type: 'int256',
          },
        ],
        name: 'editValidator',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'delegatorAddress',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'validatorSrcAddress',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'validatorDstAddress',
            type: 'string',
          },
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        name: 'redelegate',
        outputs: [
          {
            internalType: 'int64',
            name: 'completionTime',
            type: 'int64',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'delegatorAddress',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'srcValidatorAddress',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'dstValidatorAddress',
            type: 'string',
          },
        ],
        name: 'redelegation',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'delegatorAddress',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'validatorSrcAddress',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'validatorDstAddress',
                type: 'string',
              },
              {
                components: [
                  {
                    internalType: 'int64',
                    name: 'creationHeight',
                    type: 'int64',
                  },
                  {
                    internalType: 'int64',
                    name: 'completionTime',
                    type: 'int64',
                  },
                  {
                    internalType: 'uint256',
                    name: 'initialBalance',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint256',
                    name: 'sharesDst',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct RedelegationEntry[]',
                name: 'entries',
                type: 'tuple[]',
              },
            ],
            internalType: 'struct RedelegationOutput',
            name: 'redelegation',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'delegatorAddress',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'srcValidatorAddress',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'dstValidatorAddress',
            type: 'string',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'key',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'offset',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'limit',
                type: 'uint64',
              },
              {
                internalType: 'bool',
                name: 'countTotal',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'reverse',
                type: 'bool',
              },
            ],
            internalType: 'struct PageRequest',
            name: 'pageRequest',
            type: 'tuple',
          },
        ],
        name: 'redelegations',
        outputs: [
          {
            components: [
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'delegatorAddress',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'validatorSrcAddress',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'validatorDstAddress',
                    type: 'string',
                  },
                  {
                    components: [
                      {
                        internalType: 'int64',
                        name: 'creationHeight',
                        type: 'int64',
                      },
                      {
                        internalType: 'int64',
                        name: 'completionTime',
                        type: 'int64',
                      },
                      {
                        internalType: 'uint256',
                        name: 'initialBalance',
                        type: 'uint256',
                      },
                      {
                        internalType: 'uint256',
                        name: 'sharesDst',
                        type: 'uint256',
                      },
                    ],
                    internalType: 'struct RedelegationEntry[]',
                    name: 'entries',
                    type: 'tuple[]',
                  },
                ],
                internalType: 'struct Redelegation',
                name: 'redelegation',
                type: 'tuple',
              },
              {
                components: [
                  {
                    components: [
                      {
                        internalType: 'int64',
                        name: 'creationHeight',
                        type: 'int64',
                      },
                      {
                        internalType: 'int64',
                        name: 'completionTime',
                        type: 'int64',
                      },
                      {
                        internalType: 'uint256',
                        name: 'initialBalance',
                        type: 'uint256',
                      },
                      {
                        internalType: 'uint256',
                        name: 'sharesDst',
                        type: 'uint256',
                      },
                    ],
                    internalType: 'struct RedelegationEntry',
                    name: 'redelegationEntry',
                    type: 'tuple',
                  },
                  {
                    internalType: 'uint256',
                    name: 'balance',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct RedelegationEntryResponse[]',
                name: 'entries',
                type: 'tuple[]',
              },
            ],
            internalType: 'struct RedelegationResponse[]',
            name: 'response',
            type: 'tuple[]',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'nextKey',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'total',
                type: 'uint64',
              },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'delegatorAddress',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'validatorAddress',
            type: 'string',
          },
        ],
        name: 'unbondingDelegation',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'delegatorAddress',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'validatorAddress',
                type: 'string',
              },
              {
                components: [
                  {
                    internalType: 'int64',
                    name: 'creationHeight',
                    type: 'int64',
                  },
                  {
                    internalType: 'int64',
                    name: 'completionTime',
                    type: 'int64',
                  },
                  {
                    internalType: 'uint256',
                    name: 'initialBalance',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint256',
                    name: 'balance',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint64',
                    name: 'unbondingId',
                    type: 'uint64',
                  },
                  {
                    internalType: 'int64',
                    name: 'unbondingOnHoldRefCount',
                    type: 'int64',
                  },
                ],
                internalType: 'struct UnbondingDelegationEntry[]',
                name: 'entries',
                type: 'tuple[]',
              },
            ],
            internalType: 'struct UnbondingDelegationOutput',
            name: 'unbondingDelegation',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'delegatorAddress',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'validatorAddress',
            type: 'string',
          },
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        name: 'undelegate',
        outputs: [
          {
            internalType: 'int64',
            name: 'completionTime',
            type: 'int64',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'validatorAddress',
            type: 'address',
          },
        ],
        name: 'validator',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'operatorAddress',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'consensusPubkey',
                type: 'string',
              },
              {
                internalType: 'bool',
                name: 'jailed',
                type: 'bool',
              },
              {
                internalType: 'enum BondStatus',
                name: 'status',
                type: 'uint8',
              },
              {
                internalType: 'uint256',
                name: 'tokens',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'delegatorShares',
                type: 'uint256',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'moniker',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'identity',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'website',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'securityContact',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'details',
                    type: 'string',
                  },
                ],
                internalType: 'struct Description',
                name: 'description',
                type: 'tuple',
              },
              {
                internalType: 'int64',
                name: 'unbondingHeight',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'unbondingTime',
                type: 'int64',
              },
              {
                internalType: 'uint256',
                name: 'commission',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'minSelfDelegation',
                type: 'uint256',
              },
            ],
            internalType: 'struct Validator',
            name: 'validator',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'status',
            type: 'string',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'key',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'offset',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'limit',
                type: 'uint64',
              },
              {
                internalType: 'bool',
                name: 'countTotal',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'reverse',
                type: 'bool',
              },
            ],
            internalType: 'struct PageRequest',
            name: 'pageRequest',
            type: 'tuple',
          },
        ],
        name: 'validators',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'operatorAddress',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'consensusPubkey',
                type: 'string',
              },
              {
                internalType: 'bool',
                name: 'jailed',
                type: 'bool',
              },
              {
                internalType: 'enum BondStatus',
                name: 'status',
                type: 'uint8',
              },
              {
                internalType: 'uint256',
                name: 'tokens',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'delegatorShares',
                type: 'uint256',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'moniker',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'identity',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'website',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'securityContact',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'details',
                    type: 'string',
                  },
                ],
                internalType: 'struct Description',
                name: 'description',
                type: 'tuple',
              },
              {
                internalType: 'int64',
                name: 'unbondingHeight',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'unbondingTime',
                type: 'int64',
              },
              {
                internalType: 'uint256',
                name: 'commission',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'minSelfDelegation',
                type: 'uint256',
              },
            ],
            internalType: 'struct Validator[]',
            name: 'validators',
            type: 'tuple[]',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'nextKey',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'total',
                type: 'uint64',
              },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'qoeAddress',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'name',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'details',
            type: 'string',
          },
          {
            internalType: 'uint256',
            name: 'royaltyFee',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'votingWeight',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'maxStaking',
            type: 'uint256',
          },
        ],
        name: 'createInvestmentProgramPool',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'qoeAddress',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'validatorAddress',
            type: 'address',
          },
          {
            internalType: 'uint64',
            name: 'ippId',
            type: 'uint64',
          },
        ],
        name: 'allocateInvestmentProgramPool',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'qoeAddress',
            type: 'address',
          },
          {
            internalType: 'uint64',
            name: 'ippId',
            type: 'uint64',
          },
          {
            internalType: 'string',
            name: 'name',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'details',
            type: 'string',
          },
          {
            internalType: 'uint256',
            name: 'royaltyFee',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'votingWeight',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'maxStaking',
            type: 'uint256',
          },
        ],
        name: 'editInvestmentProgramPool',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'qoeAddress',
            type: 'address',
          },
          {
            internalType: 'uint32',
            name: 'maxCommissionRateFrequency',
            type: 'uint32',
          },
        ],
        name: 'editParamsMaxCommissionRateFrequency',
        outputs: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            components: [
              {
                internalType: 'bytes',
                name: 'key',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'offset',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'limit',
                type: 'uint64',
              },
              {
                internalType: 'bool',
                name: 'countTotal',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'reverse',
                type: 'bool',
              },
            ],
            internalType: 'struct PageRequest',
            name: 'pageRequest',
            type: 'tuple',
          },
        ],
        name: 'investmentProgramPools',
        outputs: [
          {
            components: [
              {
                internalType: 'uint64',
                name: 'id',
                type: 'uint64',
              },
              {
                internalType: 'string',
                name: 'name',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'details',
                type: 'string',
              },
              {
                components: [
                  {
                    internalType: 'uint256',
                    name: 'value',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint8',
                    name: 'precision',
                    type: 'uint8',
                  },
                ],
                internalType: 'struct Dec',
                name: 'royaltyFee',
                type: 'tuple',
              },
              {
                components: [
                  {
                    internalType: 'uint256',
                    name: 'value',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint8',
                    name: 'precision',
                    type: 'uint8',
                  },
                ],
                internalType: 'struct Dec',
                name: 'votingWeight',
                type: 'tuple',
              },
              {
                internalType: 'uint256',
                name: 'maxStaking',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'currentStaking',
                type: 'uint256',
              },
            ],
            internalType: 'struct InvestmentProgramPoolInfo[]',
            name: 'investmentProgramPools',
            type: 'tuple[]',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'nextKey',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'total',
                type: 'uint64',
              },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            components: [
              {
                internalType: 'bytes',
                name: 'key',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'offset',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'limit',
                type: 'uint64',
              },
              {
                internalType: 'bool',
                name: 'countTotal',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'reverse',
                type: 'bool',
              },
            ],
            internalType: 'struct PageRequest',
            name: 'pageRequest',
            type: 'tuple',
          },
        ],
        name: 'allocateInvestmentProgramPools',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'validatorAddress',
                type: 'address',
              },
              {
                internalType: 'uint64',
                name: 'ippId',
                type: 'uint64',
              },
            ],
            internalType: 'struct AllocateInvestmentProgramPoolInfo[]',
            name: 'allocateInvestmentProgramPools',
            type: 'tuple[]',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'nextKey',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'total',
                type: 'uint64',
              },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'validatorAddress',
            type: 'string',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'key',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'offset',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'limit',
                type: 'uint64',
              },
              {
                internalType: 'bool',
                name: 'countTotal',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'reverse',
                type: 'bool',
              },
            ],
            internalType: 'struct PageRequest',
            name: 'pageRequest',
            type: 'tuple',
          },
        ],
        name: 'validatorDelegations',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'delegatorAddress',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'validatorAddress',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'shares',
                type: 'uint256',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct Coin',
                name: 'balance',
                type: 'tuple',
              },
            ],
            internalType: 'struct DelegationResponseData[]',
            name: 'delegationResponses',
            type: 'tuple[]',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'nextKey',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'total',
                type: 'uint64',
              },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'validatorAddress',
            type: 'string',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'key',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'offset',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'limit',
                type: 'uint64',
              },
              {
                internalType: 'bool',
                name: 'countTotal',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'reverse',
                type: 'bool',
              },
            ],
            internalType: 'struct PageRequest',
            name: 'pageRequest',
            type: 'tuple',
          },
        ],
        name: 'validatorUnbondingDelegations',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'delegatorAddress',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'validatorAddress',
                type: 'string',
              },
              {
                components: [
                  {
                    internalType: 'int64',
                    name: 'creationHeight',
                    type: 'int64',
                  },
                  {
                    internalType: 'int64',
                    name: 'completionTime',
                    type: 'int64',
                  },
                  {
                    internalType: 'uint256',
                    name: 'initialBalance',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint256',
                    name: 'balance',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint64',
                    name: 'unbondingId',
                    type: 'uint64',
                  },
                  {
                    internalType: 'int64',
                    name: 'unbondingOnHoldRefCount',
                    type: 'int64',
                  },
                ],
                internalType: 'struct UnbondingDelegationEntry[]',
                name: 'entries',
                type: 'tuple[]',
              },
            ],
            internalType: 'struct UnbondingDelegationOutput[]',
            name: 'unbondingResponses',
            type: 'tuple[]',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'nextKey',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'total',
                type: 'uint64',
              },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'delegatorAddress',
            type: 'address',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'key',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'offset',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'limit',
                type: 'uint64',
              },
              {
                internalType: 'bool',
                name: 'countTotal',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'reverse',
                type: 'bool',
              },
            ],
            internalType: 'struct PageRequest',
            name: 'pageRequest',
            type: 'tuple',
          },
        ],
        name: 'delegatorDelegations',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'delegatorAddress',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'validatorAddress',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'shares',
                type: 'uint256',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'denom',
                    type: 'string',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct Coin',
                name: 'balance',
                type: 'tuple',
              },
            ],
            internalType: 'struct DelegationResponseData[]',
            name: 'delegationResponses',
            type: 'tuple[]',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'nextKey',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'total',
                type: 'uint64',
              },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'delegatorAddress',
            type: 'address',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'key',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'offset',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'limit',
                type: 'uint64',
              },
              {
                internalType: 'bool',
                name: 'countTotal',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'reverse',
                type: 'bool',
              },
            ],
            internalType: 'struct PageRequest',
            name: 'pageRequest',
            type: 'tuple',
          },
        ],
        name: 'delegatorUnbondingDelegations',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'delegatorAddress',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'validatorAddress',
                type: 'string',
              },
              {
                components: [
                  {
                    internalType: 'int64',
                    name: 'creationHeight',
                    type: 'int64',
                  },
                  {
                    internalType: 'int64',
                    name: 'completionTime',
                    type: 'int64',
                  },
                  {
                    internalType: 'uint256',
                    name: 'initialBalance',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint256',
                    name: 'balance',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint64',
                    name: 'unbondingId',
                    type: 'uint64',
                  },
                  {
                    internalType: 'int64',
                    name: 'unbondingOnHoldRefCount',
                    type: 'int64',
                  },
                ],
                internalType: 'struct UnbondingDelegationEntry[]',
                name: 'entries',
                type: 'tuple[]',
              },
            ],
            internalType: 'struct UnbondingDelegationOutput[]',
            name: 'unbondingResponses',
            type: 'tuple[]',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'nextKey',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'total',
                type: 'uint64',
              },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'delegatorAddress',
            type: 'address',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'key',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'offset',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'limit',
                type: 'uint64',
              },
              {
                internalType: 'bool',
                name: 'countTotal',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'reverse',
                type: 'bool',
              },
            ],
            internalType: 'struct PageRequest',
            name: 'pageRequest',
            type: 'tuple',
          },
        ],
        name: 'delegatorValidators',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'operatorAddress',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'consensusPubkey',
                type: 'string',
              },
              {
                internalType: 'bool',
                name: 'jailed',
                type: 'bool',
              },
              {
                internalType: 'enum BondStatus',
                name: 'status',
                type: 'uint8',
              },
              {
                internalType: 'uint256',
                name: 'tokens',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'delegatorShares',
                type: 'uint256',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'moniker',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'identity',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'website',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'securityContact',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'details',
                    type: 'string',
                  },
                ],
                internalType: 'struct Description',
                name: 'description',
                type: 'tuple',
              },
              {
                internalType: 'int64',
                name: 'unbondingHeight',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'unbondingTime',
                type: 'int64',
              },
              {
                internalType: 'uint256',
                name: 'commission',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'minSelfDelegation',
                type: 'uint256',
              },
            ],
            internalType: 'struct Validator[]',
            name: 'validators',
            type: 'tuple[]',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'nextKey',
                type: 'bytes',
              },
              {
                internalType: 'uint64',
                name: 'total',
                type: 'uint64',
              },
            ],
            internalType: 'struct PageResponse',
            name: 'pageResponse',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'delegatorAddress',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'validatorAddress',
            type: 'string',
          },
        ],
        name: 'delegatorValidator',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'operatorAddress',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'consensusPubkey',
                type: 'string',
              },
              {
                internalType: 'bool',
                name: 'jailed',
                type: 'bool',
              },
              {
                internalType: 'enum BondStatus',
                name: 'status',
                type: 'uint8',
              },
              {
                internalType: 'uint256',
                name: 'tokens',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'delegatorShares',
                type: 'uint256',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'moniker',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'identity',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'website',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'securityContact',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'details',
                    type: 'string',
                  },
                ],
                internalType: 'struct Description',
                name: 'description',
                type: 'tuple',
              },
              {
                internalType: 'int64',
                name: 'unbondingHeight',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'unbondingTime',
                type: 'int64',
              },
              {
                internalType: 'uint256',
                name: 'commission',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'minSelfDelegation',
                type: 'uint256',
              },
            ],
            internalType: 'struct Validator',
            name: 'validator',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'int64',
            name: 'height',
            type: 'int64',
          },
        ],
        name: 'historicalInfo',
        outputs: [
          {
            components: [
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'chainId',
                    type: 'string',
                  },
                  {
                    internalType: 'int64',
                    name: 'height',
                    type: 'int64',
                  },
                  {
                    internalType: 'int64',
                    name: 'time',
                    type: 'int64',
                  },
                ],
                internalType: 'struct HistoricalHeader',
                name: 'header',
                type: 'tuple',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'operatorAddress',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'consensusPubkey',
                    type: 'string',
                  },
                  {
                    internalType: 'bool',
                    name: 'jailed',
                    type: 'bool',
                  },
                  {
                    internalType: 'enum BondStatus',
                    name: 'status',
                    type: 'uint8',
                  },
                  {
                    internalType: 'uint256',
                    name: 'tokens',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint256',
                    name: 'delegatorShares',
                    type: 'uint256',
                  },
                  {
                    components: [
                      {
                        internalType: 'string',
                        name: 'moniker',
                        type: 'string',
                      },
                      {
                        internalType: 'string',
                        name: 'identity',
                        type: 'string',
                      },
                      {
                        internalType: 'string',
                        name: 'website',
                        type: 'string',
                      },
                      {
                        internalType: 'string',
                        name: 'securityContact',
                        type: 'string',
                      },
                      {
                        internalType: 'string',
                        name: 'details',
                        type: 'string',
                      },
                    ],
                    internalType: 'struct Description',
                    name: 'description',
                    type: 'tuple',
                  },
                  {
                    internalType: 'int64',
                    name: 'unbondingHeight',
                    type: 'int64',
                  },
                  {
                    internalType: 'int64',
                    name: 'unbondingTime',
                    type: 'int64',
                  },
                  {
                    internalType: 'uint256',
                    name: 'commission',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint256',
                    name: 'minSelfDelegation',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct Validator[]',
                name: 'valset',
                type: 'tuple[]',
              },
            ],
            internalType: 'struct HistoricalInfoData',
            name: 'hist',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'pool',
        outputs: [
          {
            components: [
              {
                internalType: 'uint256',
                name: 'notBondedTokens',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'bondedTokens',
                type: 'uint256',
              },
            ],
            internalType: 'struct PoolInfo',
            name: 'pool_',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'params',
        outputs: [
          {
            components: [
              {
                internalType: 'int64',
                name: 'unbondingTime',
                type: 'int64',
              },
              {
                internalType: 'uint32',
                name: 'maxValidators',
                type: 'uint32',
              },
              {
                internalType: 'uint32',
                name: 'maxEntries',
                type: 'uint32',
              },
              {
                internalType: 'uint32',
                name: 'historicalEntries',
                type: 'uint32',
              },
              {
                internalType: 'string',
                name: 'bondDenom',
                type: 'string',
              },
              {
                components: [
                  {
                    internalType: 'uint256',
                    name: 'value',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint8',
                    name: 'precision',
                    type: 'uint8',
                  },
                ],
                internalType: 'struct Dec',
                name: 'minCommissionRate',
                type: 'tuple',
              },
            ],
            internalType: 'struct StakingParams',
            name: 'params_',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'maxCommissionRateFrequency',
        outputs: [
          {
            internalType: 'uint32',
            name: 'maxCommissionRateFrequency',
            type: 'uint32',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    bytecode: null,
  },
  {
    contractName: 'EvmUpgrade',
    abi: [
      {
        inputs: [],
        name: 'currentPlan',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'name',
                type: 'string',
              },
              {
                internalType: 'int64',
                name: 'timeUnix',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'height',
                type: 'int64',
              },
              {
                internalType: 'string',
                name: 'info',
                type: 'string',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'typeUrl',
                    type: 'string',
                  },
                  {
                    internalType: 'bytes',
                    name: 'value',
                    type: 'bytes',
                  },
                ],
                internalType: 'struct ProtoAny',
                name: 'upgradedClientState',
                type: 'tuple',
              },
            ],
            internalType: 'struct UpgradePlan',
            name: 'plan_',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'name',
            type: 'string',
          },
        ],
        name: 'appliedPlan',
        outputs: [
          {
            internalType: 'int64',
            name: 'height',
            type: 'int64',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'int64',
            name: 'lastHeight',
            type: 'int64',
          },
        ],
        name: 'upgradedConsensusState',
        outputs: [
          {
            internalType: 'bytes',
            name: 'state_',
            type: 'bytes',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'moduleName',
            type: 'string',
          },
        ],
        name: 'moduleVersions',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'name',
                type: 'string',
              },
              {
                internalType: 'uint64',
                name: 'version',
                type: 'uint64',
              },
            ],
            internalType: 'struct ModuleVersion[]',
            name: 'moduleVersions_',
            type: 'tuple[]',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'authority',
        outputs: [
          {
            internalType: 'string',
            name: 'address',
            type: 'string',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    bytecode: null,
  },
  {
    contractName: 'EvmServiceRole',
    abi: [
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'address', name: 'qoe', type: 'address' },
          { indexed: false, internalType: 'string', name: 'role', type: 'string' },
          { indexed: false, internalType: 'string', name: 'desc', type: 'string' },
        ],
        name: 'AddRole',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: false, internalType: 'address', name: 'issuer', type: 'address' },
          { indexed: false, internalType: 'string', name: 'roleName', type: 'string' },
        ],
        name: 'AddRoleIssuer',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'address', name: 'to', type: 'address' },
          { indexed: true, internalType: 'uint256', name: 'tokenId', type: 'uint256' },
        ],
        name: 'Attest',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'address', name: 'from', type: 'address' },
          { indexed: true, internalType: 'uint256', name: 'tokenId', type: 'uint256' },
        ],
        name: 'Burn',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'address', name: 'qoe', type: 'address' },
          { indexed: false, internalType: 'string', name: 'name', type: 'string' },
        ],
        name: 'RemoveRole',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: false, internalType: 'address', name: 'issuer', type: 'address' },
          { indexed: false, internalType: 'string', name: 'roleName', type: 'string' },
        ],
        name: 'RemoveRoleIssuer',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'address', name: 'to', type: 'address' },
          { indexed: false, internalType: 'uint256', name: 'deadline', type: 'uint256' },
        ],
        name: 'ResetTime',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'address', name: 'from', type: 'address' },
          { indexed: true, internalType: 'uint256', name: 'tokenId', type: 'uint256' },
        ],
        name: 'Revoke',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'address', name: 'from', type: 'address' },
          { indexed: true, internalType: 'address', name: 'to', type: 'address' },
          { indexed: true, internalType: 'uint256', name: 'tokenId', type: 'uint256' },
        ],
        name: 'Transfer',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'address', name: 'qoe', type: 'address' },
          { indexed: false, internalType: 'string', name: 'name', type: 'string' },
          { indexed: false, internalType: 'string', name: 'desc', type: 'string' },
        ],
        name: 'UpdateRoleDesc',
        type: 'event',
      },
      {
        inputs: [{ internalType: 'address', name: 'addr', type: 'address' }],
        name: 'GetExpirationOf',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { internalType: 'string', name: 'roleName', type: 'string' },
          { internalType: 'string', name: 'desc', type: 'string' },
        ],
        name: 'addRole',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { internalType: 'address', name: 'issuer', type: 'address' },
          { internalType: 'string', name: 'roleName', type: 'string' },
        ],
        name: 'addRoleIssuer',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'address', name: 'to', type: 'address' }],
        name: 'attest',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { internalType: 'address', name: 'to', type: 'address' },
          { internalType: 'string', name: 'roleName', type: 'string' },
        ],
        name: 'attestRole',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'address', name: 'owner', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      { inputs: [], name: 'burn', outputs: [], stateMutability: 'pure', type: 'function' },
      { inputs: [], name: 'expire', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
      {
        inputs: [{ internalType: 'address', name: 'addr', type: 'address' }],
        name: 'getAddressRole',
        outputs: [{ internalType: 'string[]', name: '', type: 'string[]' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'string', name: 'roleName', type: 'string' }],
        name: 'getRoleDetail',
        outputs: [
          { internalType: 'string', name: '', type: 'string' },
          { internalType: 'bool', name: '', type: 'bool' },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'string', name: 'roleName', type: 'string' }],
        name: 'getRoleIssuers',
        outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
        stateMutability: 'view',
        type: 'function',
      },
      { inputs: [], name: 'getRoleList', outputs: [{ internalType: 'string[]', name: '', type: 'string[]' }], stateMutability: 'view', type: 'function' },
      {
        inputs: [
          { internalType: 'string', name: 'name_', type: 'string' },
          { internalType: 'string', name: 'symbol_', type: 'string' },
          { internalType: 'uint256', name: 'expire_', type: 'uint256' },
          { internalType: 'address', name: 'admin_', type: 'address' },
        ],
        name: 'initialize',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'address', name: 'addr', type: 'address' }],
        name: 'isQOE',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
      },
      { inputs: [], name: 'name', outputs: [{ internalType: 'string', name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
      {
        inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
        name: 'ownerOf',
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        name: 'qoes',
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
      },
      { inputs: [{ internalType: 'string', name: 'roleName', type: 'string' }], name: 'removeRole', outputs: [], stateMutability: 'nonpayable', type: 'function' },
      {
        inputs: [
          { internalType: 'address', name: 'issuer', type: 'address' },
          { internalType: 'string', name: 'roleName', type: 'string' },
        ],
        name: 'removeRoleIssuer',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      { inputs: [{ internalType: 'address', name: 'to', type: 'address' }], name: 'resetTime', outputs: [], stateMutability: 'nonpayable', type: 'function' },
      { inputs: [{ internalType: 'address', name: 'from', type: 'address' }], name: 'revoke', outputs: [], stateMutability: 'nonpayable', type: 'function' },
      {
        inputs: [
          { internalType: 'address', name: 'from', type: 'address' },
          { internalType: 'string', name: 'roleName', type: 'string' },
        ],
        name: 'revokeRole',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      { inputs: [{ internalType: 'string', name: 'uri', type: 'string' }], name: 'setBaseTokenURI', outputs: [], stateMutability: 'nonpayable', type: 'function' },
      { inputs: [{ internalType: 'uint128', name: 'segment', type: 'uint128' }], name: 'setExpire', outputs: [], stateMutability: 'nonpayable', type: 'function' },
      {
        inputs: [{ internalType: 'bytes4', name: 'interfaceId', type: 'bytes4' }],
        name: 'supportsInterface',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
      },
      { inputs: [], name: 'symbol', outputs: [{ internalType: 'string', name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
      {
        inputs: [{ internalType: 'address', name: 'from', type: 'address' }],
        name: 'tokenIdOf',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
        name: 'tokenURI',
        outputs: [{ internalType: 'string', name: '', type: 'string' }],
        stateMutability: 'view',
        type: 'function',
      },
      { inputs: [], name: 'totalSupply', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
      {
        inputs: [
          { internalType: 'string', name: 'roleName', type: 'string' },
          { internalType: 'string', name: 'desc', type: 'string' },
        ],
        name: 'updateRoleDesc',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    bytecode: null,
  },
  {
    contractName: 'EvmServiceProvider',
    abi: [
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'address', name: 'owner', type: 'address' },
          { indexed: true, internalType: 'address', name: 'approved', type: 'address' },
          { indexed: true, internalType: 'uint256', name: 'tokenId', type: 'uint256' },
        ],
        name: 'Approval',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'address', name: 'owner', type: 'address' },
          { indexed: true, internalType: 'address', name: 'operator', type: 'address' },
          { indexed: false, internalType: 'bool', name: 'approved', type: 'bool' },
        ],
        name: 'ApprovalForAll',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: false, internalType: 'uint256', name: '_fromTokenId', type: 'uint256' },
          { indexed: false, internalType: 'uint256', name: '_toTokenId', type: 'uint256' },
        ],
        name: 'BatchMetadataUpdate',
        type: 'event',
      },
      { anonymous: false, inputs: [{ indexed: false, internalType: 'uint256', name: 'tokenId', type: 'uint256' }], name: 'Disabled', type: 'event' },
      { anonymous: false, inputs: [{ indexed: false, internalType: 'uint256', name: 'tokenId', type: 'uint256' }], name: 'Enabled', type: 'event' },
      { anonymous: false, inputs: [{ indexed: false, internalType: 'uint8', name: 'version', type: 'uint8' }], name: 'Initialized', type: 'event' },
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'address', name: 'from', type: 'address' },
          { indexed: true, internalType: 'address', name: 'to', type: 'address' },
          { indexed: true, internalType: 'uint256', name: 'tokenId', type: 'uint256' },
        ],
        name: 'Issued',
        type: 'event',
      },
      { anonymous: false, inputs: [{ indexed: false, internalType: 'uint256', name: '_tokenId', type: 'uint256' }], name: 'MetadataUpdate', type: 'event' },
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'address', name: 'to', type: 'address' },
          { indexed: true, internalType: 'uint256', name: 'expiryDate', type: 'uint256' },
        ],
        name: 'Renew',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'bytes32', name: 'role', type: 'bytes32' },
          { indexed: true, internalType: 'bytes32', name: 'previousAdminRole', type: 'bytes32' },
          { indexed: true, internalType: 'bytes32', name: 'newAdminRole', type: 'bytes32' },
        ],
        name: 'RoleAdminChanged',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'bytes32', name: 'role', type: 'bytes32' },
          { indexed: true, internalType: 'address', name: 'account', type: 'address' },
          { indexed: true, internalType: 'address', name: 'sender', type: 'address' },
        ],
        name: 'RoleGranted',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'bytes32', name: 'role', type: 'bytes32' },
          { indexed: true, internalType: 'address', name: 'account', type: 'address' },
          { indexed: true, internalType: 'address', name: 'sender', type: 'address' },
        ],
        name: 'RoleRevoked',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: false, internalType: 'string', name: 'oldBaseURI', type: 'string' },
          { indexed: false, internalType: 'string', name: 'currentBaseURI', type: 'string' },
        ],
        name: 'SetBaseURI',
        type: 'event',
      },
      { anonymous: false, inputs: [{ indexed: false, internalType: 'uint256', name: 'newBatchSize', type: 'uint256' }], name: 'SetBatchSize', type: 'event' },
      {
        anonymous: false,
        inputs: [
          { indexed: false, internalType: 'uint256', name: 'tokenId', type: 'uint256' },
          { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
        ],
        name: 'SetTokenExpireTime',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'address', name: 'from', type: 'address' },
          { indexed: true, internalType: 'address', name: 'to', type: 'address' },
          { indexed: true, internalType: 'uint256', name: 'tokenId', type: 'uint256' },
        ],
        name: 'Transfer',
        type: 'event',
      },
      { inputs: [], name: 'DEFAULT_ADMIN_ROLE', outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }], stateMutability: 'view', type: 'function' },
      { inputs: [], name: 'ISSUER_ROLE', outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }], stateMutability: 'view', type: 'function' },
      { inputs: [], name: 'MANAGER_ROLE', outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }], stateMutability: 'view', type: 'function' },
      {
        inputs: [
          { internalType: 'address', name: '', type: 'address' },
          { internalType: 'uint256', name: '', type: 'uint256' },
        ],
        name: 'approve',
        outputs: [],
        stateMutability: 'pure',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'address', name: 'owner', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      { inputs: [], name: 'baseTokenURI', outputs: [{ internalType: 'string', name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
      { inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }], name: 'burn', outputs: [], stateMutability: 'nonpayable', type: 'function' },
      { inputs: [{ internalType: 'address', name: 'account', type: 'address' }], name: 'burnFor', outputs: [], stateMutability: 'nonpayable', type: 'function' },
      { inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }], name: 'disableToken', outputs: [], stateMutability: 'nonpayable', type: 'function' },
      { inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }], name: 'enableToken', outputs: [], stateMutability: 'nonpayable', type: 'function' },
      {
        inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
        name: 'exists',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'address', name: 'ownerAddress', type: 'address' }],
        name: 'expiryDateOf',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
        name: 'getApproved',
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
        name: 'getExpireTime',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
        name: 'getIssuedTime',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
        name: 'getRenewTime',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'bytes32', name: 'role', type: 'bytes32' }],
        name: 'getRoleAdmin',
        outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { internalType: 'bytes32', name: 'role', type: 'bytes32' },
          { internalType: 'address', name: 'account', type: 'address' },
        ],
        name: 'grantRole',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { internalType: 'bytes32', name: 'role', type: 'bytes32' },
          { internalType: 'address', name: 'account', type: 'address' },
        ],
        name: 'hasRole',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { internalType: 'string', name: 'name_', type: 'string' },
          { internalType: 'string', name: 'symbol_', type: 'string' },
          { internalType: 'string', name: 'baseURI_', type: 'string' },
          { internalType: 'address', name: 'admin_', type: 'address' },
        ],
        name: 'initialize',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { internalType: 'address', name: 'owner', type: 'address' },
          { internalType: 'address', name: 'operator', type: 'address' },
        ],
        name: 'isApprovedForAll',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
        name: 'isDisabled',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
        name: 'isValid',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { internalType: 'address', name: 'to', type: 'address' },
          { internalType: 'uint256', name: 'timeExpire', type: 'uint256' },
        ],
        name: 'mintTo',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      { inputs: [], name: 'name', outputs: [{ internalType: 'string', name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
      {
        inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
        name: 'ownerOf',
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { internalType: 'address', name: 'to', type: 'address' },
          { internalType: 'uint256', name: 'expiryDate', type: 'uint256' },
        ],
        name: 'renew',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { internalType: 'bytes32', name: 'role', type: 'bytes32' },
          { internalType: 'address', name: 'account', type: 'address' },
        ],
        name: 'renounceRole',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { internalType: 'bytes32', name: 'role', type: 'bytes32' },
          { internalType: 'address', name: 'account', type: 'address' },
        ],
        name: 'revokeRole',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { internalType: 'address', name: 'to', type: 'address' },
          { internalType: 'uint256', name: 'timeExpire', type: 'uint256' },
        ],
        name: 'safeMint',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { internalType: 'address', name: 'from', type: 'address' },
          { internalType: 'address', name: 'to', type: 'address' },
          { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
        ],
        name: 'safeTransferFrom',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { internalType: 'address', name: 'from', type: 'address' },
          { internalType: 'address', name: 'to', type: 'address' },
          { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
          { internalType: 'bytes', name: 'data', type: 'bytes' },
        ],
        name: 'safeTransferFrom',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { internalType: 'address', name: '', type: 'address' },
          { internalType: 'bool', name: '', type: 'bool' },
        ],
        name: 'setApprovalForAll',
        outputs: [],
        stateMutability: 'pure',
        type: 'function',
      },
      { inputs: [{ internalType: 'string', name: '_baseTokenURI', type: 'string' }], name: 'setBaseURI', outputs: [], stateMutability: 'nonpayable', type: 'function' },
      {
        inputs: [
          { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
          { internalType: 'uint256', name: 'expiryDate', type: 'uint256' },
        ],
        name: 'setTokenExpireTime',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'bytes4', name: 'interfaceId', type: 'bytes4' }],
        name: 'supportsInterface',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
      },
      { inputs: [], name: 'symbol', outputs: [{ internalType: 'string', name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
      {
        inputs: [{ internalType: 'address', name: 'ownerAddress', type: 'address' }],
        name: 'tokenIdOf',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
        name: 'tokenURI',
        outputs: [{ internalType: 'string', name: '', type: 'string' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { internalType: 'address', name: 'from', type: 'address' },
          { internalType: 'address', name: 'to', type: 'address' },
          { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
        ],
        name: 'transferFrom',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    bytecode: null,
  },
  {
    contractName: 'EvmServiceWrapper',
    abi: [
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'address', name: 'issuer', type: 'address' },
          { indexed: true, internalType: 'address', name: 'serviceProvider', type: 'address' },
        ],
        name: 'Approve',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'address', name: 'account', type: 'address' },
          { indexed: false, internalType: 'enumRole', name: 'role', type: 'uint8' },
          { indexed: false, internalType: 'uint256', name: 'expiryDate', type: 'uint256' },
        ],
        name: 'Assign',
        type: 'event',
      },
      { anonymous: false, inputs: [{ indexed: true, internalType: 'address', name: 'account', type: 'address' }], name: 'EditDetail', type: 'event' },
      { anonymous: false, inputs: [{ indexed: false, internalType: 'uint8', name: 'version', type: 'uint8' }], name: 'Initialized', type: 'event' },
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'address', name: 'previousOwner', type: 'address' },
          { indexed: true, internalType: 'address', name: 'newOwner', type: 'address' },
        ],
        name: 'OwnershipTransferStarted',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'address', name: 'previousOwner', type: 'address' },
          { indexed: true, internalType: 'address', name: 'newOwner', type: 'address' },
        ],
        name: 'OwnershipTransferred',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'address', name: 'previousQOE', type: 'address' },
          { indexed: true, internalType: 'address', name: 'newQOE', type: 'address' },
        ],
        name: 'QOETransferStarted',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'address', name: 'account', type: 'address' },
          { indexed: false, internalType: 'uint256', name: 'expiryDate', type: 'uint256' },
        ],
        name: 'Renew',
        type: 'event',
      },
      { anonymous: false, inputs: [{ indexed: true, internalType: 'address', name: 'account', type: 'address' }], name: 'Revoke', type: 'event' },
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'address', name: 'account', type: 'address' },
          { indexed: false, internalType: 'bool', name: 'status', type: 'bool' },
        ],
        name: 'SetEnableKYB',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'address', name: 'account', type: 'address' },
          { indexed: false, internalType: 'bool', name: 'status', type: 'bool' },
        ],
        name: 'SetEnableKYC',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'address', name: 'account', type: 'address' },
          { indexed: false, internalType: 'uint256', name: 'gasLimit', type: 'uint256' },
        ],
        name: 'SetGasLimit',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'address', name: 'account', type: 'address' },
          { indexed: false, internalType: 'bool', name: 'manageDirectly', type: 'bool' },
        ],
        name: 'SetManageDirectly',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'address', name: 'account', type: 'address' },
          { indexed: true, internalType: 'address', name: 'serviceProvider', type: 'address' },
          { indexed: false, internalType: 'uint64', name: 'permissions', type: 'uint64' },
        ],
        name: 'SetServiceProviderPermissions',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: 'address', name: 'oldQOE', type: 'address' },
          { indexed: true, internalType: 'address', name: 'newQOE', type: 'address' },
        ],
        name: 'TransferQOE',
        type: 'event',
      },
      { inputs: [], name: 'KYC_PERMISSION_RECEIVE_OTHER_NATIVE_TOKEN', outputs: [{ internalType: 'uint64', name: '', type: 'uint64' }], stateMutability: 'view', type: 'function' },
      { inputs: [], name: 'KYC_PERMISSION_RECEIVE_QARE_TOKEN', outputs: [{ internalType: 'uint64', name: '', type: 'uint64' }], stateMutability: 'view', type: 'function' },
      { inputs: [], name: 'KYC_PERMISSION_RECEIVE_QRX_TOKEN', outputs: [{ internalType: 'uint64', name: '', type: 'uint64' }], stateMutability: 'view', type: 'function' },
      { inputs: [], name: 'KYC_PERMISSION_RECEIVE_QVOUCHER_TOKEN', outputs: [{ internalType: 'uint64', name: '', type: 'uint64' }], stateMutability: 'view', type: 'function' },
      { inputs: [], name: 'KYC_PERMISSION_USE_GASWAIVER', outputs: [{ internalType: 'uint64', name: '', type: 'uint64' }], stateMutability: 'view', type: 'function' },
      { inputs: [], name: 'acceptOwnership', outputs: [], stateMutability: 'nonpayable', type: 'function' },
      { inputs: [], name: 'acceptQOE', outputs: [], stateMutability: 'nonpayable', type: 'function' },
      {
        inputs: [
          { internalType: 'address', name: 'serviceProvider', type: 'address' },
          { internalType: 'enumProviderMetaMap.Kind', name: 'kind', type: 'uint8' },
        ],
        name: 'applyFor',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      { inputs: [{ internalType: 'address', name: 'serviceProvider', type: 'address' }], name: 'approve', outputs: [], stateMutability: 'nonpayable', type: 'function' },
      {
        inputs: [
          { internalType: 'address', name: 'account', type: 'address' },
          { internalType: 'string', name: 'name', type: 'string' },
          { internalType: 'string', name: 'uri', type: 'string' },
          { internalType: 'string', name: 'email', type: 'string' },
          { internalType: 'string', name: 'description', type: 'string' },
          { internalType: 'enumRole', name: 'role', type: 'uint8' },
          { internalType: 'uint256', name: 'expiryDate', type: 'uint256' },
        ],
        name: 'assign',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'address', name: 'serviceProvider', type: 'address' }],
        name: 'contractDetailOf',
        outputs: [
          {
            components: [
              { internalType: 'address', name: 'issuer', type: 'address' },
              { internalType: 'string', name: 'name', type: 'string' },
              { internalType: 'string', name: 'symbol', type: 'string' },
              { internalType: 'bool', name: 'valid', type: 'bool' },
              { internalType: 'enumProviderMetaMap.Kind', name: 'kind', type: 'uint8' },
            ],
            internalType: 'structIServiceWrapper.contractDetail',
            name: '',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { internalType: 'address', name: 'account', type: 'address' },
          { internalType: 'bool', name: 'approved', type: 'bool' },
        ],
        name: 'contractUnder',
        outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
        name: 'detailOf',
        outputs: [
          {
            components: [
              { internalType: 'string', name: 'name', type: 'string' },
              { internalType: 'string', name: 'uri', type: 'string' },
              { internalType: 'string', name: 'email', type: 'string' },
              { internalType: 'string', name: 'description', type: 'string' },
              { internalType: 'bool', name: 'valid', type: 'bool' },
              { internalType: 'enumRole', name: 'role', type: 'uint8' },
              { internalType: 'uint256', name: 'expiryDate', type: 'uint256' },
              { internalType: 'address[]', name: 'superior', type: 'address[]' },
              { internalType: 'address[]', name: 'subordinate', type: 'address[]' },
              { internalType: 'address', name: 'serviceProvider', type: 'address' },
            ],
            internalType: 'structdetail',
            name: '',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { internalType: 'address', name: 'account', type: 'address' },
          { internalType: 'string', name: 'name', type: 'string' },
          { internalType: 'string', name: 'uri', type: 'string' },
          { internalType: 'string', name: 'email', type: 'string' },
          { internalType: 'string', name: 'description', type: 'string' },
        ],
        name: 'editDetail',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      { inputs: [], name: 'getEnableKYB', outputs: [{ internalType: 'bool', name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
      { inputs: [], name: 'getEnableKYC', outputs: [{ internalType: 'bool', name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
      { inputs: [], name: 'getGasLimit', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
      { inputs: [], name: 'getManageDirectly', outputs: [{ internalType: 'bool', name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
      { inputs: [], name: 'getQOE', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
      {
        inputs: [{ internalType: 'address', name: 'serviceProvider', type: 'address' }],
        name: 'getServiceProviderPermissions',
        outputs: [{ internalType: 'uint64', name: '', type: 'uint64' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { internalType: 'address', name: 'owner', type: 'address' },
          { internalType: 'address', name: 'qoe', type: 'address' },
          { internalType: 'string', name: 'name', type: 'string' },
          { internalType: 'string', name: 'uri', type: 'string' },
          { internalType: 'string', name: 'email', type: 'string' },
          { internalType: 'string', name: 'description', type: 'string' },
        ],
        name: 'initialize',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { internalType: 'address', name: 'account', type: 'address' },
          { internalType: 'enumProviderMetaMap.Kind', name: 'kind', type: 'uint8' },
        ],
        name: 'kybkycStatus',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { internalType: 'address', name: 'role', type: 'address' },
          { internalType: 'address', name: 'account', type: 'address' },
          { internalType: 'enumProviderMetaMap.Kind', name: 'kind', type: 'uint8' },
        ],
        name: 'kybkycStatusUnder',
        outputs: [
          { internalType: 'address', name: '', type: 'address' },
          { internalType: 'bool', name: '', type: 'bool' },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { internalType: 'address', name: 'role', type: 'address' },
          { internalType: 'address', name: 'account', type: 'address' },
          { internalType: 'enumProviderMetaMap.Kind', name: 'kind', type: 'uint8' },
          { internalType: 'uint64', name: 'permissions', type: 'uint64' },
        ],
        name: 'kybkycStatusUnderV2',
        outputs: [
          { internalType: 'address', name: '', type: 'address' },
          { internalType: 'bool', name: '', type: 'bool' },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { internalType: 'address', name: 'account', type: 'address' },
          { internalType: 'enumProviderMetaMap.Kind', name: 'kind', type: 'uint8' },
          { internalType: 'uint64', name: 'permissions', type: 'uint64' },
        ],
        name: 'kybkycStatusV2',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
      },
      { inputs: [], name: 'owner', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
      { inputs: [], name: 'pendingOwner', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
      { inputs: [], name: 'pendingQOE', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
      {
        inputs: [
          { internalType: 'address', name: 'account', type: 'address' },
          { internalType: 'uint256', name: 'expiryDate', type: 'uint256' },
        ],
        name: 'renew',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      { inputs: [], name: 'renounceOwnership', outputs: [], stateMutability: 'nonpayable', type: 'function' },
      { inputs: [{ internalType: 'address', name: 'account', type: 'address' }], name: 'revoke', outputs: [], stateMutability: 'nonpayable', type: 'function' },
      { inputs: [{ internalType: 'bool', name: 'status', type: 'bool' }], name: 'setEnableKYB', outputs: [], stateMutability: 'nonpayable', type: 'function' },
      { inputs: [{ internalType: 'bool', name: 'status', type: 'bool' }], name: 'setEnableKYC', outputs: [], stateMutability: 'nonpayable', type: 'function' },
      { inputs: [{ internalType: 'uint256', name: 'gasLimit', type: 'uint256' }], name: 'setGasLimit', outputs: [], stateMutability: 'nonpayable', type: 'function' },
      { inputs: [{ internalType: 'bool', name: 'manageDirectly', type: 'bool' }], name: 'setManageDirectly', outputs: [], stateMutability: 'nonpayable', type: 'function' },
      {
        inputs: [
          { internalType: 'address', name: 'serviceProvider', type: 'address' },
          { internalType: 'uint64', name: 'permissions', type: 'uint64' },
        ],
        name: 'setServiceProviderPermissions',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      { inputs: [{ internalType: 'address', name: 'newOwner', type: 'address' }], name: 'transferOwnership', outputs: [], stateMutability: 'nonpayable', type: 'function' },
      { inputs: [{ internalType: 'address', name: 'newQOE', type: 'address' }], name: 'transferQOE', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    ],
    bytecode: null,
  },
];

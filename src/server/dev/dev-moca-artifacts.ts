import type { DevPrecompileArtifact } from '@/server/dev/dev-precompile-artifacts';

export const MOCA_SYSTEM_ARTIFACTS: DevPrecompileArtifact[] = [
  {
    contractName: 'MocaBank',
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
            indexed: false,
            internalType: 'string',
            name: 'amount',
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
            name: 'amount',
            type: 'string',
          },
        ],
        name: 'Send',
        type: 'event',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'accountAddress',
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
            name: 'accountAddress',
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
            name: 'metadata',
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
            name: 'pageRequest',
            type: 'tuple',
          },
        ],
        name: 'denomOwners',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'accountAddress',
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
                internalType: 'struct Coin',
                name: 'balance',
                type: 'tuple',
              },
            ],
            internalType: 'struct DenomOwner[]',
            name: 'denomOwners',
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
            name: 'pageRequest',
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
            name: 'sendEnableds',
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
            name: 'accountAddress',
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
        inputs: [
          {
            internalType: 'address',
            name: 'accountAddress',
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
    contractName: 'MocaGov',
    abi: [
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
        name: 'LegacySubmitProposal',
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
            internalType: 'uint8',
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
        ],
        name: 'VoteWeighted',
        type: 'event',
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
        name: 'deposit',
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
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
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
        name: 'deposits',
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
        inputs: [
          {
            internalType: 'string',
            name: 'title',
            type: 'string',
          },
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
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
            ],
            internalType: 'struct Coin[]',
            name: 'initialDeposit',
            type: 'tuple[]',
          },
        ],
        name: 'legacySubmitProposal',
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
                internalType: 'int64',
                name: 'votingPeriod',
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
        name: 'proposal',
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
                internalType: 'enum ProposalStatus',
                name: 'status',
                type: 'uint8',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'yesCount',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'abstainCount',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'noCount',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'noWithVetoCount',
                    type: 'string',
                  },
                ],
                internalType: 'struct TallyResult',
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
              {
                internalType: 'string',
                name: 'failedReason',
                type: 'string',
              },
            ],
            internalType: 'struct Proposal',
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
            internalType: 'enum ProposalStatus',
            name: 'status',
            type: 'uint8',
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
        name: 'proposals',
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
                internalType: 'enum ProposalStatus',
                name: 'status',
                type: 'uint8',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'yesCount',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'abstainCount',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'noCount',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'noWithVetoCount',
                    type: 'string',
                  },
                ],
                internalType: 'struct TallyResult',
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
              {
                internalType: 'string',
                name: 'failedReason',
                type: 'string',
              },
            ],
            internalType: 'struct Proposal[]',
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
            internalType: 'string',
            name: 'messages',
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
            name: 'initialDeposit',
            type: 'tuple[]',
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
            internalType: 'bool',
            name: 'expedited',
            type: 'bool',
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
            internalType: 'uint64',
            name: 'proposalId',
            type: 'uint64',
          },
        ],
        name: 'tallyResult',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'yesCount',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'abstainCount',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'noCount',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'noWithVetoCount',
                type: 'string',
              },
            ],
            internalType: 'struct TallyResult',
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
        name: 'vote',
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
            internalType: 'struct VoteData',
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
        name: 'votes',
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
            internalType: 'struct VoteData[]',
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
    ],
    bytecode: null,
  },
  {
    contractName: 'MocaStaking',
    abi: [
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
            name: 'delegator',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'validator',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'amount',
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
            name: 'validator',
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
        name: 'Undelegate',
        type: 'event',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'validatorAddress',
            type: 'address',
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
            internalType: 'address',
            name: 'validatorAddress',
            type: 'address',
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
            name: 'delegatorAddr',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'validatorAddr',
            type: 'address',
          },
        ],
        name: 'delegation',
        outputs: [
          {
            components: [
              {
                components: [
                  {
                    internalType: 'address',
                    name: 'delegatorAddress',
                    type: 'address',
                  },
                  {
                    internalType: 'address',
                    name: 'validatorAddress',
                    type: 'address',
                  },
                  {
                    components: [
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
                    internalType: 'struct Dec',
                    name: 'shares',
                    type: 'tuple',
                  },
                ],
                internalType: 'struct Delegation',
                name: 'delegation',
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
                name: 'balance',
                type: 'tuple',
              },
            ],
            internalType: 'struct DelegationResponse',
            name: 'response',
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
            name: 'delegatorAddr',
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
        name: 'delegatorDelegations',
        outputs: [
          {
            components: [
              {
                components: [
                  {
                    internalType: 'address',
                    name: 'delegatorAddress',
                    type: 'address',
                  },
                  {
                    internalType: 'address',
                    name: 'validatorAddress',
                    type: 'address',
                  },
                  {
                    components: [
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
                    internalType: 'struct Dec',
                    name: 'shares',
                    type: 'tuple',
                  },
                ],
                internalType: 'struct Delegation',
                name: 'delegation',
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
                name: 'balance',
                type: 'tuple',
              },
            ],
            internalType: 'struct DelegationResponse[]',
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
            name: 'delegatorAddr',
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
        name: 'delegatorUnbondingDelegations',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'delegatorAddress',
                type: 'address',
              },
              {
                internalType: 'address',
                name: 'validatorAddress',
                type: 'address',
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
                ],
                internalType: 'struct UnbondingDelegationEntry[]',
                name: 'entries',
                type: 'tuple[]',
              },
            ],
            internalType: 'struct UnbondingDelegation[]',
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
            name: 'delegatorAddr',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'validatorAddr',
            type: 'address',
          },
        ],
        name: 'delegatorValidator',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'operatorAddress',
                type: 'address',
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
                components: [
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
                    internalType: 'int64',
                    name: 'updateTime',
                    type: 'int64',
                  },
                ],
                internalType: 'struct Commission',
                name: 'commission',
                type: 'tuple',
              },
              {
                internalType: 'uint256',
                name: 'minSelfDelegation',
                type: 'uint256',
              },
              {
                internalType: 'int64',
                name: 'unbondingOnHoldRefCount',
                type: 'int64',
              },
              {
                internalType: 'uint64[]',
                name: 'unbondingIds',
                type: 'uint64[]',
              },
              {
                internalType: 'string',
                name: 'selfDelAddress',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'relayerAddress',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'challengerAddress',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'blsKey',
                type: 'string',
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
            internalType: 'address',
            name: 'delegatorAddr',
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
        name: 'delegatorValidators',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'operatorAddress',
                type: 'address',
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
                components: [
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
                    internalType: 'int64',
                    name: 'updateTime',
                    type: 'int64',
                  },
                ],
                internalType: 'struct Commission',
                name: 'commission',
                type: 'tuple',
              },
              {
                internalType: 'uint256',
                name: 'minSelfDelegation',
                type: 'uint256',
              },
              {
                internalType: 'int64',
                name: 'unbondingOnHoldRefCount',
                type: 'int64',
              },
              {
                internalType: 'uint64[]',
                name: 'unbondingIds',
                type: 'uint64[]',
              },
              {
                internalType: 'string',
                name: 'selfDelAddress',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'relayerAddress',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'challengerAddress',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'blsKey',
                type: 'string',
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
            internalType: 'int256',
            name: 'commissionRate',
            type: 'int256',
          },
          {
            internalType: 'int256',
            name: 'minSelfDelegation',
            type: 'int256',
          },
          {
            internalType: 'address',
            name: 'relayerAddress',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'challengerAddress',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'blsKey',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'blsProof',
            type: 'string',
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
                    components: [
                      {
                        internalType: 'uint64',
                        name: 'block',
                        type: 'uint64',
                      },
                      {
                        internalType: 'uint64',
                        name: 'app',
                        type: 'uint64',
                      },
                    ],
                    internalType: 'struct Consensus',
                    name: 'version',
                    type: 'tuple',
                  },
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
                  {
                    components: [
                      {
                        internalType: 'string',
                        name: 'hash',
                        type: 'string',
                      },
                      {
                        components: [
                          {
                            internalType: 'uint32',
                            name: 'total',
                            type: 'uint32',
                          },
                          {
                            internalType: 'string',
                            name: 'hash',
                            type: 'string',
                          },
                        ],
                        internalType: 'struct PartSetHeader',
                        name: 'partSetHeader',
                        type: 'tuple',
                      },
                    ],
                    internalType: 'struct BlockID',
                    name: 'lastBlockId',
                    type: 'tuple',
                  },
                  {
                    internalType: 'string',
                    name: 'lastCommitHash',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'dataHash',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'validatorsHash',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'nextValidatorsHash',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'consensusHash',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'appHash',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'lastResultsHash',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'evidenceHash',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'proposerAddress',
                    type: 'string',
                  },
                ],
                internalType: 'struct Header',
                name: 'header',
                type: 'tuple',
              },
              {
                components: [
                  {
                    internalType: 'address',
                    name: 'operatorAddress',
                    type: 'address',
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
                    components: [
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
                        internalType: 'int64',
                        name: 'updateTime',
                        type: 'int64',
                      },
                    ],
                    internalType: 'struct Commission',
                    name: 'commission',
                    type: 'tuple',
                  },
                  {
                    internalType: 'uint256',
                    name: 'minSelfDelegation',
                    type: 'uint256',
                  },
                  {
                    internalType: 'int64',
                    name: 'unbondingOnHoldRefCount',
                    type: 'int64',
                  },
                  {
                    internalType: 'uint64[]',
                    name: 'unbondingIds',
                    type: 'uint64[]',
                  },
                  {
                    internalType: 'string',
                    name: 'selfDelAddress',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'relayerAddress',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'challengerAddress',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'blsKey',
                    type: 'string',
                  },
                ],
                internalType: 'struct Validator[]',
                name: 'valset',
                type: 'tuple[]',
              },
            ],
            internalType: 'struct HistoricalInfo',
            name: 'historicalInfo',
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
                internalType: 'uint256',
                name: 'minCommissionRate',
                type: 'uint256',
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
            internalType: 'struct Pool',
            name: 'pool',
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
            name: 'validatorSrcAddress',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'validatorDstAddress',
            type: 'address',
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
            internalType: 'uint256',
            name: 'completionTime',
            type: 'uint256',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'delegatorAddr',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'srcValidatorAddr',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'dstValidatorAddr',
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
        name: 'redelegations',
        outputs: [
          {
            components: [
              {
                components: [
                  {
                    internalType: 'address',
                    name: 'delegatorAddress',
                    type: 'address',
                  },
                  {
                    internalType: 'address',
                    name: 'validatorSrcAddress',
                    type: 'address',
                  },
                  {
                    internalType: 'address',
                    name: 'validatorDstAddress',
                    type: 'address',
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
                        name: 'shareDst',
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
                        name: 'shareDst',
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
            name: 'redelegationResponses',
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
            name: 'delegatorAddr',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'validatorAddr',
            type: 'address',
          },
        ],
        name: 'unbondingDelegation',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'delegatorAddress',
                type: 'address',
              },
              {
                internalType: 'address',
                name: 'validatorAddress',
                type: 'address',
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
                ],
                internalType: 'struct UnbondingDelegationEntry[]',
                name: 'entries',
                type: 'tuple[]',
              },
            ],
            internalType: 'struct UnbondingDelegation',
            name: 'response',
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
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        name: 'undelegate',
        outputs: [
          {
            internalType: 'uint256',
            name: 'completionTime',
            type: 'uint256',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'validatorAddr',
            type: 'address',
          },
        ],
        name: 'validator',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'operatorAddress',
                type: 'address',
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
                components: [
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
                    internalType: 'int64',
                    name: 'updateTime',
                    type: 'int64',
                  },
                ],
                internalType: 'struct Commission',
                name: 'commission',
                type: 'tuple',
              },
              {
                internalType: 'uint256',
                name: 'minSelfDelegation',
                type: 'uint256',
              },
              {
                internalType: 'int64',
                name: 'unbondingOnHoldRefCount',
                type: 'int64',
              },
              {
                internalType: 'uint64[]',
                name: 'unbondingIds',
                type: 'uint64[]',
              },
              {
                internalType: 'string',
                name: 'selfDelAddress',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'relayerAddress',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'challengerAddress',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'blsKey',
                type: 'string',
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
            internalType: 'address',
            name: 'validatorAddr',
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
        name: 'validatorDelegations',
        outputs: [
          {
            components: [
              {
                components: [
                  {
                    internalType: 'address',
                    name: 'delegatorAddress',
                    type: 'address',
                  },
                  {
                    internalType: 'address',
                    name: 'validatorAddress',
                    type: 'address',
                  },
                  {
                    components: [
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
                    internalType: 'struct Dec',
                    name: 'shares',
                    type: 'tuple',
                  },
                ],
                internalType: 'struct Delegation',
                name: 'delegation',
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
                name: 'balance',
                type: 'tuple',
              },
            ],
            internalType: 'struct DelegationResponse[]',
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
            name: 'validatorAddr',
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
        name: 'validatorUnbondingDelegations',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'delegatorAddress',
                type: 'address',
              },
              {
                internalType: 'address',
                name: 'validatorAddress',
                type: 'address',
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
                ],
                internalType: 'struct UnbondingDelegationEntry[]',
                name: 'entries',
                type: 'tuple[]',
              },
            ],
            internalType: 'struct UnbondingDelegation[]',
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
            internalType: 'enum BondStatus',
            name: 'status',
            type: 'uint8',
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
        name: 'validators',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'operatorAddress',
                type: 'address',
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
                components: [
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
                    internalType: 'int64',
                    name: 'updateTime',
                    type: 'int64',
                  },
                ],
                internalType: 'struct Commission',
                name: 'commission',
                type: 'tuple',
              },
              {
                internalType: 'uint256',
                name: 'minSelfDelegation',
                type: 'uint256',
              },
              {
                internalType: 'int64',
                name: 'unbondingOnHoldRefCount',
                type: 'int64',
              },
              {
                internalType: 'uint64[]',
                name: 'unbondingIds',
                type: 'uint64[]',
              },
              {
                internalType: 'string',
                name: 'selfDelAddress',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'relayerAddress',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'challengerAddress',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'blsKey',
                type: 'string',
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
    ],
    bytecode: null,
  },
  {
    contractName: 'MocaDistribution',
    abi: [
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
            name: 'amount',
            type: 'string',
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
            name: 'delegatorAddress',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'withdrawAddress',
            type: 'address',
          },
        ],
        name: 'SetWithdrawAddress',
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
            internalType: 'string',
            name: 'amount',
            type: 'string',
          },
        ],
        name: 'WithdrawDelegatorAllRewards',
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
            name: 'withdrawAddress',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'string',
            name: 'amount',
            type: 'string',
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
            internalType: 'address',
            name: 'validatorAddress',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'string',
            name: 'amount',
            type: 'string',
          },
        ],
        name: 'WithdrawValidatorCommission',
        type: 'event',
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
            name: 'pool',
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
            internalType: 'address',
            name: 'validatorAddress',
            type: 'address',
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
                internalType: 'address',
                name: 'validatorAddress',
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
            internalType: 'address[]',
            name: 'validators',
            type: 'address[]',
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
            internalType: 'address',
            name: 'withdrawAddress',
            type: 'address',
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
        inputs: [],
        name: 'params',
        outputs: [
          {
            components: [
              {
                internalType: 'uint256',
                name: 'communityTax',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'baseProposerReward',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'bonusProposerReward',
                type: 'uint256',
              },
              {
                internalType: 'bool',
                name: 'withdrawAddrEnabled',
                type: 'bool',
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
            name: 'withdrawAddress',
            type: 'address',
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
            internalType: 'address',
            name: 'validatorAddress',
            type: 'address',
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
            internalType: 'address',
            name: 'validatorAddress',
            type: 'address',
          },
        ],
        name: 'validatorDistributionInfo',
        outputs: [
          {
            internalType: 'address',
            name: 'operatorAddress',
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
            internalType: 'address',
            name: 'validatorAddress',
            type: 'address',
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
            name: 'pagination',
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
                internalType: 'uint256',
                name: 'fraction',
                type: 'uint256',
              },
            ],
            internalType: 'struct ValidatorSlashEvent[]',
            name: 'validatorSlashEvents',
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
        name: 'withdrawDelegatorAllRewards',
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
            name: 'validatorAddress',
            type: 'address',
          },
        ],
        name: 'withdrawDelegatorReward',
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
        inputs: [],
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
    ],
    bytecode: null,
  },
  {
    contractName: 'MocaSlashing',
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
        name: 'Unjail',
        type: 'event',
      },
      {
        inputs: [],
        name: 'params',
        outputs: [
          {
            components: [
              {
                internalType: 'int64',
                name: 'signedBlocksWindow',
                type: 'int64',
              },
              {
                internalType: 'string',
                name: 'minSignedPerWindow',
                type: 'string',
              },
              {
                internalType: 'int64',
                name: 'downtimeJailDuration',
                type: 'int64',
              },
              {
                internalType: 'string',
                name: 'slashFractionDoubleSign',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'slashFractionDowntime',
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
            internalType: 'address',
            name: 'consAddress',
            type: 'address',
          },
        ],
        name: 'signingInfo',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'consAddress',
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
            internalType: 'struct ValidatorSigningInfo',
            name: 'valSigningInfo',
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
        name: 'signingInfos',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'consAddress',
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
            internalType: 'struct ValidatorSigningInfo[]',
            name: 'infos',
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
    contractName: 'MocaAuthz',
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'grantee',
            type: 'address',
          },
        ],
        name: 'Exec',
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
            name: 'grantee',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'string',
            name: 'authzType',
            type: 'string',
          },
        ],
        name: 'Grant',
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
            name: 'grantee',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'string',
            name: 'msgTypeUrl',
            type: 'string',
          },
        ],
        name: 'Revoke',
        type: 'event',
      },
      {
        inputs: [
          {
            internalType: 'string[]',
            name: 'msgs',
            type: 'string[]',
          },
        ],
        name: 'exec',
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
            name: 'grantee',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'authzType',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'authorization',
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
            name: 'limit',
            type: 'tuple[]',
          },
          {
            internalType: 'int64',
            name: 'expiration',
            type: 'int64',
          },
        ],
        name: 'grant',
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
            name: 'grantee',
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
        name: 'granteeGrants',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'granter',
                type: 'address',
              },
              {
                internalType: 'address',
                name: 'grantee',
                type: 'address',
              },
              {
                internalType: 'string',
                name: 'authorization',
                type: 'string',
              },
              {
                internalType: 'int64',
                name: 'expiration',
                type: 'int64',
              },
            ],
            internalType: 'struct GrantAuthorization[]',
            name: 'grants',
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
            name: 'granter',
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
        name: 'granterGrants',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'granter',
                type: 'address',
              },
              {
                internalType: 'address',
                name: 'grantee',
                type: 'address',
              },
              {
                internalType: 'string',
                name: 'authorization',
                type: 'string',
              },
              {
                internalType: 'int64',
                name: 'expiration',
                type: 'int64',
              },
            ],
            internalType: 'struct GrantAuthorization[]',
            name: 'grants',
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
            name: 'granter',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'grantee',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'msgTypeUrl',
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
        name: 'grants',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'authorization',
                type: 'string',
              },
              {
                internalType: 'int64',
                name: 'expiration',
                type: 'int64',
              },
            ],
            internalType: 'struct GrantData[]',
            name: 'grants',
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
            name: 'grantee',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'msgTypeUrl',
            type: 'string',
          },
        ],
        name: 'revoke',
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
    contractName: 'MocaPayment',
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
        ],
        name: 'CreatePaymentAccount',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'operator',
            type: 'address',
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
            name: 'owner',
            type: 'address',
          },
        ],
        name: 'DisableRefund',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
        ],
        name: 'Withdraw',
        type: 'event',
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
        name: 'autoSettleRecords',
        outputs: [
          {
            components: [
              {
                internalType: 'int64',
                name: 'timestamp',
                type: 'int64',
              },
              {
                internalType: 'string',
                name: 'addr',
                type: 'string',
              },
            ],
            internalType: 'struct AutoSettleRecord[]',
            name: 'autoSettleRecords',
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
        name: 'createPaymentAccount',
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
            name: 'account',
            type: 'string',
          },
        ],
        name: 'delayedWithdrawal',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'addr',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
              {
                internalType: 'string',
                name: 'from',
                type: 'string',
              },
              {
                internalType: 'int64',
                name: 'unlockTimestamp',
                type: 'int64',
              },
            ],
            internalType: 'struct DelayedWithdrawalRecord',
            name: 'delayedWithdrawal',
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
            name: 'to',
            type: 'string',
          },
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
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
        inputs: [
          {
            internalType: 'string',
            name: 'addr',
            type: 'string',
          },
        ],
        name: 'disableRefund',
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
            name: 'account',
            type: 'string',
          },
        ],
        name: 'dynamicBalance',
        outputs: [
          {
            components: [
              {
                internalType: 'uint256',
                name: 'dynamicBalance',
                type: 'uint256',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'account',
                    type: 'string',
                  },
                  {
                    internalType: 'int64',
                    name: 'crudTimestamp',
                    type: 'int64',
                  },
                  {
                    internalType: 'uint256',
                    name: 'netflowRate',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint256',
                    name: 'staticBalance',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint256',
                    name: 'bufferBalance',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint256',
                    name: 'lockBalance',
                    type: 'uint256',
                  },
                  {
                    internalType: 'int32',
                    name: 'status',
                    type: 'int32',
                  },
                  {
                    internalType: 'int64',
                    name: 'settleTimestamp',
                    type: 'int64',
                  },
                  {
                    internalType: 'uint64',
                    name: 'outFlowCount',
                    type: 'uint64',
                  },
                  {
                    internalType: 'uint256',
                    name: 'frozenNetflowRate',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct StreamRecord',
                name: 'streamRecord',
                type: 'tuple',
              },
              {
                internalType: 'int64',
                name: 'currentTimestamp',
                type: 'int64',
              },
              {
                internalType: 'uint256',
                name: 'bankBalance',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'availableBalance',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'lockedFee',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'changeRate',
                type: 'uint256',
              },
            ],
            internalType: 'struct DynamicBalance',
            name: 'dynamicBalance',
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
            name: 'account',
            type: 'string',
          },
        ],
        name: 'outFlows',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'toAddress',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'rate',
                type: 'uint256',
              },
              {
                internalType: 'int32',
                name: 'status',
                type: 'int32',
              },
            ],
            internalType: 'struct OutFlow[]',
            name: 'outFlows',
            type: 'tuple[]',
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
                    internalType: 'uint64',
                    name: 'reserveTime',
                    type: 'uint64',
                  },
                  {
                    internalType: 'uint256',
                    name: 'validatorTaxRate',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct VersionedParams',
                name: 'versionedParams',
                type: 'tuple',
              },
              {
                internalType: 'uint64',
                name: 'paymentAccountCountLimit',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'forcedSettleTime',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'maxAutoSettleFlowCount',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'maxAutoResumeFlowCount',
                type: 'uint64',
              },
              {
                internalType: 'string',
                name: 'feeDenom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'withdrawTimeLockThreshold',
                type: 'uint256',
              },
              {
                internalType: 'uint64',
                name: 'withdrawTimeLockDuration',
                type: 'uint64',
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
            internalType: 'int64',
            name: 'timestamp',
            type: 'int64',
          },
        ],
        name: 'paramsByTimestamp',
        outputs: [
          {
            components: [
              {
                components: [
                  {
                    internalType: 'uint64',
                    name: 'reserveTime',
                    type: 'uint64',
                  },
                  {
                    internalType: 'uint256',
                    name: 'validatorTaxRate',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct VersionedParams',
                name: 'versionedParams',
                type: 'tuple',
              },
              {
                internalType: 'uint64',
                name: 'paymentAccountCountLimit',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'forcedSettleTime',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'maxAutoSettleFlowCount',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'maxAutoResumeFlowCount',
                type: 'uint64',
              },
              {
                internalType: 'string',
                name: 'feeDenom',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'withdrawTimeLockThreshold',
                type: 'uint256',
              },
              {
                internalType: 'uint64',
                name: 'withdrawTimeLockDuration',
                type: 'uint64',
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
            internalType: 'string',
            name: 'addr',
            type: 'string',
          },
        ],
        name: 'paymentAccount',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'addr',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'owner',
                type: 'string',
              },
              {
                internalType: 'bool',
                name: 'refundable',
                type: 'bool',
              },
            ],
            internalType: 'struct PaymentAccount',
            name: 'paymentAccount',
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
            name: 'owner',
            type: 'string',
          },
        ],
        name: 'paymentAccountCount',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'owner',
                type: 'string',
              },
              {
                internalType: 'uint64',
                name: 'count',
                type: 'uint64',
              },
            ],
            internalType: 'struct PaymentAccountCount',
            name: 'paymentAccountCount',
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
        name: 'paymentAccountCounts',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'owner',
                type: 'string',
              },
              {
                internalType: 'uint64',
                name: 'count',
                type: 'uint64',
              },
            ],
            internalType: 'struct PaymentAccountCount[]',
            name: 'paymentAccountCounts',
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
            name: 'pagination',
            type: 'tuple',
          },
        ],
        name: 'paymentAccounts',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'addr',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'owner',
                type: 'string',
              },
              {
                internalType: 'bool',
                name: 'refundable',
                type: 'bool',
              },
            ],
            internalType: 'struct PaymentAccount[]',
            name: 'paymentAccounts',
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
            name: 'owner',
            type: 'string',
          },
        ],
        name: 'paymentAccountsByOwner',
        outputs: [
          {
            internalType: 'string[]',
            name: 'accounts',
            type: 'string[]',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'account',
            type: 'string',
          },
        ],
        name: 'streamRecord',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'account',
                type: 'string',
              },
              {
                internalType: 'int64',
                name: 'crudTimestamp',
                type: 'int64',
              },
              {
                internalType: 'uint256',
                name: 'netflowRate',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'staticBalance',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'bufferBalance',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'lockBalance',
                type: 'uint256',
              },
              {
                internalType: 'int32',
                name: 'status',
                type: 'int32',
              },
              {
                internalType: 'int64',
                name: 'settleTimestamp',
                type: 'int64',
              },
              {
                internalType: 'uint64',
                name: 'outFlowCount',
                type: 'uint64',
              },
              {
                internalType: 'uint256',
                name: 'frozenNetflowRate',
                type: 'uint256',
              },
            ],
            internalType: 'struct StreamRecord',
            name: 'streamRecord',
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
        name: 'streamRecords',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'account',
                type: 'string',
              },
              {
                internalType: 'int64',
                name: 'crudTimestamp',
                type: 'int64',
              },
              {
                internalType: 'uint256',
                name: 'netflowRate',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'staticBalance',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'bufferBalance',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'lockBalance',
                type: 'uint256',
              },
              {
                internalType: 'int32',
                name: 'status',
                type: 'int32',
              },
              {
                internalType: 'int64',
                name: 'settleTimestamp',
                type: 'int64',
              },
              {
                internalType: 'uint64',
                name: 'outFlowCount',
                type: 'uint64',
              },
              {
                internalType: 'uint256',
                name: 'frozenNetflowRate',
                type: 'uint256',
              },
            ],
            internalType: 'struct StreamRecord[]',
            name: 'streamRecords',
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
            name: 'from',
            type: 'string',
          },
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        name: 'withdraw',
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
    contractName: 'MocaPermission',
    abi: [
      {
        inputs: [],
        name: 'params',
        outputs: [
          {
            components: [
              {
                internalType: 'uint64',
                name: 'maximumStatementsNum',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'maximumGroupNum',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'maximumRemoveExpiredPoliciesIteration',
                type: 'uint64',
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
    ],
    bytecode: null,
  },
  {
    contractName: 'MocaErc20',
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'receiver',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'sender',
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
            indexed: true,
            internalType: 'address',
            name: 'sender',
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
        inputs: [
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
            name: 'coin',
            type: 'tuple',
          },
          {
            internalType: 'address',
            name: 'receiver',
            type: 'address',
          },
        ],
        name: 'convertCoin',
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
            name: 'contractAddress',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
          {
            internalType: 'address',
            name: 'receiver',
            type: 'address',
          },
        ],
        name: 'convertERC20',
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
                name: 'enableEvmHook',
                type: 'bool',
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
            name: 'token',
            type: 'address',
          },
        ],
        name: 'tokenPair',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'erc20Address',
                type: 'address',
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
                internalType: 'enum Owner',
                name: 'contractOwner',
                type: 'uint8',
              },
            ],
            internalType: 'struct TokenPair',
            name: 'tokenPair',
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
        name: 'tokenPairs',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'erc20Address',
                type: 'address',
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
                internalType: 'enum Owner',
                name: 'contractOwner',
                type: 'uint8',
              },
            ],
            internalType: 'struct TokenPair[]',
            name: 'tokenPairs',
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
    contractName: 'MocaVirtualGroup',
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'storageProvider',
            type: 'address',
          },
        ],
        name: 'CancelSwapIn',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'storageProvider',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'operator',
            type: 'address',
          },
        ],
        name: 'CompleteSPExit',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'storageProvider',
            type: 'address',
          },
        ],
        name: 'CompleteSwapIn',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'storageProvider',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'familyId',
            type: 'uint256',
          },
        ],
        name: 'CompleteSwapOut',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'storageProvider',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'familyId',
            type: 'uint256',
          },
        ],
        name: 'CreateGlobalVirtualGroup',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'storageProvider',
            type: 'address',
          },
        ],
        name: 'DeleteGlobalVirtualGroup',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'storageProvider',
            type: 'address',
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
            name: 'storageProvider',
            type: 'address',
          },
        ],
        name: 'ReserveSwapIn',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'storageProvider',
            type: 'address',
          },
        ],
        name: 'SPExit',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'storageProvider',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'familyId',
            type: 'uint256',
          },
        ],
        name: 'SwapOut',
        type: 'event',
      },
      {
        inputs: [
          {
            internalType: 'uint32',
            name: 'gvgFamilyId',
            type: 'uint32',
          },
          {
            internalType: 'uint32',
            name: 'globalVirtualGroupId',
            type: 'uint32',
          },
        ],
        name: 'cancelSwapIn',
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
            name: 'operator',
            type: 'string',
          },
        ],
        name: 'completeSPExit',
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
            internalType: 'uint32',
            name: 'gvgFamilyId',
            type: 'uint32',
          },
          {
            internalType: 'uint32',
            name: 'globalVirtualGroupId',
            type: 'uint32',
          },
        ],
        name: 'completeSwapIn',
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
            internalType: 'uint32',
            name: 'gvgFamilyId',
            type: 'uint32',
          },
          {
            internalType: 'uint32[]',
            name: 'gvgIds',
            type: 'uint32[]',
          },
        ],
        name: 'completeSwapOut',
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
            internalType: 'uint32',
            name: 'familyId',
            type: 'uint32',
          },
          {
            internalType: 'uint32[]',
            name: 'secondarySpIds',
            type: 'uint32[]',
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
            name: 'deposit',
            type: 'tuple',
          },
        ],
        name: 'createGlobalVirtualGroup',
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
            internalType: 'uint32',
            name: 'globalVirtualGroupId',
            type: 'uint32',
          },
        ],
        name: 'deleteGlobalVirtualGroup',
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
            internalType: 'uint32',
            name: 'globalVirtualGroupId',
            type: 'uint32',
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
            name: 'deposit',
            type: 'tuple',
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
        name: 'globalVirtualGroupFamilies',
        outputs: [
          {
            components: [
              {
                internalType: 'uint32',
                name: 'id',
                type: 'uint32',
              },
              {
                internalType: 'uint32',
                name: 'primarySpId',
                type: 'uint32',
              },
              {
                internalType: 'uint32[]',
                name: 'globalVirtualGroupIds',
                type: 'uint32[]',
              },
              {
                internalType: 'address',
                name: 'virtualPaymentAddress',
                type: 'address',
              },
            ],
            internalType: 'struct GlobalVirtualGroupFamily[]',
            name: 'gvgFamilies',
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
            internalType: 'uint32',
            name: 'familyId',
            type: 'uint32',
          },
        ],
        name: 'globalVirtualGroupFamily',
        outputs: [
          {
            components: [
              {
                internalType: 'uint32',
                name: 'id',
                type: 'uint32',
              },
              {
                internalType: 'uint32',
                name: 'primarySpId',
                type: 'uint32',
              },
              {
                internalType: 'uint32[]',
                name: 'globalVirtualGroupIds',
                type: 'uint32[]',
              },
              {
                internalType: 'address',
                name: 'virtualPaymentAddress',
                type: 'address',
              },
            ],
            internalType: 'struct GlobalVirtualGroupFamily',
            name: 'gvgfamily',
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
            name: 'targetSpId',
            type: 'uint32',
          },
          {
            internalType: 'uint32',
            name: 'gvgFamilyId',
            type: 'uint32',
          },
          {
            internalType: 'uint32',
            name: 'globalVirtualGroupId',
            type: 'uint32',
          },
        ],
        name: 'reserveSwapIn',
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
        name: 'spExit',
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
            internalType: 'uint32',
            name: 'gvgFamilyId',
            type: 'uint32',
          },
          {
            internalType: 'uint32[]',
            name: 'gvgIds',
            type: 'uint32[]',
          },
          {
            internalType: 'uint32',
            name: 'successorSpId',
            type: 'uint32',
          },
          {
            components: [
              {
                internalType: 'uint64',
                name: 'expiredHeight',
                type: 'uint64',
              },
              {
                internalType: 'uint32',
                name: 'globalVirtualGroupFamilyId',
                type: 'uint32',
              },
              {
                internalType: 'bytes',
                name: 'sig',
                type: 'bytes',
              },
            ],
            internalType: 'struct Approval',
            name: 'successorSpApproval',
            type: 'tuple',
          },
        ],
        name: 'swapOut',
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
    contractName: 'MocaStorage',
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
        ],
        name: 'CancelCreateObject',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'operator',
            type: 'address',
          },
        ],
        name: 'CancelMigrateBucket',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'operator',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'bytes32',
            name: 'objectName',
            type: 'bytes32',
          },
        ],
        name: 'CancelUpdateObjectContent',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'string',
            name: 'bucketName',
            type: 'string',
          },
        ],
        name: 'CompleteMigrateBucket',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
        ],
        name: 'CopyObject',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'paymentAddress',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'primarySpAddress',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'id',
            type: 'uint256',
          },
        ],
        name: 'CreateBucket',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'id',
            type: 'uint256',
          },
        ],
        name: 'CreateGroup',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'id',
            type: 'uint256',
          },
        ],
        name: 'CreateObject',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'string',
            name: 'objectName',
            type: 'string',
          },
        ],
        name: 'DelegateCreateObject',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'operator',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'string',
            name: 'objectName',
            type: 'string',
          },
        ],
        name: 'DelegateUpdateObjectContent',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
        ],
        name: 'DeleteBucket',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
        ],
        name: 'DeleteGroup',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
        ],
        name: 'DeleteObject',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
        ],
        name: 'DeletePolicy',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'string',
            name: 'bucketName',
            type: 'string',
          },
        ],
        name: 'DiscontinueBucket',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'string',
            name: 'bucketName',
            type: 'string',
          },
        ],
        name: 'DiscontinueObject',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'string',
            name: 'groupName',
            type: 'string',
          },
        ],
        name: 'LeaveGroup',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'string',
            name: 'bucketName',
            type: 'string',
          },
        ],
        name: 'MigrateBucket',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
        ],
        name: 'PutPolicy',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'operator',
            type: 'address',
          },
        ],
        name: 'RejectMigrateBucket',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'string',
            name: 'objectName',
            type: 'string',
          },
        ],
        name: 'RejectSealObject',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
        ],
        name: 'RenewGroupMember',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
        ],
        name: 'SealObject',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
        ],
        name: 'SealObjectV2',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'operator',
            type: 'address',
          },
        ],
        name: 'SetBucketFlowRateLimit',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
        ],
        name: 'SetTag',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
        ],
        name: 'ToggleSPAsDelegatedAgent',
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
            indexed: true,
            internalType: 'uint256',
            name: 'tokenId',
            type: 'uint256',
          },
        ],
        name: 'Transfer',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'operator',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'string',
            name: 'bucketName',
            type: 'string',
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'paymentAddress',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint8',
            name: 'visibility',
            type: 'uint8',
          },
        ],
        name: 'UpdateBucketInfo',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
        ],
        name: 'UpdateGroup',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
        ],
        name: 'UpdateGroupExtra',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'operator',
            type: 'address',
          },
          {
            indexed: true,
            internalType: 'string',
            name: 'objectName',
            type: 'string',
          },
        ],
        name: 'UpdateObjectContent',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
        ],
        name: 'UpdateObjectInfo',
        type: 'event',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'bucketName',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'objectName',
            type: 'string',
          },
        ],
        name: 'cancelCreateObject',
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
            name: 'bucketName',
            type: 'string',
          },
        ],
        name: 'cancelMigrateBucket',
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
            name: 'bucketName',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'objectName',
            type: 'string',
          },
        ],
        name: 'cancelUpdateObjectContent',
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
            name: 'bucketName',
            type: 'string',
          },
          {
            internalType: 'uint32',
            name: 'gvgFamilyId',
            type: 'uint32',
          },
          {
            components: [
              {
                internalType: 'uint32',
                name: 'srcGlobalVirtualGroupId',
                type: 'uint32',
              },
              {
                internalType: 'uint32',
                name: 'dstGlobalVirtualGroupId',
                type: 'uint32',
              },
              {
                internalType: 'bytes',
                name: 'secondarySpBlsSignature',
                type: 'bytes',
              },
            ],
            internalType: 'struct GVGMapping[]',
            name: 'gvgMappings',
            type: 'tuple[]',
          },
        ],
        name: 'completeMigrateBucket',
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
            name: 'srcBucketName',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'dstBucketName',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'srcObjectName',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'dstObjectName',
            type: 'string',
          },
          {
            components: [
              {
                internalType: 'uint64',
                name: 'expiredHeight',
                type: 'uint64',
              },
              {
                internalType: 'uint32',
                name: 'globalVirtualGroupFamilyId',
                type: 'uint32',
              },
              {
                internalType: 'bytes',
                name: 'sig',
                type: 'bytes',
              },
            ],
            internalType: 'struct Approval',
            name: 'dstPrimarySpApproval',
            type: 'tuple',
          },
        ],
        name: 'copyObject',
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
            name: 'bucketName',
            type: 'string',
          },
          {
            internalType: 'enum VisibilityType',
            name: 'visibility',
            type: 'uint8',
          },
          {
            internalType: 'address',
            name: 'paymentAddress',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'primarySpAddress',
            type: 'address',
          },
          {
            components: [
              {
                internalType: 'uint64',
                name: 'expiredHeight',
                type: 'uint64',
              },
              {
                internalType: 'uint32',
                name: 'globalVirtualGroupFamilyId',
                type: 'uint32',
              },
              {
                internalType: 'bytes',
                name: 'sig',
                type: 'bytes',
              },
            ],
            internalType: 'struct Approval',
            name: 'primarySpApproval',
            type: 'tuple',
          },
          {
            internalType: 'uint64',
            name: 'chargedReadQuota',
            type: 'uint64',
          },
        ],
        name: 'createBucket',
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
            name: 'groupName',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'extra',
            type: 'string',
          },
        ],
        name: 'createGroup',
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
            name: 'bucketName',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'objectName',
            type: 'string',
          },
          {
            internalType: 'uint64',
            name: 'payloadSize',
            type: 'uint64',
          },
          {
            internalType: 'enum VisibilityType',
            name: 'visibility',
            type: 'uint8',
          },
          {
            internalType: 'string',
            name: 'contentType',
            type: 'string',
          },
          {
            components: [
              {
                internalType: 'uint64',
                name: 'expiredHeight',
                type: 'uint64',
              },
              {
                internalType: 'uint32',
                name: 'globalVirtualGroupFamilyId',
                type: 'uint32',
              },
              {
                internalType: 'bytes',
                name: 'sig',
                type: 'bytes',
              },
            ],
            internalType: 'struct Approval',
            name: 'primarySpApproval',
            type: 'tuple',
          },
          {
            internalType: 'string[]',
            name: 'expectChecksums',
            type: 'string[]',
          },
          {
            internalType: 'enum RedundancyType',
            name: 'redundancyType',
            type: 'uint8',
          },
        ],
        name: 'createObject',
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
            name: 'creator',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'bucketName',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'objectName',
            type: 'string',
          },
          {
            internalType: 'uint64',
            name: 'payloadSize',
            type: 'uint64',
          },
          {
            internalType: 'string',
            name: 'contentType',
            type: 'string',
          },
          {
            internalType: 'enum VisibilityType',
            name: 'visibility',
            type: 'uint8',
          },
          {
            internalType: 'string[]',
            name: 'expectChecksums',
            type: 'string[]',
          },
          {
            internalType: 'enum RedundancyType',
            name: 'redundancyType',
            type: 'uint8',
          },
        ],
        name: 'delegateCreateObject',
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
            name: 'updater',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'bucketName',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'objectName',
            type: 'string',
          },
          {
            internalType: 'uint64',
            name: 'payloadSize',
            type: 'uint64',
          },
          {
            internalType: 'string',
            name: 'contentType',
            type: 'string',
          },
          {
            internalType: 'string[]',
            name: 'expectChecksums',
            type: 'string[]',
          },
        ],
        name: 'delegateUpdateObjectContent',
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
            name: 'bucketName',
            type: 'string',
          },
        ],
        name: 'deleteBucket',
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
            name: 'groupName',
            type: 'string',
          },
        ],
        name: 'deleteGroup',
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
            name: 'bucketName',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'objectName',
            type: 'string',
          },
        ],
        name: 'deleteObject',
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
                internalType: 'int32',
                name: 'principalType',
                type: 'int32',
              },
              {
                internalType: 'string',
                name: 'value',
                type: 'string',
              },
            ],
            internalType: 'struct Principal',
            name: 'principal',
            type: 'tuple',
          },
          {
            internalType: 'string',
            name: 'resource',
            type: 'string',
          },
        ],
        name: 'deletePolicy',
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
            name: 'bucketName',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'reason',
            type: 'string',
          },
        ],
        name: 'discontinueBucket',
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
            name: 'bucketName',
            type: 'string',
          },
          {
            internalType: 'uint256[]',
            name: 'objectIds',
            type: 'uint256[]',
          },
          {
            internalType: 'string',
            name: 'reason',
            type: 'string',
          },
        ],
        name: 'discontinueObject',
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
            name: 'bucketName',
            type: 'string',
          },
        ],
        name: 'headBucket',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'owner',
                type: 'address',
              },
              {
                internalType: 'string',
                name: 'bucketName',
                type: 'string',
              },
              {
                internalType: 'enum VisibilityType',
                name: 'visibility',
                type: 'uint8',
              },
              {
                internalType: 'uint256',
                name: 'id',
                type: 'uint256',
              },
              {
                internalType: 'enum SourceType',
                name: 'sourceType',
                type: 'uint8',
              },
              {
                internalType: 'int64',
                name: 'createAt',
                type: 'int64',
              },
              {
                internalType: 'address',
                name: 'paymentAddress',
                type: 'address',
              },
              {
                internalType: 'uint32',
                name: 'globalVirtualGroupFamilyId',
                type: 'uint32',
              },
              {
                internalType: 'uint64',
                name: 'chargedReadQuota',
                type: 'uint64',
              },
              {
                internalType: 'enum BucketStatus',
                name: 'bucketStatus',
                type: 'uint8',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'key',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'value',
                    type: 'string',
                  },
                ],
                internalType: 'struct Tag[]',
                name: 'tags',
                type: 'tuple[]',
              },
              {
                internalType: 'bool',
                name: 'spAsDelegatedAgentDisabled',
                type: 'bool',
              },
            ],
            internalType: 'struct BucketInfo',
            name: 'bucketInfo',
            type: 'tuple',
          },
          {
            components: [
              {
                internalType: 'bool',
                name: 'isRateLimited',
                type: 'bool',
              },
              {
                internalType: 'uint256',
                name: 'flowRateLimit',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'currentFlowRate',
                type: 'uint256',
              },
            ],
            internalType: 'struct BucketExtraInfo',
            name: 'bucketExtraInfo',
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
            name: 'bucketId',
            type: 'string',
          },
        ],
        name: 'headBucketById',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'owner',
                type: 'address',
              },
              {
                internalType: 'string',
                name: 'bucketName',
                type: 'string',
              },
              {
                internalType: 'enum VisibilityType',
                name: 'visibility',
                type: 'uint8',
              },
              {
                internalType: 'uint256',
                name: 'id',
                type: 'uint256',
              },
              {
                internalType: 'enum SourceType',
                name: 'sourceType',
                type: 'uint8',
              },
              {
                internalType: 'int64',
                name: 'createAt',
                type: 'int64',
              },
              {
                internalType: 'address',
                name: 'paymentAddress',
                type: 'address',
              },
              {
                internalType: 'uint32',
                name: 'globalVirtualGroupFamilyId',
                type: 'uint32',
              },
              {
                internalType: 'uint64',
                name: 'chargedReadQuota',
                type: 'uint64',
              },
              {
                internalType: 'enum BucketStatus',
                name: 'bucketStatus',
                type: 'uint8',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'key',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'value',
                    type: 'string',
                  },
                ],
                internalType: 'struct Tag[]',
                name: 'tags',
                type: 'tuple[]',
              },
              {
                internalType: 'bool',
                name: 'spAsDelegatedAgentDisabled',
                type: 'bool',
              },
            ],
            internalType: 'struct BucketInfo',
            name: 'bucketInfo',
            type: 'tuple',
          },
          {
            components: [
              {
                internalType: 'bool',
                name: 'isRateLimited',
                type: 'bool',
              },
              {
                internalType: 'uint256',
                name: 'flowRateLimit',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'currentFlowRate',
                type: 'uint256',
              },
            ],
            internalType: 'struct BucketExtraInfo',
            name: 'bucketExtraInfo',
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
            name: 'bucketName',
            type: 'string',
          },
        ],
        name: 'headBucketExtra',
        outputs: [
          {
            components: [
              {
                internalType: 'int64',
                name: 'priceTime',
                type: 'int64',
              },
              {
                internalType: 'uint64',
                name: 'totalChargeSize',
                type: 'uint64',
              },
              {
                components: [
                  {
                    internalType: 'uint32',
                    name: 'id',
                    type: 'uint32',
                  },
                  {
                    internalType: 'uint32',
                    name: 'globalVirtualGroupId',
                    type: 'uint32',
                  },
                  {
                    internalType: 'uint64',
                    name: 'storedSize',
                    type: 'uint64',
                  },
                  {
                    internalType: 'uint64',
                    name: 'totalChargeSize',
                    type: 'uint64',
                  },
                ],
                internalType: 'struct LocalVirtualGroup[]',
                name: 'localVirtualGroups',
                type: 'tuple[]',
              },
              {
                internalType: 'uint32',
                name: 'nextLocalVirtualGroupId',
                type: 'uint32',
              },
            ],
            internalType: 'struct InternalBucketInfo',
            name: 'extraInfo',
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
            name: 'tokenId',
            type: 'string',
          },
        ],
        name: 'headBucketNFT',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'description',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'externalUrl',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'bucketName',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'image',
                type: 'string',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'traitType',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'value',
                    type: 'string',
                  },
                ],
                internalType: 'struct Trait[]',
                name: 'attributes',
                type: 'tuple[]',
              },
            ],
            internalType: 'struct BucketMetaData',
            name: 'bucketMetaData',
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
            name: 'groupOwner',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'groupName',
            type: 'string',
          },
        ],
        name: 'headGroup',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'owner',
                type: 'address',
              },
              {
                internalType: 'string',
                name: 'groupName',
                type: 'string',
              },
              {
                internalType: 'enum SourceType',
                name: 'sourceType',
                type: 'uint8',
              },
              {
                internalType: 'uint256',
                name: 'id',
                type: 'uint256',
              },
              {
                internalType: 'string',
                name: 'extra',
                type: 'string',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'key',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'value',
                    type: 'string',
                  },
                ],
                internalType: 'struct Tag[]',
                name: 'tags',
                type: 'tuple[]',
              },
            ],
            internalType: 'struct GroupInfo',
            name: 'groupInfo',
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
            name: 'member',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'groupOwner',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'groupName',
            type: 'string',
          },
        ],
        name: 'headGroupMember',
        outputs: [
          {
            components: [
              {
                internalType: 'uint256',
                name: 'id',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'groupId',
                type: 'uint256',
              },
              {
                internalType: 'address',
                name: 'member',
                type: 'address',
              },
              {
                internalType: 'int64',
                name: 'expirationTime',
                type: 'int64',
              },
            ],
            internalType: 'struct GroupMember',
            name: 'groupMember',
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
            name: 'tokenId',
            type: 'string',
          },
        ],
        name: 'headGroupNFT',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'description',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'externalUrl',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'groupName',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'image',
                type: 'string',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'traitType',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'value',
                    type: 'string',
                  },
                ],
                internalType: 'struct Trait[]',
                name: 'attributes',
                type: 'tuple[]',
              },
            ],
            internalType: 'struct GroupMetaData',
            name: 'groupMetaData',
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
            name: 'bucketName',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'objectName',
            type: 'string',
          },
        ],
        name: 'headObject',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'owner',
                type: 'address',
              },
              {
                internalType: 'address',
                name: 'creator',
                type: 'address',
              },
              {
                internalType: 'string',
                name: 'bucketName',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'objectName',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'id',
                type: 'uint256',
              },
              {
                internalType: 'uint32',
                name: 'localVirtualGroupId',
                type: 'uint32',
              },
              {
                internalType: 'uint64',
                name: 'payloadSize',
                type: 'uint64',
              },
              {
                internalType: 'enum VisibilityType',
                name: 'visibility',
                type: 'uint8',
              },
              {
                internalType: 'string',
                name: 'contentType',
                type: 'string',
              },
              {
                internalType: 'int64',
                name: 'createAt',
                type: 'int64',
              },
              {
                internalType: 'enum ObjectStatus',
                name: 'objectStatus',
                type: 'uint8',
              },
              {
                internalType: 'enum RedundancyType',
                name: 'redundancyType',
                type: 'uint8',
              },
              {
                internalType: 'enum SourceType',
                name: 'sourceType',
                type: 'uint8',
              },
              {
                internalType: 'string[]',
                name: 'checksums',
                type: 'string[]',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'key',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'value',
                    type: 'string',
                  },
                ],
                internalType: 'struct Tag[]',
                name: 'tags',
                type: 'tuple[]',
              },
              {
                internalType: 'bool',
                name: 'isUpdating',
                type: 'bool',
              },
              {
                internalType: 'int64',
                name: 'updatedAt',
                type: 'int64',
              },
              {
                internalType: 'address',
                name: 'updatedBy',
                type: 'address',
              },
              {
                internalType: 'int64',
                name: 'version',
                type: 'int64',
              },
            ],
            internalType: 'struct ObjectInfo',
            name: 'objectInfo',
            type: 'tuple',
          },
          {
            components: [
              {
                internalType: 'uint32',
                name: 'id',
                type: 'uint32',
              },
              {
                internalType: 'uint32',
                name: 'familyId',
                type: 'uint32',
              },
              {
                internalType: 'uint32',
                name: 'primarySpId',
                type: 'uint32',
              },
              {
                internalType: 'uint32[]',
                name: 'secondarySpIds',
                type: 'uint32[]',
              },
              {
                internalType: 'uint64',
                name: 'storedSize',
                type: 'uint64',
              },
              {
                internalType: 'address',
                name: 'virtualPaymentAddress',
                type: 'address',
              },
              {
                internalType: 'string',
                name: 'totalDeposit',
                type: 'string',
              },
            ],
            internalType: 'struct GlobalVirtualGroup',
            name: 'globalVirtualGroup',
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
            name: 'objectId',
            type: 'string',
          },
        ],
        name: 'headObjectById',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'owner',
                type: 'address',
              },
              {
                internalType: 'address',
                name: 'creator',
                type: 'address',
              },
              {
                internalType: 'string',
                name: 'bucketName',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'objectName',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'id',
                type: 'uint256',
              },
              {
                internalType: 'uint32',
                name: 'localVirtualGroupId',
                type: 'uint32',
              },
              {
                internalType: 'uint64',
                name: 'payloadSize',
                type: 'uint64',
              },
              {
                internalType: 'enum VisibilityType',
                name: 'visibility',
                type: 'uint8',
              },
              {
                internalType: 'string',
                name: 'contentType',
                type: 'string',
              },
              {
                internalType: 'int64',
                name: 'createAt',
                type: 'int64',
              },
              {
                internalType: 'enum ObjectStatus',
                name: 'objectStatus',
                type: 'uint8',
              },
              {
                internalType: 'enum RedundancyType',
                name: 'redundancyType',
                type: 'uint8',
              },
              {
                internalType: 'enum SourceType',
                name: 'sourceType',
                type: 'uint8',
              },
              {
                internalType: 'string[]',
                name: 'checksums',
                type: 'string[]',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'key',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'value',
                    type: 'string',
                  },
                ],
                internalType: 'struct Tag[]',
                name: 'tags',
                type: 'tuple[]',
              },
              {
                internalType: 'bool',
                name: 'isUpdating',
                type: 'bool',
              },
              {
                internalType: 'int64',
                name: 'updatedAt',
                type: 'int64',
              },
              {
                internalType: 'address',
                name: 'updatedBy',
                type: 'address',
              },
              {
                internalType: 'int64',
                name: 'version',
                type: 'int64',
              },
            ],
            internalType: 'struct ObjectInfo',
            name: 'objectInfo',
            type: 'tuple',
          },
          {
            components: [
              {
                internalType: 'uint32',
                name: 'id',
                type: 'uint32',
              },
              {
                internalType: 'uint32',
                name: 'familyId',
                type: 'uint32',
              },
              {
                internalType: 'uint32',
                name: 'primarySpId',
                type: 'uint32',
              },
              {
                internalType: 'uint32[]',
                name: 'secondarySpIds',
                type: 'uint32[]',
              },
              {
                internalType: 'uint64',
                name: 'storedSize',
                type: 'uint64',
              },
              {
                internalType: 'address',
                name: 'virtualPaymentAddress',
                type: 'address',
              },
              {
                internalType: 'string',
                name: 'totalDeposit',
                type: 'string',
              },
            ],
            internalType: 'struct GlobalVirtualGroup',
            name: 'globalVirtualGroup',
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
            name: 'tokenId',
            type: 'string',
          },
        ],
        name: 'headObjectNFT',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'description',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'externalUrl',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'objectName',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'image',
                type: 'string',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'traitType',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'value',
                    type: 'string',
                  },
                ],
                internalType: 'struct Trait[]',
                name: 'attributes',
                type: 'tuple[]',
              },
            ],
            internalType: 'struct ObjectMetaData',
            name: 'objectMetaData',
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
            name: 'bucketName',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'objectName',
            type: 'string',
          },
        ],
        name: 'headShadowObject',
        outputs: [
          {
            components: [
              {
                internalType: 'string',
                name: 'operator',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'id',
                type: 'uint256',
              },
              {
                internalType: 'string',
                name: 'contentType',
                type: 'string',
              },
              {
                internalType: 'uint64',
                name: 'payloadSize',
                type: 'uint64',
              },
              {
                internalType: 'string[]',
                name: 'checksums',
                type: 'string[]',
              },
              {
                internalType: 'int64',
                name: 'updatedAt',
                type: 'int64',
              },
              {
                internalType: 'int64',
                name: 'version',
                type: 'int64',
              },
            ],
            internalType: 'struct ShadowObjectInfo',
            name: 'objectInfo',
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
            name: 'groupOwner',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'groupName',
            type: 'string',
          },
        ],
        name: 'leaveGroup',
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
        name: 'listBuckets',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'owner',
                type: 'address',
              },
              {
                internalType: 'string',
                name: 'bucketName',
                type: 'string',
              },
              {
                internalType: 'enum VisibilityType',
                name: 'visibility',
                type: 'uint8',
              },
              {
                internalType: 'uint256',
                name: 'id',
                type: 'uint256',
              },
              {
                internalType: 'enum SourceType',
                name: 'sourceType',
                type: 'uint8',
              },
              {
                internalType: 'int64',
                name: 'createAt',
                type: 'int64',
              },
              {
                internalType: 'address',
                name: 'paymentAddress',
                type: 'address',
              },
              {
                internalType: 'uint32',
                name: 'globalVirtualGroupFamilyId',
                type: 'uint32',
              },
              {
                internalType: 'uint64',
                name: 'chargedReadQuota',
                type: 'uint64',
              },
              {
                internalType: 'enum BucketStatus',
                name: 'bucketStatus',
                type: 'uint8',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'key',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'value',
                    type: 'string',
                  },
                ],
                internalType: 'struct Tag[]',
                name: 'tags',
                type: 'tuple[]',
              },
              {
                internalType: 'bool',
                name: 'spAsDelegatedAgentDisabled',
                type: 'bool',
              },
            ],
            internalType: 'struct BucketInfo[]',
            name: 'bucketInfos',
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
            name: 'pagination',
            type: 'tuple',
          },
          {
            internalType: 'address',
            name: 'groupOwner',
            type: 'address',
          },
        ],
        name: 'listGroups',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'owner',
                type: 'address',
              },
              {
                internalType: 'string',
                name: 'groupName',
                type: 'string',
              },
              {
                internalType: 'enum SourceType',
                name: 'sourceType',
                type: 'uint8',
              },
              {
                internalType: 'uint256',
                name: 'id',
                type: 'uint256',
              },
              {
                internalType: 'string',
                name: 'extra',
                type: 'string',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'key',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'value',
                    type: 'string',
                  },
                ],
                internalType: 'struct Tag[]',
                name: 'tags',
                type: 'tuple[]',
              },
            ],
            internalType: 'struct GroupInfo[]',
            name: 'groupInfos',
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
            name: 'pagination',
            type: 'tuple',
          },
          {
            internalType: 'string',
            name: 'bucketName',
            type: 'string',
          },
        ],
        name: 'listObjects',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'owner',
                type: 'address',
              },
              {
                internalType: 'address',
                name: 'creator',
                type: 'address',
              },
              {
                internalType: 'string',
                name: 'bucketName',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'objectName',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'id',
                type: 'uint256',
              },
              {
                internalType: 'uint32',
                name: 'localVirtualGroupId',
                type: 'uint32',
              },
              {
                internalType: 'uint64',
                name: 'payloadSize',
                type: 'uint64',
              },
              {
                internalType: 'enum VisibilityType',
                name: 'visibility',
                type: 'uint8',
              },
              {
                internalType: 'string',
                name: 'contentType',
                type: 'string',
              },
              {
                internalType: 'int64',
                name: 'createAt',
                type: 'int64',
              },
              {
                internalType: 'enum ObjectStatus',
                name: 'objectStatus',
                type: 'uint8',
              },
              {
                internalType: 'enum RedundancyType',
                name: 'redundancyType',
                type: 'uint8',
              },
              {
                internalType: 'enum SourceType',
                name: 'sourceType',
                type: 'uint8',
              },
              {
                internalType: 'string[]',
                name: 'checksums',
                type: 'string[]',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'key',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'value',
                    type: 'string',
                  },
                ],
                internalType: 'struct Tag[]',
                name: 'tags',
                type: 'tuple[]',
              },
              {
                internalType: 'bool',
                name: 'isUpdating',
                type: 'bool',
              },
              {
                internalType: 'int64',
                name: 'updatedAt',
                type: 'int64',
              },
              {
                internalType: 'address',
                name: 'updatedBy',
                type: 'address',
              },
              {
                internalType: 'int64',
                name: 'version',
                type: 'int64',
              },
            ],
            internalType: 'struct ObjectInfo[]',
            name: 'objectInfos',
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
            name: 'pagination',
            type: 'tuple',
          },
          {
            internalType: 'string',
            name: 'bucketId',
            type: 'string',
          },
        ],
        name: 'listObjectsByBucketId',
        outputs: [
          {
            components: [
              {
                internalType: 'address',
                name: 'owner',
                type: 'address',
              },
              {
                internalType: 'address',
                name: 'creator',
                type: 'address',
              },
              {
                internalType: 'string',
                name: 'bucketName',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'objectName',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'id',
                type: 'uint256',
              },
              {
                internalType: 'uint32',
                name: 'localVirtualGroupId',
                type: 'uint32',
              },
              {
                internalType: 'uint64',
                name: 'payloadSize',
                type: 'uint64',
              },
              {
                internalType: 'enum VisibilityType',
                name: 'visibility',
                type: 'uint8',
              },
              {
                internalType: 'string',
                name: 'contentType',
                type: 'string',
              },
              {
                internalType: 'int64',
                name: 'createAt',
                type: 'int64',
              },
              {
                internalType: 'enum ObjectStatus',
                name: 'objectStatus',
                type: 'uint8',
              },
              {
                internalType: 'enum RedundancyType',
                name: 'redundancyType',
                type: 'uint8',
              },
              {
                internalType: 'enum SourceType',
                name: 'sourceType',
                type: 'uint8',
              },
              {
                internalType: 'string[]',
                name: 'checksums',
                type: 'string[]',
              },
              {
                components: [
                  {
                    internalType: 'string',
                    name: 'key',
                    type: 'string',
                  },
                  {
                    internalType: 'string',
                    name: 'value',
                    type: 'string',
                  },
                ],
                internalType: 'struct Tag[]',
                name: 'tags',
                type: 'tuple[]',
              },
              {
                internalType: 'bool',
                name: 'isUpdating',
                type: 'bool',
              },
              {
                internalType: 'int64',
                name: 'updatedAt',
                type: 'int64',
              },
              {
                internalType: 'address',
                name: 'updatedBy',
                type: 'address',
              },
              {
                internalType: 'int64',
                name: 'version',
                type: 'int64',
              },
            ],
            internalType: 'struct ObjectInfo[]',
            name: 'objectInfos',
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
            name: 'bucketName',
            type: 'string',
          },
          {
            internalType: 'uint32',
            name: 'dstPrimarySpId',
            type: 'uint32',
          },
          {
            components: [
              {
                internalType: 'uint64',
                name: 'expiredHeight',
                type: 'uint64',
              },
              {
                internalType: 'uint32',
                name: 'globalVirtualGroupFamilyId',
                type: 'uint32',
              },
              {
                internalType: 'bytes',
                name: 'sig',
                type: 'bytes',
              },
            ],
            internalType: 'struct Approval',
            name: 'dstPrimarySpApproval',
            type: 'tuple',
          },
        ],
        name: 'migrateBucket',
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
                    internalType: 'uint64',
                    name: 'maxSegmentSize',
                    type: 'uint64',
                  },
                  {
                    internalType: 'uint32',
                    name: 'redundantDataChunkNum',
                    type: 'uint32',
                  },
                  {
                    internalType: 'uint32',
                    name: 'redundantParityChunkNum',
                    type: 'uint32',
                  },
                  {
                    internalType: 'uint64',
                    name: 'minChargeSize',
                    type: 'uint64',
                  },
                ],
                internalType: 'struct VersionedParams',
                name: 'versionedParams',
                type: 'tuple',
              },
              {
                internalType: 'uint64',
                name: 'maxPayloadSize',
                type: 'uint64',
              },
              {
                internalType: 'string',
                name: 'bscMirrorBucketRelayerFee',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'bscMirrorBucketAckRelayerFee',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'bscMirrorObjectRelayerFee',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'bscMirrorObjectAckRelayerFee',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'bscMirrorGroupRelayerFee',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'bscMirrorGroupAckRelayerFee',
                type: 'string',
              },
              {
                internalType: 'uint32',
                name: 'maxBucketsPerAccount',
                type: 'uint32',
              },
              {
                internalType: 'uint64',
                name: 'discontinueCountingWindow',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'discontinueObjectMax',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'discontinueBucketMax',
                type: 'uint64',
              },
              {
                internalType: 'int64',
                name: 'discontinueConfirmPeriod',
                type: 'int64',
              },
              {
                internalType: 'uint64',
                name: 'discontinueDeletionMax',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'stalePolicyCleanupMax',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'minQuotaUpdateInterval',
                type: 'uint64',
              },
              {
                internalType: 'uint32',
                name: 'maxLocalVirtualGroupNumPerBucket',
                type: 'uint32',
              },
              {
                internalType: 'string',
                name: 'opMirrorBucketRelayerFee',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'opMirrorBucketAckRelayerFee',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'opMirrorObjectRelayerFee',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'opMirrorObjectAckRelayerFee',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'opMirrorGroupRelayerFee',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'opMirrorGroupAckRelayerFee',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'polygonMirrorBucketRelayerFee',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'polygonMirrorBucketAckRelayerFee',
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
            components: [
              {
                internalType: 'int32',
                name: 'principalType',
                type: 'int32',
              },
              {
                internalType: 'string',
                name: 'value',
                type: 'string',
              },
            ],
            internalType: 'struct Principal',
            name: 'principal',
            type: 'tuple',
          },
          {
            internalType: 'string',
            name: 'resource',
            type: 'string',
          },
          {
            components: [
              {
                internalType: 'int32',
                name: 'effect',
                type: 'int32',
              },
              {
                internalType: 'int32[]',
                name: 'actions',
                type: 'int32[]',
              },
              {
                internalType: 'string[]',
                name: 'resources',
                type: 'string[]',
              },
              {
                internalType: 'int64',
                name: 'expirationTime',
                type: 'int64',
              },
              {
                internalType: 'uint64',
                name: 'limitSize',
                type: 'uint64',
              },
            ],
            internalType: 'struct Statement[]',
            name: 'statements',
            type: 'tuple[]',
          },
          {
            internalType: 'int64',
            name: 'expirationTime',
            type: 'int64',
          },
        ],
        name: 'putPolicy',
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
            name: 'groupId',
            type: 'string',
          },
          {
            internalType: 'string[]',
            name: 'members',
            type: 'string[]',
          },
        ],
        name: 'queryGroupMembersExist',
        outputs: [
          {
            internalType: 'string[]',
            name: 'checkMembers',
            type: 'string[]',
          },
          {
            internalType: 'bool[]',
            name: 'exists',
            type: 'bool[]',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'groupOwner',
            type: 'string',
          },
          {
            internalType: 'string[]',
            name: 'groupNames',
            type: 'string[]',
          },
        ],
        name: 'queryGroupsExist',
        outputs: [
          {
            internalType: 'string[]',
            name: 'checkGroupNames',
            type: 'string[]',
          },
          {
            internalType: 'bool[]',
            name: 'exists',
            type: 'bool[]',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string[]',
            name: 'groupIds',
            type: 'string[]',
          },
        ],
        name: 'queryGroupsExistById',
        outputs: [
          {
            internalType: 'string[]',
            name: 'checkGroupIds',
            type: 'string[]',
          },
          {
            internalType: 'bool[]',
            name: 'exists',
            type: 'bool[]',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'bucketName',
            type: 'string',
          },
        ],
        name: 'queryIsPriceChanged',
        outputs: [
          {
            components: [
              {
                internalType: 'bool',
                name: 'changed',
                type: 'bool',
              },
              {
                internalType: 'uint256',
                name: 'currentReadPrice',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'currentPrimaryStorePrice',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'currentSecondaryStorePrice',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'currentValidatorTaxRate',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'newReadPrice',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'newPrimaryStorePrice',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'newSecondaryStorePrice',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'newValidatorTaxRate',
                type: 'uint256',
              },
            ],
            internalType: 'struct IsPriceChanged',
            name: 'isPriceChanged',
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
            name: 'primarySpAddress',
            type: 'string',
          },
          {
            internalType: 'int64',
            name: 'createAt',
            type: 'int64',
          },
          {
            internalType: 'uint64',
            name: 'payloadSize',
            type: 'uint64',
          },
        ],
        name: 'queryLockFee',
        outputs: [
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'int64',
            name: 'timestamp',
            type: 'int64',
          },
        ],
        name: 'queryParamsByTimestamp',
        outputs: [
          {
            components: [
              {
                components: [
                  {
                    internalType: 'uint64',
                    name: 'maxSegmentSize',
                    type: 'uint64',
                  },
                  {
                    internalType: 'uint32',
                    name: 'redundantDataChunkNum',
                    type: 'uint32',
                  },
                  {
                    internalType: 'uint32',
                    name: 'redundantParityChunkNum',
                    type: 'uint32',
                  },
                  {
                    internalType: 'uint64',
                    name: 'minChargeSize',
                    type: 'uint64',
                  },
                ],
                internalType: 'struct VersionedParams',
                name: 'versionedParams',
                type: 'tuple',
              },
              {
                internalType: 'uint64',
                name: 'maxPayloadSize',
                type: 'uint64',
              },
              {
                internalType: 'string',
                name: 'bscMirrorBucketRelayerFee',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'bscMirrorBucketAckRelayerFee',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'bscMirrorObjectRelayerFee',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'bscMirrorObjectAckRelayerFee',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'bscMirrorGroupRelayerFee',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'bscMirrorGroupAckRelayerFee',
                type: 'string',
              },
              {
                internalType: 'uint32',
                name: 'maxBucketsPerAccount',
                type: 'uint32',
              },
              {
                internalType: 'uint64',
                name: 'discontinueCountingWindow',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'discontinueObjectMax',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'discontinueBucketMax',
                type: 'uint64',
              },
              {
                internalType: 'int64',
                name: 'discontinueConfirmPeriod',
                type: 'int64',
              },
              {
                internalType: 'uint64',
                name: 'discontinueDeletionMax',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'stalePolicyCleanupMax',
                type: 'uint64',
              },
              {
                internalType: 'uint64',
                name: 'minQuotaUpdateInterval',
                type: 'uint64',
              },
              {
                internalType: 'uint32',
                name: 'maxLocalVirtualGroupNumPerBucket',
                type: 'uint32',
              },
              {
                internalType: 'string',
                name: 'opMirrorBucketRelayerFee',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'opMirrorBucketAckRelayerFee',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'opMirrorObjectRelayerFee',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'opMirrorObjectAckRelayerFee',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'opMirrorGroupRelayerFee',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'opMirrorGroupAckRelayerFee',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'polygonMirrorBucketRelayerFee',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'polygonMirrorBucketAckRelayerFee',
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
            internalType: 'string',
            name: 'paymentAccount',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'bucketOwner',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'bucketName',
            type: 'string',
          },
        ],
        name: 'queryPaymentAccountBucketFlowRateLimit',
        outputs: [
          {
            internalType: 'bool',
            name: 'isSet',
            type: 'bool',
          },
          {
            internalType: 'uint256',
            name: 'flowRateLimit',
            type: 'uint256',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'policyId',
            type: 'string',
          },
        ],
        name: 'queryPolicyById',
        outputs: [
          {
            components: [
              {
                internalType: 'uint256',
                name: 'id',
                type: 'uint256',
              },
              {
                components: [
                  {
                    internalType: 'int32',
                    name: 'principalType',
                    type: 'int32',
                  },
                  {
                    internalType: 'string',
                    name: 'value',
                    type: 'string',
                  },
                ],
                internalType: 'struct Principal',
                name: 'principal',
                type: 'tuple',
              },
              {
                internalType: 'int32',
                name: 'resourceType',
                type: 'int32',
              },
              {
                internalType: 'uint256',
                name: 'resourceId',
                type: 'uint256',
              },
              {
                components: [
                  {
                    internalType: 'int32',
                    name: 'effect',
                    type: 'int32',
                  },
                  {
                    internalType: 'int32[]',
                    name: 'actions',
                    type: 'int32[]',
                  },
                  {
                    internalType: 'string[]',
                    name: 'resources',
                    type: 'string[]',
                  },
                  {
                    internalType: 'int64',
                    name: 'expirationTime',
                    type: 'int64',
                  },
                  {
                    internalType: 'uint64',
                    name: 'limitSize',
                    type: 'uint64',
                  },
                ],
                internalType: 'struct Statement[]',
                name: 'statements',
                type: 'tuple[]',
              },
              {
                internalType: 'int64',
                name: 'expirationTime',
                type: 'int64',
              },
            ],
            internalType: 'struct Policy',
            name: 'policy',
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
            name: 'resource',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'principalAddr',
            type: 'string',
          },
        ],
        name: 'queryPolicyForAccount',
        outputs: [
          {
            components: [
              {
                internalType: 'uint256',
                name: 'id',
                type: 'uint256',
              },
              {
                components: [
                  {
                    internalType: 'int32',
                    name: 'principalType',
                    type: 'int32',
                  },
                  {
                    internalType: 'string',
                    name: 'value',
                    type: 'string',
                  },
                ],
                internalType: 'struct Principal',
                name: 'principal',
                type: 'tuple',
              },
              {
                internalType: 'int32',
                name: 'resourceType',
                type: 'int32',
              },
              {
                internalType: 'uint256',
                name: 'resourceId',
                type: 'uint256',
              },
              {
                components: [
                  {
                    internalType: 'int32',
                    name: 'effect',
                    type: 'int32',
                  },
                  {
                    internalType: 'int32[]',
                    name: 'actions',
                    type: 'int32[]',
                  },
                  {
                    internalType: 'string[]',
                    name: 'resources',
                    type: 'string[]',
                  },
                  {
                    internalType: 'int64',
                    name: 'expirationTime',
                    type: 'int64',
                  },
                  {
                    internalType: 'uint64',
                    name: 'limitSize',
                    type: 'uint64',
                  },
                ],
                internalType: 'struct Statement[]',
                name: 'statements',
                type: 'tuple[]',
              },
              {
                internalType: 'int64',
                name: 'expirationTime',
                type: 'int64',
              },
            ],
            internalType: 'struct Policy',
            name: 'policy',
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
            name: 'resource',
            type: 'string',
          },
          {
            internalType: 'uint256',
            name: 'groupId',
            type: 'uint256',
          },
        ],
        name: 'queryPolicyForGroup',
        outputs: [
          {
            components: [
              {
                internalType: 'uint256',
                name: 'id',
                type: 'uint256',
              },
              {
                components: [
                  {
                    internalType: 'int32',
                    name: 'principalType',
                    type: 'int32',
                  },
                  {
                    internalType: 'string',
                    name: 'value',
                    type: 'string',
                  },
                ],
                internalType: 'struct Principal',
                name: 'principal',
                type: 'tuple',
              },
              {
                internalType: 'int32',
                name: 'resourceType',
                type: 'int32',
              },
              {
                internalType: 'uint256',
                name: 'resourceId',
                type: 'uint256',
              },
              {
                components: [
                  {
                    internalType: 'int32',
                    name: 'effect',
                    type: 'int32',
                  },
                  {
                    internalType: 'int32[]',
                    name: 'actions',
                    type: 'int32[]',
                  },
                  {
                    internalType: 'string[]',
                    name: 'resources',
                    type: 'string[]',
                  },
                  {
                    internalType: 'int64',
                    name: 'expirationTime',
                    type: 'int64',
                  },
                  {
                    internalType: 'uint64',
                    name: 'limitSize',
                    type: 'uint64',
                  },
                ],
                internalType: 'struct Statement[]',
                name: 'statements',
                type: 'tuple[]',
              },
              {
                internalType: 'int64',
                name: 'expirationTime',
                type: 'int64',
              },
            ],
            internalType: 'struct Policy',
            name: 'policy',
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
            name: 'bucketName',
            type: 'string',
          },
        ],
        name: 'queryQuotaUpdateTime',
        outputs: [
          {
            internalType: 'int64',
            name: 'updateAt',
            type: 'int64',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'string',
            name: 'bucketName',
            type: 'string',
          },
        ],
        name: 'rejectMigrateBucket',
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
            name: 'bucketName',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'objectName',
            type: 'string',
          },
        ],
        name: 'rejectSealObject',
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
            name: 'groupOwner',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'groupName',
            type: 'string',
          },
          {
            internalType: 'address[]',
            name: 'members',
            type: 'address[]',
          },
          {
            internalType: 'int64[]',
            name: 'expirationTime',
            type: 'int64[]',
          },
        ],
        name: 'renewGroupMember',
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
            name: 'bucketName',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'objectName',
            type: 'string',
          },
          {
            internalType: 'uint32',
            name: 'globalVirtualGroupId',
            type: 'uint32',
          },
          {
            internalType: 'string',
            name: 'secondarySpBlsAggSignatures',
            type: 'string',
          },
        ],
        name: 'sealObject',
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
            name: 'bucketName',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'objectName',
            type: 'string',
          },
          {
            internalType: 'uint32',
            name: 'globalVirtualGroupId',
            type: 'uint32',
          },
          {
            internalType: 'string',
            name: 'secondarySpBlsAggSignatures',
            type: 'string',
          },
          {
            internalType: 'string[]',
            name: 'expectChecksums',
            type: 'string[]',
          },
        ],
        name: 'sealObjectV2',
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
            name: 'bucketName',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'bucketOwner',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'paymentAddress',
            type: 'string',
          },
          {
            internalType: 'uint256',
            name: 'flowRateLimit',
            type: 'uint256',
          },
        ],
        name: 'setBucketFlowRateLimit',
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
            name: 'resource',
            type: 'string',
          },
          {
            components: [
              {
                internalType: 'string',
                name: 'key',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'value',
                type: 'string',
              },
            ],
            internalType: 'struct Tag[]',
            name: 'tags',
            type: 'tuple[]',
          },
        ],
        name: 'setTag',
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
            name: 'bucketName',
            type: 'string',
          },
        ],
        name: 'toggleSPAsDelegatedAgent',
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
            name: 'bucketName',
            type: 'string',
          },
          {
            internalType: 'enum VisibilityType',
            name: 'visibility',
            type: 'uint8',
          },
          {
            internalType: 'address',
            name: 'paymentAddress',
            type: 'address',
          },
          {
            internalType: 'int128',
            name: 'chargedReadQuota',
            type: 'int128',
          },
        ],
        name: 'updateBucketInfo',
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
            name: 'groupOwner',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'groupName',
            type: 'string',
          },
          {
            internalType: 'address[]',
            name: 'membersToAdd',
            type: 'address[]',
          },
          {
            internalType: 'int64[]',
            name: 'expirationTime',
            type: 'int64[]',
          },
          {
            internalType: 'address[]',
            name: 'membersToDelete',
            type: 'address[]',
          },
        ],
        name: 'updateGroup',
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
            name: 'groupOwner',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'groupName',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'extra',
            type: 'string',
          },
        ],
        name: 'updateGroupExtra',
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
            name: 'bucketName',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'objectName',
            type: 'string',
          },
          {
            internalType: 'uint64',
            name: 'payloadSize',
            type: 'uint64',
          },
          {
            internalType: 'string',
            name: 'contentType',
            type: 'string',
          },
          {
            internalType: 'string[]',
            name: 'expectChecksums',
            type: 'string[]',
          },
        ],
        name: 'updateObjectContent',
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
            name: 'bucketName',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'objectName',
            type: 'string',
          },
          {
            internalType: 'enum VisibilityType',
            name: 'visibility',
            type: 'uint8',
          },
        ],
        name: 'updateObjectInfo',
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
            name: 'bucketName',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'objectName',
            type: 'string',
          },
          {
            internalType: 'int32',
            name: 'actionType',
            type: 'int32',
          },
        ],
        name: 'verifyPermission',
        outputs: [
          {
            internalType: 'int32',
            name: 'effect',
            type: 'int32',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    bytecode: null,
  },
  {
    contractName: 'MocaStorageProvider',
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'storageProvider',
            type: 'address',
          },
        ],
        name: 'UpdateSPPrice',
        type: 'event',
      },
      {
        inputs: [
          {
            internalType: 'uint32',
            name: 'id',
            type: 'uint32',
          },
        ],
        name: 'storageProvider',
        outputs: [
          {
            components: [
              {
                internalType: 'uint32',
                name: 'id',
                type: 'uint32',
              },
              {
                internalType: 'string',
                name: 'operator_address',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'funding_address',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'seal_address',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'approval_address',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'gc_address',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'maintenance_address',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'total_deposit',
                type: 'uint256',
              },
              {
                internalType: 'enum Status',
                name: 'status',
                type: 'uint8',
              },
              {
                internalType: 'string',
                name: 'endpoint',
                type: 'string',
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
                    name: 'security_contact',
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
                internalType: 'string',
                name: 'bls_key',
                type: 'string',
              },
            ],
            internalType: 'struct StorageProvider',
            name: 'storageProvider',
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
            name: 'operatorAddress',
            type: 'address',
          },
        ],
        name: 'storageProviderByOperatorAddress',
        outputs: [
          {
            components: [
              {
                internalType: 'uint32',
                name: 'id',
                type: 'uint32',
              },
              {
                internalType: 'string',
                name: 'operator_address',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'funding_address',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'seal_address',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'approval_address',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'gc_address',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'maintenance_address',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'total_deposit',
                type: 'uint256',
              },
              {
                internalType: 'enum Status',
                name: 'status',
                type: 'uint8',
              },
              {
                internalType: 'string',
                name: 'endpoint',
                type: 'string',
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
                    name: 'security_contact',
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
                internalType: 'string',
                name: 'bls_key',
                type: 'string',
              },
            ],
            internalType: 'struct StorageProvider',
            name: 'storageProvider',
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
            name: 'operatorAddress',
            type: 'address',
          },
        ],
        name: 'storageProviderPrice',
        outputs: [
          {
            components: [
              {
                internalType: 'uint32',
                name: 'sp_id',
                type: 'uint32',
              },
              {
                internalType: 'uint256',
                name: 'update_time_sec',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'read_price',
                type: 'uint256',
              },
              {
                internalType: 'uint64',
                name: 'free_read_quota',
                type: 'uint64',
              },
              {
                internalType: 'uint256',
                name: 'store_price',
                type: 'uint256',
              },
            ],
            internalType: 'struct SpStoragePrice',
            name: 'spStoragePrice',
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
        name: 'storageProviders',
        outputs: [
          {
            components: [
              {
                internalType: 'uint32',
                name: 'id',
                type: 'uint32',
              },
              {
                internalType: 'string',
                name: 'operator_address',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'funding_address',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'seal_address',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'approval_address',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'gc_address',
                type: 'string',
              },
              {
                internalType: 'string',
                name: 'maintenance_address',
                type: 'string',
              },
              {
                internalType: 'uint256',
                name: 'total_deposit',
                type: 'uint256',
              },
              {
                internalType: 'enum Status',
                name: 'status',
                type: 'uint8',
              },
              {
                internalType: 'string',
                name: 'endpoint',
                type: 'string',
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
                    name: 'security_contact',
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
                internalType: 'string',
                name: 'bls_key',
                type: 'string',
              },
            ],
            internalType: 'struct StorageProvider[]',
            name: 'storageProviders',
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
            internalType: 'uint256',
            name: 'readPrice',
            type: 'uint256',
          },
          {
            internalType: 'uint64',
            name: 'freeReadQuota',
            type: 'uint64',
          },
          {
            internalType: 'uint256',
            name: 'storePrice',
            type: 'uint256',
          },
        ],
        name: 'updateSPPrice',
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
];

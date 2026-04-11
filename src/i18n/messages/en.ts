export const en = {
  navigation: {
    home: "Home",
    blockchain: "Blockchain",
    contracts: "Contracts",
    developerTools: "Developer Tools",
    settings: "Settings",
    cache: "Cache",
    privateKeys: "Private Keys",
    nameTags: "Name Tags",
    registry: "Registry",
    overview: "Overview",
    blocks: "Blocks",
    pendingTransactions: "Pending Transactions",
    transaction: "Transaction",
    address: "Address",
    account: "Account",
    validators: "Validators",
    proposals: "Proposals",
    rpcDebug: "RPC Debug",
    sendTx: "Send Tx",
    decode: "Decode",
    rpcRest: "RPC / REST",
    encodeDecode: "Encode / Decode",
    chain: "Chain",
    workbench: "Workbench",
    signIn: "Sign In",
  },
  search: {
    empty: "Enter a query to search.",
    unsupported: "This query type is not supported yet.",
    failed: "Search failed.",
  },
  home: {
    badge: "Explorer + Workbench",
    title: "The EVM and Cosmos Blockchain Explorer",
    description:
      "The search entry now lives in the top navigation. The home page itself stays focused on summary cards and data lists without a large hero block.",
    evmOverviewDescription:
      "Block, transaction, and address detail pages follow an explorer-style information layout.",
    cosmosOverviewDescription:
      "Accounts, validators, proposals, and block height views share the same shell and card system.",
    savedWorkspaceDescription:
      "Sign in to persist RPC profiles, drafts, favorites, and recent items.",
  },
  login: {
    chooseMethod: "Choose a sign-in method",
    chooseMethodDescription:
      "After signing in, workbench data moves from browser local storage to server-side SQLite persistence.",
    githubDescription: "Best for developers who want a fast sign-in flow with an existing GitHub account.",
    emailDescription: "Best for self-hosted environments that prefer an email-based sign-in flow.",
    workspaceStorageTitle: "Persisted Workbench Data",
  },
} as const;

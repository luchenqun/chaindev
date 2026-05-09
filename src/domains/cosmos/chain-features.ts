import { IconCloudCode } from '@tabler/icons-react';

type CosmosChainFeatureNavItemLabelKey = 'gasWaiver';

export type CosmosChainFeature = {
  key: string;
  label: string;
  exactChainIds: string[];
  partialChainIds: string[];
  items: Array<{
    href: string;
    labelKey: CosmosChainFeatureNavItemLabelKey;
    icon?: typeof IconCloudCode;
  }>;
};

const COSMOS_CHAIN_FEATURES: CosmosChainFeature[] = [
  {
    key: 'quarix',
    label: 'Quarix',
    exactChainIds: ['8888888'],
    partialChainIds: ['quarix'],
    items: [
      {
        href: '/cosmos/quarix/gaswaiver',
        labelKey: 'gasWaiver',
        icon: IconCloudCode,
      },
    ],
  },
];

function normalizeChainId(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

export function resolveCosmosChainFeature(chainId: string | null | undefined) {
  const normalizedChainId = normalizeChainId(chainId);

  if (!normalizedChainId) {
    return null;
  }

  const exactMatch =
    COSMOS_CHAIN_FEATURES.find((feature) =>
      feature.exactChainIds.some((candidate) => normalizeChainId(candidate) === normalizedChainId),
    ) ?? null;

  if (exactMatch) {
    return exactMatch;
  }

  return (
    COSMOS_CHAIN_FEATURES.find((feature) =>
      feature.partialChainIds.some((candidate) => normalizedChainId.includes(normalizeChainId(candidate))),
    ) ?? null
  );
}


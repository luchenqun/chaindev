import { MOCA_SYSTEM_ARTIFACTS } from '@/server/system/artifacts/moca-system-artifacts';
import { EVM_SYSTEM_ARTIFACTS } from '@/server/system/artifacts/evm-system-artifacts';

export const SYSTEM_CONTRACT_ARTIFACTS = [
  ...EVM_SYSTEM_ARTIFACTS,
  ...MOCA_SYSTEM_ARTIFACTS,
];

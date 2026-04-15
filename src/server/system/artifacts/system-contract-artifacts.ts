import { MOCA_SYSTEM_ARTIFACTS } from '@/server/system/artifacts/moca-system-artifacts';
import { QUARIX_SYSTEM_ARTIFACTS } from '@/server/system/artifacts/quarix-system-artifacts';

export const SYSTEM_CONTRACT_ARTIFACTS = [
  ...QUARIX_SYSTEM_ARTIFACTS,
  ...MOCA_SYSTEM_ARTIFACTS,
];

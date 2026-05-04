import { useMessages } from '@/i18n/locale-provider';

type TxSummaryProps = {
  currencyName: string;
  transaction: {
    hash: string;
    blockNumber: string | null;
    from: string;
    to: string | null;
    value: string;
    nonce: number | null;
    gas: string | null;
  };
};

export function EvmTxSummary({ transaction, currencyName }: TxSummaryProps) {
  const messages = useMessages();
  const txMessages = messages.evmTxDetail;
  const commonMessages = messages.common;

  return (
    <div className="detail-card">
      <dl className="detail-list">
        <div>
          <dt>{txMessages.hash}</dt>
          <dd className="mono">{transaction.hash}</dd>
        </div>
        <div>
          <dt>{commonMessages.block}</dt>
          <dd>{transaction.blockNumber ?? txMessages.pending}</dd>
        </div>
        <div>
          <dt>{txMessages.from}</dt>
          <dd className="mono">{transaction.from}</dd>
        </div>
        <div>
          <dt>{commonMessages.to}</dt>
          <dd className="mono">{transaction.to ?? txMessages.contractCreation}</dd>
        </div>
        <div>
          <dt>{txMessages.value}</dt>
          <dd>
            {transaction.value} {currencyName}
          </dd>
        </div>
        <div>
          <dt>{txMessages.nonce}</dt>
          <dd>{transaction.nonce ?? commonMessages.unavailable}</dd>
        </div>
        <div>
          <dt>{txMessages.gasUsed}</dt>
          <dd>{transaction.gas ?? commonMessages.unavailable}</dd>
        </div>
      </dl>
    </div>
  );
}

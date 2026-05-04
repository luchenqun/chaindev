import { useMessages } from '@/i18n/locale-provider';

type TxSummaryProps = {
  transaction: {
    hash: string;
    height: string;
    code: number;
    gasUsed: number;
    rawLog: string;
  };
};

export function CosmosTxSummary({ transaction }: TxSummaryProps) {
  const messages = useMessages();
  const txMessages = messages.cosmosTxDetail;
  const commonMessages = messages.common;

  return (
    <div className="detail-card">
      <dl className="detail-list">
        <div>
          <dt>{txMessages.transactionHash}</dt>
          <dd className="mono">{transaction.hash}</dd>
        </div>
        <div>
          <dt>{commonMessages.height}</dt>
          <dd>{transaction.height}</dd>
        </div>
        <div>
          <dt>{txMessages.code}</dt>
          <dd>{transaction.code}</dd>
        </div>
        <div>
          <dt>{txMessages.gasUsedWanted}</dt>
          <dd>{transaction.gasUsed}</dd>
        </div>
        <div>
          <dt>{txMessages.rawLog}</dt>
          <dd className="mono">{transaction.rawLog || commonMessages.noLog}</dd>
        </div>
      </dl>
    </div>
  );
}

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
  return (
    <div className="detail-card">
      <dl className="detail-list">
        <div>
          <dt>Hash</dt>
          <dd className="mono">{transaction.hash}</dd>
        </div>
        <div>
          <dt>Height</dt>
          <dd>{transaction.height}</dd>
        </div>
        <div>
          <dt>Code</dt>
          <dd>{transaction.code}</dd>
        </div>
        <div>
          <dt>Gas Used</dt>
          <dd>{transaction.gasUsed}</dd>
        </div>
        <div>
          <dt>Raw Log</dt>
          <dd className="mono">{transaction.rawLog || 'No log'}</dd>
        </div>
      </dl>
    </div>
  );
}

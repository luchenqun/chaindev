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
  return (
    <div className="detail-card">
      <dl className="detail-list">
        <div>
          <dt>Hash</dt>
          <dd className="mono">{transaction.hash}</dd>
        </div>
        <div>
          <dt>Block</dt>
          <dd>{transaction.blockNumber ?? 'Pending'}</dd>
        </div>
        <div>
          <dt>From</dt>
          <dd className="mono">{transaction.from}</dd>
        </div>
        <div>
          <dt>To</dt>
          <dd className="mono">{transaction.to ?? 'Contract Creation'}</dd>
        </div>
        <div>
          <dt>Value</dt>
          <dd>
            {transaction.value} {currencyName}
          </dd>
        </div>
        <div>
          <dt>Nonce</dt>
          <dd>{transaction.nonce ?? 'N/A'}</dd>
        </div>
        <div>
          <dt>Gas</dt>
          <dd>{transaction.gas ?? 'N/A'}</dd>
        </div>
      </dl>
    </div>
  );
}

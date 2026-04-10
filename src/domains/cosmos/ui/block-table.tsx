import Link from "next/link";

type BlockTableProps = {
  blocks: Array<{
    height: string;
    hash: string;
  }>;
  hrefPrefix: string;
};

export function CosmosBlockTable({ blocks, hrefPrefix }: BlockTableProps) {
  return (
    <div className="table-card">
      <table className="table-shell">
        <thead>
          <tr>
            <th>Height</th>
            <th>Hash</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((block) => (
            <tr key={block.height}>
              <td>
                <Link href={`${hrefPrefix}/${block.height}`}>#{block.height}</Link>
              </td>
              <td className="mono">{block.hash}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

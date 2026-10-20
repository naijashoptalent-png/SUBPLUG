import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { ServiceIcon, serviceLabel } from '@/components/ui/ServiceIcon';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/States';
import { formatNaira, formatRelative } from '@/lib/format';
import type { Transaction } from '@/types';

function recipientLabel(transaction: Transaction) {
  const { recipient } = transaction;
  if (transaction.service === 'AIRTIME' || transaction.service === 'DATA') {
    return recipient.phone ?? '—';
  }
  if (transaction.service === 'ELECTRICITY') {
    return recipient.meterNumber ? `Meter ${recipient.meterNumber}` : '—';
  }
  return recipient.smartcardNumber ? `Smartcard ${recipient.smartcardNumber}` : '—';
}

export function TransactionTable({
  transactions,
  linkBase = '/dashboard/transactions',
  showUser = false,
  emptyTitle = 'No transactions yet',
  emptyDescription = 'Purchases will appear here as soon as you make one.',
}: {
  transactions: Transaction[];
  linkBase?: string;
  showUser?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (transactions.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="table-wrap">
      <table className="table-base">
        <thead>
          <tr>
            <th scope="col">Transaction</th>
            <th scope="col">Recipient</th>
            {showUser ? <th scope="col">User</th> : null}
            <th scope="col">Amount</th>
            <th scope="col">Status</th>
            <th scope="col">Date</th>
            <th scope="col">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.reference} className="group">
              <td>
                <div className="flex items-center gap-3">
                  <ServiceIcon service={transaction.service} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{serviceLabel(transaction.service)}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-subtle">{transaction.reference}</p>
                  </div>
                </div>
              </td>
              <td>
                <p className="text-xs font-medium text-ink">{recipientLabel(transaction)}</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {transaction.plan?.name ?? transaction.recipient.network ?? transaction.recipient.disco ?? '—'}
                </p>
              </td>
              {showUser ? (
                <td>
                  <span className="font-mono text-[10px] text-subtle">{transaction.userId ?? '—'}</span>
                </td>
              ) : null}
              <td>
                <p className="text-sm font-semibold text-ink">{formatNaira(transaction.payableMinor)}</p>
                {transaction.feeMinor > 0 ? (
                  <p className="text-[10px] text-subtle">incl. {formatNaira(transaction.feeMinor)} fee</p>
                ) : null}
              </td>
              <td>
                <StatusBadge status={transaction.status} />
              </td>
              <td>
                <p className="whitespace-nowrap text-xs text-muted">{formatRelative(transaction.createdAt)}</p>
              </td>
              <td className="text-right">
                <Link
                  to={`${linkBase}/${transaction.reference}`}
                  className="inline-grid h-8 w-8 place-items-center rounded-lg text-subtle transition hover:bg-surface hover:text-ink"
                  aria-label={`Open transaction ${transaction.reference}`}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

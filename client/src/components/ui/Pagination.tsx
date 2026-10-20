import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import type { Pagination as PaginationMeta } from '@/types';

export function Pagination({
  pagination,
  onPageChange,
  className,
}: {
  pagination: PaginationMeta | undefined;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (!pagination || pagination.total === 0) return null;

  const start = (pagination.page - 1) * pagination.limit + 1;
  const end = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 ${className ?? ''}`}>
      <p className="text-xs text-muted">
        Showing <span className="font-medium text-ink">{start}</span>–<span className="font-medium text-ink">{end}</span> of{' '}
        <span className="font-medium text-ink">{pagination.total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(pagination.page - 1)}
          disabled={!pagination.hasPrev}
          leftIcon={<ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />}
          aria-label="Previous page"
        >
          Previous
        </Button>
        <span className="min-w-[76px] text-center text-xs font-medium text-muted" aria-live="polite">
          Page {pagination.page} of {pagination.pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={!pagination.hasNext}
          rightIcon={<ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
          aria-label="Next page"
        >
          Next
        </Button>
      </div>
    </div>
  );
}

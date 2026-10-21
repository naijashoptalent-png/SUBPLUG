import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ChevronRight, RotateCcw, Search, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { Avatar } from '@/components/ui/Avatar';
import { useAdminUsers } from '@/hooks/useAdmin';
import { formatDate, formatRelative } from '@/lib/format';

const roleTone = {
  ADMIN: 'brand',
  SUPPORT: 'info',
  CUSTOMER: 'neutral',
} as const;

export function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const usersQuery = useAdminUsers({
    page,
    limit: 20,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
  });

  const reset = () => {
    setPage(1);
    setSearch('');
    setRole('');
    setStatus('');
  };

  return (
    <>
      <Helmet>
        <title>Users — SubPlug operations</title>
      </Helmet>

      <PageHeader
        eyebrow="Operations"
        title="Users"
        description="Find customers and staff, review account status, and open a user's wallet and transaction detail."
      />

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-line p-4 sm:p-5">
          <div className="grid gap-2 md:grid-cols-[1.5fr_0.7fr_0.7fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search users"
                placeholder="Search name, email, phone, or referral code"
                className="field py-2.5 pl-10 text-sm"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <select
              className="field py-2.5 text-sm"
              aria-label="Filter by role"
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All roles</option>
              <option value="CUSTOMER">Customers</option>
              <option value="SUPPORT">Support</option>
              <option value="ADMIN">Admins</option>
            </select>
            <select
              className="field py-2.5 text-sm"
              aria-label="Filter by status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="CLOSED">Closed</option>
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={!search && !role && !status}
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
              className="h-[42px]"
            >
              Reset
            </Button>
          </div>
        </div>

        {usersQuery.isLoading && !usersQuery.data ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : usersQuery.isError ? (
          <ErrorState title="Users could not load" onRetry={() => void usersQuery.refetch()} />
        ) : usersQuery.data?.users.length ? (
          <>
            <div className="table-wrap">
              <table className="table-base">
                <thead>
                  <tr>
                    <th scope="col">User</th>
                    <th scope="col">Role</th>
                    <th scope="col">Status</th>
                    <th scope="col">Email</th>
                    <th scope="col">Joined</th>
                    <th scope="col">Last login</th>
                    <th scope="col"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {usersQuery.data.users.map((user) => (
                    <tr key={user._id}>
                      <td>
                        <Link to={`/admin/users/${user._id}`} className="flex items-center gap-3">
                          <Avatar name={user.fullName} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-ink">{user.fullName}</p>
                            <p className="truncate text-[11px] text-muted">{user.phone}</p>
                          </div>
                        </Link>
                      </td>
                      <td><Badge tone={roleTone[user.role]}>{user.role}</Badge></td>
                      <td><Badge tone={user.status === 'ACTIVE' ? 'success' : user.status === 'SUSPENDED' ? 'danger' : 'neutral'}>{user.status}</Badge></td>
                      <td>
                        <p className="max-w-[220px] truncate text-xs text-ink">{user.email}</p>
                        <p className="mt-0.5 text-[10px] text-subtle">Account email</p>
                      </td>
                      <td className="whitespace-nowrap text-xs text-muted">{formatDate(user.createdAt)}</td>
                      <td className="whitespace-nowrap text-xs text-muted">
                        {user.lastLoginAt ? formatRelative(user.lastLoginAt) : 'Never'}
                      </td>
                      <td className="text-right">
                        <Link
                          to={`/admin/users/${user._id}`}
                          className="inline-grid h-8 w-8 place-items-center rounded-lg text-subtle transition hover:bg-surface hover:text-ink"
                          aria-label={`Open ${user.fullName}`}
                        >
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={usersQuery.data.pagination} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            icon={Users}
            title="No users match"
            description="Try a different search, role, or status."
          />
        )}
      </Card>

      <p className="mt-4 text-[11px] text-subtle">
        Customer detail is read-only for support staff. Only administrators can suspend accounts or adjust wallets.
      </p>
    </>
  );
}

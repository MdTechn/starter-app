export type SortOrder = 'asc' | 'desc';

export interface PaginationQueryDto {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export interface UserListQueryDto extends PaginationQueryDto {
  /** Free-text search on email / name / firstName / lastName */
  q?: string;
  status?: 'ACTIVE' | 'DISABLED' | 'DELETED';
  role?: 'USER' | 'ADMIN';
  provider?: string;
  /** When true, include DELETED users (admin only). Default: exclude DELETED. */
  includeDeleted?: boolean;
}

export function normalizePagination(query: PaginationQueryDto = {}): {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  sortOrder: SortOrder;
} {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
  const sortOrder: SortOrder =
    query.sortOrder === 'asc' || query.sortOrder === 'desc'
      ? query.sortOrder
      : 'desc';

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
    sortOrder,
  };
}

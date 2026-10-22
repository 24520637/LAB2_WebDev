
/** Provisional page size. Confirm before final acceptance. */
export const PAGE_SIZE = 10;

export type PageResult<T> = {
  rows: T[];
  page: number;
  totalPages: number;
  totalRecords: number;
  startRecord: number;
  endRecord: number;
};

/** Paginate already-filtered rows without mutating input. */
export function paginateRows<T>(
  records: readonly T[],
  requestedPage: number,
  pageSize: number = PAGE_SIZE
): PageResult<T> {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new RangeError('pageSize must be a positive safe integer');
  }

  const totalRecords = records.length;
  const totalPages = Math.ceil(totalRecords / pageSize);

  if (totalRecords === 0) {
    return {
      rows: [],
      page: 0,
      totalPages: 0,
      totalRecords: 0,
      startRecord: 0,
      endRecord: 0,
    };
  }

  const safeRequestedPage = Number.isSafeInteger(requestedPage)
    ? requestedPage
    : 1;

  const page = Math.min(
    Math.max(safeRequestedPage, 1),
    totalPages
  );

  const start = (page - 1) * pageSize;
  const rows = records.slice(start, start + pageSize);

  return {
    rows,
    page,
    totalPages,
    totalRecords,
    startRecord: start + 1,
    endRecord: start + rows.length,
  };
}

/** PostgREST's default `db-max-rows`. A single response never exceeds this. */
export const POSTGREST_MAX_ROWS = 1000;

export type PageResult<T> = { data: T[] | null; error: { message: string } | null };
export type PageFetcher<T> = (from: number, to: number) => PromiseLike<PageResult<T>>;

/**
 * Read every row a query matches, a page at a time.
 *
 * PostgREST caps a single response at `db-max-rows`, so `.limit(5000)` silently
 * returns the first 1000 rows and the caller cannot distinguish a truncated page
 * from a complete result. That is how KPI totals and exports end up quietly
 * wrong. Pages with `.range()` until a short page arrives or `max` is reached.
 */
export async function fetchAllRows<T>(
  page: PageFetcher<T>,
  options: { max?: number; pageSize?: number } = {}
): Promise<T[]> {
  const pageSize = Math.max(1, Math.min(options.pageSize ?? POSTGREST_MAX_ROWS, POSTGREST_MAX_ROWS));
  const max = options.max ?? Number.POSITIVE_INFINITY;
  const rows: T[] = [];

  for (let from = 0; from < max; from += pageSize) {
    const to = Math.min(from + pageSize, max) - 1;
    const { data, error } = await page(from, to);
    if (error || !data) break;
    rows.push(...data);
    if (data.length < to - from + 1) break;
  }

  return rows;
}

/**
 * True when a single capped read may have hit its ceiling, so the UI can warn
 * instead of presenting a truncated list as the whole picture.
 */
export function isLikelyTruncated(received: number, requested: number) {
  return received >= Math.min(requested, POSTGREST_MAX_ROWS);
}

"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T extends { id: string }> {
  data: T[];
  columns: Column<T>[];
  searchKeys?: (keyof T)[];
  searchPlaceholder?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  searchKeys = [],
  searchPlaceholder = "Search…",
  pageSize = 20,
  onRowClick,
  emptyMessage = "No records found.",
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = useMemo(() => {
    let rows = data;
    if (search.trim() && searchKeys.length) {
      const q = search.toLowerCase();
      rows = rows.filter((row) =>
        searchKeys.some((k) => String(row[k] ?? "").toLowerCase().includes(q))
      );
    }
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = String((a as Record<string, unknown>)[sortKey] ?? "");
        const bv = String((b as Record<string, unknown>)[sortKey] ?? "");
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return rows;
  }, [data, search, searchKeys, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);

  function toggleSort(key: string) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  return (
    <div className="space-y-3">
      {searchKeys.length > 0 && (
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder={searchPlaceholder}
          className="max-w-sm"
        />
      )}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className="cursor-pointer px-4 py-3 text-left font-medium"
                  onClick={() => toggleSort(String(col.key))}
                >
                  {col.header}
                  {sortKey === String(col.key) && (sortAsc ? " ↑" : " ↓")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-border last:border-0 ${onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3">
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[String(col.key)] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {filtered.length} records · page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded border border-border px-3 py-1 disabled:opacity-50"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="rounded border border-border px-3 py-1 disabled:opacity-50"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

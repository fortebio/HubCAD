import { cx } from '@/lib/cx';

/**
 * Loading placeholders that occupy the same space as the real content,
 * so nothing jumps when data arrives.
 */
export function Skeleton({ className = '', style }) {
  return <div className={cx('skeleton', className)} style={style} aria-hidden="true" />;
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={cx('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-3"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}

/** Matches the StatCard footprint (icon tile + value + two label lines). */
export function SkeletonStatCard() {
  return (
    <div className="card flex items-center gap-3" aria-hidden="true">
      <div className="skeleton w-11 h-11 rounded-card shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="skeleton h-5 w-14" />
        <div className="skeleton h-3 w-24 mt-2" />
        <div className="skeleton h-2.5 w-20 mt-1.5" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-3 py-2.5 border-b border-gray-200 last:border-b-0"
        >
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="skeleton h-3"
              style={{ flex: c === 1 ? 3 : 1 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Wraps async content: shows `fallback` while loading, keeps the region
 * marked busy for screen readers, and never collapses to zero height.
 */
export function Loadable({ loading, fallback, children }) {
  return (
    <div aria-busy={loading || undefined}>{loading ? fallback : children}</div>
  );
}

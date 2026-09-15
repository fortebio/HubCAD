export const t = (en, vn) => ({ en, vn });

export function BilingualLabel({ en, vn, className = '' }) {
  return (
    <div className={`leading-tight ${className}`}>
      <div>{en}</div>
      {vn && <div className="text-[11px] text-gray-500">{vn}</div>}
    </div>
  );
}

export function Empty({ icon, title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="text-gray-300 mb-3">{icon}</div>}
      {title && <div className="text-[14px] font-medium text-gray-700">{title}</div>}
      {hint && <div className="text-xs text-gray-500 mt-1 max-w-sm">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

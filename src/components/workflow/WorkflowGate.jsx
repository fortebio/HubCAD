import { Link } from 'react-router-dom';
import { IconCircleCheck, IconCircleX, IconArrowRight } from '@tabler/icons-react';

const STATUS_LABELS = {
  draft: 'Draft / Bản nháp',
  in_review: 'In review / Đang duyệt',
  approved: 'Approved / Đã duyệt',
  released: 'Released / Phát hành',
  obsolete: 'Obsolete / Ngừng dùng',
};

/** Shows the server workflow decision before an operator submits a transition. */
export function WorkflowGate({ transition, compact = false }) {
  if (!transition) return null;
  const failed = transition.requirements.filter((requirement) => !requirement.passed);
  return (
    <div className={`rounded-lg border p-3 ${transition.ready ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
        {transition.ready ? <IconCircleCheck size={16} className="text-emerald-600" aria-hidden="true" /> : <IconCircleX size={16} className="text-amber-600" aria-hidden="true" />}
        {transition.ready ? `Ready to move to ${STATUS_LABELS[transition.to] || transition.to}` : `Blocked before ${STATUS_LABELS[transition.to] || transition.to}`}
      </div>
      {!transition.ready && (
        <ul className="mt-2 space-y-1 text-[12px] text-gray-700">
          {failed.map((requirement) => (
            <li key={requirement.key} className="flex items-start gap-1.5">
              <IconCircleX size={13} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
              <span className="flex-1">{requirement.label} — {requirement.detail}</span>
              {requirement.href && !compact && <Link className="inline-flex shrink-0 items-center gap-0.5 text-primary-600 hover:text-primary-700" to={requirement.href}>Open <IconArrowRight size={13} aria-hidden="true" /></Link>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

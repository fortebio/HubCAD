import { useCallback, useEffect, useState } from 'react';
import {
  IconPlayerPlay,
  IconLoader2,
  IconCircleCheck,
  IconAlertTriangle,
  IconLock,
  IconChevronDown,
  IconChevronRight,
  IconTerminal2,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/Button';
import { api, apiPaths } from '@/lib/api';
import { toast } from '@/stores/useToastStore';
import { cx } from '@/lib/cx';

/**
 * Run the script and show what it wrote.
 *
 * A rebuild executes code on the workstation, so the button only appears once
 * the folder carries an explicit `.hubcad.json` opt-in; until then the panel
 * says so and a manager can turn it on from here.
 */
export function RebuildPanel({ script, canEdit, isManager, onFinished }) {
  const [status, setStatus] = useState(null); // { isModelScript, allowed, optIn }
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [logOpen, setLogOpen] = useState(false);
  const [withCheck, setWithCheck] = useState(true);

  const refresh = useCallback(async () => {
    if (!script) return setStatus(null);
    try {
      setStatus(await api.get(apiPaths.cadRebuildStatus(script)));
    } catch {
      setStatus(null);
    }
  }, [script]);

  useEffect(() => {
    setResult(null);
    refresh();
  }, [script, refresh]);

  if (!script || !status?.isModelScript) return null;

  async function enable() {
    try {
      await api.post(apiPaths.cadAllowRebuild, { script });
      toast.success('Rebuild enabled for this folder', 'Đã bật dựng lại — ghi vào .hubcad.json');
      refresh();
    } catch (e) {
      toast.error('Could not enable rebuild', e.message);
    }
  }

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      const res = await api.post(apiPaths.cadRebuild, {
        script,
        args: withCheck ? ['--check'] : [],
      });
      setResult(res);
      const changed = res.outputs.filter((o) => o.changed).length;
      if (res.exitCode === 0) {
        toast.success(
          `Rebuilt in ${(res.durationMs / 1000).toFixed(1)}s`,
          `${changed} file đã được ghi lại`
        );
        onFinished?.(res);
      } else {
        toast.error(`Script exited with code ${res.exitCode}`, 'Xem log bên dưới');
        setLogOpen(true);
      }
      if (res.conflicts.length) {
        toast.warning(
          `${res.conflicts.length} Drive conflict cop${res.conflicts.length > 1 ? 'ies' : 'y'}`,
          'Google Drive tạo bản sao xung đột trong lúc dựng'
        );
      }
    } catch (e) {
      toast.error('Rebuild failed', e.message);
      setLogOpen(true);
      setResult({ error: e.message });
    } finally {
      setRunning(false);
    }
  }

  const changed = result?.outputs?.filter((o) => o.changed) || [];

  return (
    <div className="border-t border-gray-200 px-2 py-2">
      {!status.allowed ? (
        <div className="flex items-start gap-2 text-[11px]">
          <IconLock size={13} className="text-gray-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-gray-600">
              Rebuild is off for this folder / Thư mục này chưa bật dựng lại
            </p>
            {isManager ? (
              <button
                type="button"
                onClick={enable}
                className="mt-1 text-[11px] text-primary-600 hover:underline"
              >
                Enable it ({status.optInFile}) / Bật
              </button>
            ) : (
              <p className="text-gray-500 mt-0.5">
                Cần quản lý bật, hoặc thêm {status.optInFile} với {'{"allowRebuild": true}'}
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={run} loading={running} disabled={running || !canEdit}>
              <IconPlayerPlay size={13} />
              Rebuild / Dựng lại
            </Button>
            <label className="flex items-center gap-1 text-[11px] text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={withCheck}
                onChange={(e) => setWithCheck(e.target.checked)}
                className="w-3 h-3"
                disabled={running}
              />
              --check
            </label>
            {running && (
              <span className="flex items-center gap-1 text-[11px] text-gray-500 ml-auto">
                <IconLoader2 size={12} className="animate-spin" aria-hidden="true" />
                ~8s
              </span>
            )}
            {result && !running && !result.error && (
              <span
                className={cx(
                  'flex items-center gap-1 text-[11px] ml-auto',
                  result.exitCode === 0 ? 'text-emerald-700' : 'text-red-700'
                )}
              >
                {result.exitCode === 0 ? (
                  <IconCircleCheck size={12} aria-hidden="true" />
                ) : (
                  <IconAlertTriangle size={12} aria-hidden="true" />
                )}
                exit {result.exitCode} · {(result.durationMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>

          {changed.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {changed.map((o) => (
                <li key={o.rel} className="flex items-center gap-1.5 text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
                  <span className="font-mono text-gray-700 truncate flex-1" title={o.rel}>
                    {o.rel.split('/').pop()}
                  </span>
                  <span className="text-gray-500 shrink-0">{(o.size / 1024).toFixed(0)} KB</span>
                </li>
              ))}
            </ul>
          )}

          {result?.conflicts?.length > 0 && (
            <p className="mt-1 text-[10px] text-amber-700">
              Drive tạo {result.conflicts.length} bản sao xung đột: {result.conflicts.join(', ')}
            </p>
          )}

          {(result?.stdout || result?.stderr || result?.error) && (
            <div className="mt-1.5">
              <button
                type="button"
                onClick={() => setLogOpen((v) => !v)}
                aria-expanded={logOpen}
                className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-900"
              >
                {logOpen ? (
                  <IconChevronDown size={11} aria-hidden="true" />
                ) : (
                  <IconChevronRight size={11} aria-hidden="true" />
                )}
                <IconTerminal2 size={11} aria-hidden="true" />
                Log
              </button>
              {logOpen && (
                <pre className="mt-1 max-h-40 overflow-auto text-[10px] font-mono leading-[1.5] bg-gray-900 text-gray-100 rounded p-2 whitespace-pre-wrap">
                  {result.error || ''}
                  {result.stdout || ''}
                  {result.stderr ? `\n[stderr]\n${result.stderr}` : ''}
                </pre>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

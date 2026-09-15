import { useEffect, useState } from 'react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Table, THead, TR, TH, TD } from '@/components/ui/Table';
import { Empty } from '@/components/ui/Empty';
import { api, apiPaths } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { useHasRole } from '@/lib/roles';
import { IconUsers, IconUserCheck, IconUserOff, IconLock } from '@tabler/icons-react';
import { cx } from '@/lib/cx';
import { toast } from '@/stores/useToastStore';
import { confirmDialog } from '@/components/ui/ConfirmDialog';

const ROLES = ['designer', 'reviewer', 'manager'];
const ROLE_TONE = {
  designer: 'bg-gray-100 text-gray-700',
  reviewer: 'bg-blue-100 text-blue-800',
  manager: 'bg-violet-100 text-violet-800',
};

export function UserManagement() {
  const canManage = useHasRole('manager');
  const me = useAuthStore((s) => s.user);
  const [users, setUsers] = useState([]);
  const [editOpen, setEditOpen] = useState(null);
  const [edit, setEdit] = useState({ role: 'designer', fullName: '', active: 1, password: '' });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!canManage) return;
    refresh();
  }, [canManage]);

  async function refresh() {
    try {
      const res = await api.get(apiPaths.users);
      setUsers(res.users);
    } catch (e) {
      setError(e.message);
    }
  }

  function openEdit(u) {
    setEditOpen(u);
    setEdit({ role: u.role, fullName: u.fullName, active: u.active, password: '' });
    setError(null);
  }

  async function onSave() {
    try {
      setError(null);
      const payload = {
        role: edit.role,
        fullName: edit.fullName,
        active: !!edit.active,
      };
      if (edit.password) payload.password = edit.password;
      await api.patch(apiPaths.user(editOpen.id), payload);
      setEditOpen(null);
      refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  async function onDeactivate(u) {
    const ok = await confirmDialog({
      title: 'Deactivate user / Vô hiệu hóa người dùng',
      message: `${u.username} will no longer be able to sign in.`,
      detail: `${u.username} sẽ không thể đăng nhập nữa.`,
      confirmLabel: 'Deactivate / Vô hiệu hóa',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.del(apiPaths.user(u.id));
      refresh();
    } catch (e) {
      toast.error('Action failed / Thao tác thất bại', e.message);
    }
  }

  if (!canManage) {
    return (
      <PageWrapper title="User Management" subtitle="Quản lý người dùng" breadcrumb="System / Hệ thống">
        <Card>
          <Empty icon={<IconLock size={40} />} title="Manager only" hint="Chỉ tài khoản manager mới truy cập được trang này." />
        </Card>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="User Management" subtitle="Quản lý người dùng" breadcrumb="System / Hệ thống">
      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Username</TH>
              <TH>Full name</TH>
              <TH>Role</TH>
              <TH>Status</TH>
              <TH>Joined</TH>
              <TH></TH>
            </TR>
          </THead>
          <tbody>
            {users.map((u) => (
              <TR key={u.id}>
                <TD mono>{u.username}{u.id === me?.id && <span className="ml-2 text-[10px] text-primary-500">(you)</span>}</TD>
                <TD>{u.fullName}</TD>
                <TD>
                  <span className={cx('badge', ROLE_TONE[u.role])}>{u.role}</span>
                </TD>
                <TD>
                  {u.active ? (
                    <span className="badge bg-emerald-100 text-emerald-800">
                      <IconUserCheck size={10} /> active
                    </span>
                  ) : (
                    <span className="badge bg-gray-100 text-gray-600">
                      <IconUserOff size={10} /> inactive
                    </span>
                  )}
                </TD>
                <TD className="text-xs text-gray-500">
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                </TD>
                <TD>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                      Edit
                    </Button>
                    {u.active && u.id !== me?.id && (
                      <Button variant="danger" size="sm" onClick={() => onDeactivate(u)}>
                        Deactivate
                      </Button>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-gray-400">
                  No users
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      <Modal
        open={!!editOpen}
        onClose={() => setEditOpen(null)}
        title={`Edit user: ${editOpen?.username || ''}`}
        subtitle="Chỉnh sửa người dùng"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={onSave}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Full name</label>
            <input className="input mt-1" value={edit.fullName} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input mt-1" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked ? 1 : 0 })} />
              <span className="text-[13px]">Active / Đang hoạt động</span>
            </label>
          </div>
          <div>
            <label className="label">Reset password (optional)</label>
            <input
              type="password"
              className="input mt-1"
              value={edit.password}
              onChange={(e) => setEdit({ ...edit, password: e.target.value })}
              placeholder="Leave blank to keep current"
            />
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
        </div>
      </Modal>
    </PageWrapper>
  );
}

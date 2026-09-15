import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { api, apiPaths } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const ROLES = [
  { value: 'designer', label: 'Designer / Thiết kế' },
  { value: 'reviewer', label: 'Reviewer / Kiểm tra' },
  { value: 'manager', label: 'Manager / Quản lý' },
];

export function Register() {
  const [form, setForm] = useState({ username: '', password: '', fullName: '', role: 'designer' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const setToken = useAuthStore((s) => s.setSession);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/auth/register', form);
      localStorage.setItem('auth_token', res.token);
      localStorage.setItem('auth_user', JSON.stringify(res.user));
      // hard reload so zustand picks up the new token from localStorage
      window.location.href = '/';
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-primary-500 text-white font-bold flex items-center justify-center">DT</div>
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900">Drawing Tool</h2>
            <div className="text-xs text-gray-500">Create account / Tạo tài khoản</div>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="label">Full name / Họ tên</label>
            <input
              className="input mt-1"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Username / Tên đăng nhập</label>
            <input
              className="input mt-1"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              minLength={3}
            />
          </div>
          <div>
            <label className="label">Password / Mật khẩu</label>
            <input
              type="password"
              className="input mt-1"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={4}
            />
          </div>
          <div>
            <label className="label">Role / Vai trò</label>
            <select className="input mt-1" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Creating...' : 'Create account / Tạo'}
          </Button>
          <div className="text-[11px] text-gray-500 text-center pt-2">
            Have an account?{' '}
            <Link to="/login" className="text-primary-500 hover:underline">
              Sign in / Đăng nhập
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}

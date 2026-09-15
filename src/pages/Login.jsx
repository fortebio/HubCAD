import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export function Login() {
  const [username, setUsername] = useState('designer');
  const [password, setPassword] = useState('designer');
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const nav = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    try {
      await login(username, password);
      nav('/');
    } catch (_) {
      // error in store
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
            <div className="text-xs text-gray-500">Sign in / Đăng nhập</div>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="label">Username / Tên đăng nhập</label>
            <input className="input mt-1" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="label">Password / Mật khẩu</label>
            <input type="password" className="input mt-1" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Signing in...' : 'Sign in / Đăng nhập'}
          </Button>
          <div className="text-[11px] text-gray-500 text-center pt-2">
            No account?{' '}
            <Link to="/register" className="text-primary-500 hover:underline">
              Register / Tạo tài khoản
            </Link>
          </div>
          <div className="text-[11px] text-gray-400 text-center">
            Demo: designer/designer, reviewer/reviewer, manager/manager
          </div>
        </form>
      </Card>
    </div>
  );
}

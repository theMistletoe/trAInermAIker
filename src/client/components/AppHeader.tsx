import { MESSAGES } from '@shared/messages';
import { MenuIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { signOut, useSession } from '@/lib/authClient';

export function AppHeader() {
  const { data: session, isPending } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleLogout = async () => {
    try {
      const { error } = await signOut();
      if (error) throw new Error(error.message ?? 'sign-out failed');
      setOpen(false);
      navigate('/');
    } catch {
      toast.error(MESSAGES.auth.logoutFailed);
    }
  };

  return (
    <header className="sticky top-0 z-10 mb-8 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link to="/" data-testid="brand-home" className="font-semibold tracking-tight">
          trAInermAIker
        </Link>
        <div ref={menuRef} className="relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-testid="nav-menu"
            aria-label="メニュー"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <MenuIcon />
          </Button>
          {open && (
            <nav
              data-testid="nav-menu-panel"
              className="absolute right-0 mt-2 w-48 rounded-lg border bg-popover p-2 text-popover-foreground shadow-md"
            >
              {isPending ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">読み込み中…</p>
              ) : session ? (
                <ul className="flex flex-col">
                  <li>
                    <button
                      type="button"
                      data-testid="nav-logout"
                      className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={handleLogout}
                    >
                      ログアウト
                    </button>
                  </li>
                </ul>
              ) : (
                <ul className="flex flex-col">
                  <li>
                    <Link
                      to="/login"
                      data-testid="nav-login"
                      className="block rounded-md px-3 py-2 text-sm hover:bg-accent"
                      onClick={() => setOpen(false)}
                    >
                      ログイン
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/signup"
                      data-testid="nav-signup"
                      className="block rounded-md px-3 py-2 text-sm hover:bg-accent"
                      onClick={() => setOpen(false)}
                    >
                      サインアップ
                    </Link>
                  </li>
                </ul>
              )}
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}

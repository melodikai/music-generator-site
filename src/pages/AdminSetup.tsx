import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { grantAdmin } from '@/lib/api';

const field =
  'w-full rounded-xl border border-border bg-secondary px-3.5 py-2.5 text-[0.95em] outline-none focus:border-ring';

const AdminSetup = () => {
  const [email, setEmail] = useState('');
  const [key, setKey] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await grantAdmin(email.trim().toLowerCase(), key.trim());
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось выдать права');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background p-2.5">
      <div className="mx-auto max-w-md rounded-[14px] bg-stage px-5 py-8 lg:py-12">
        <Link
          to="/"
          className="flex items-center gap-2 text-[0.9em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <Icon name="ArrowLeft" size={16} />
          В студию
        </Link>

        <h1 className="mt-7 font-display text-3xl font-light tracking-[-0.02em] text-foreground">
          Доступ администратора
        </h1>
        <p className="mt-3 text-[0.9em] leading-relaxed text-muted-foreground">
          Укажите почту уже зарегистрированного аккаунта и секретный ключ владельца. Аккаунт получит
          безлимитный доступ ко всем возможностям.
        </p>

        {done ? (
          <div className="mt-7 rounded-2xl border border-border bg-secondary p-4">
            <p className="flex items-center gap-2 text-[0.95em] text-foreground">
              <Icon name="ShieldCheck" size={16} />
              Права выданы
            </p>
            <p className="mt-2 text-[0.88em] text-muted-foreground">
              Войдите в аккаунт заново, чтобы ограничения исчезли.
            </p>
          </div>
        ) : (
          <div className="mt-7 space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-[0.78em] uppercase tracking-[0.14em] text-muted-foreground">
                Почта аккаунта
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={field}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[0.78em] uppercase tracking-[0.14em] text-muted-foreground">
                Секретный ключ
              </span>
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className={field}
              />
            </label>
            {error && <p className="text-[0.85em] text-destructive">{error}</p>}
            <button
              type="button"
              disabled={busy}
              onClick={submit}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[0.95em] text-primary-foreground transition-transform hover:scale-[1.02] disabled:opacity-60"
            >
              {busy && <Icon name="Loader" size={15} className="animate-spin" />}
              Выдать права
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSetup;

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { resetPassword } from '@/lib/api';

const field =
  'w-full rounded-xl border border-border bg-secondary px-3.5 py-2.5 text-[0.95em] outline-none focus:border-ring';

const label = 'mb-1.5 block text-[0.78em] uppercase tracking-[0.14em] text-muted-foreground';

const ResetPassword = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов');
      return;
    }
    if (password !== repeat) {
      setError('Пароли не совпадают');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      window.setTimeout(() => navigate('/'), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сменить пароль');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen w-full place-items-center bg-background p-6">
      <div className="glass-panel w-full max-w-[420px] rounded-2xl p-6">
        {!token ? (
          <div className="text-center">
            <Icon name="CircleAlert" size={24} className="mx-auto text-foreground/50" />
            <h1 className="mt-4 font-display text-2xl font-light">Ссылка неполная</h1>
            <p className="mt-2 text-[0.9em] leading-relaxed text-foreground/60">
              Откройте ссылку из письма целиком или запросите новую на странице входа.
            </p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-[0.95em] text-primary-foreground"
            >
              На главную
            </button>
          </div>
        ) : done ? (
          <div className="text-center">
            <Icon name="CircleCheck" size={24} className="mx-auto text-foreground/70" />
            <h1 className="mt-4 font-display text-2xl font-light">Пароль обновлён</h1>
            <p className="mt-2 text-[0.9em] leading-relaxed text-foreground/60">
              Вы уже вошли в аккаунт. Сейчас перенесём на главную.
            </p>
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl font-light tracking-[-0.02em]">Новый пароль</h1>
            <p className="mt-2 text-[0.9em] leading-relaxed text-foreground/60">
              Придумайте пароль, который легко вспомнить, — не короче 6 символов.
            </p>

            <div className="mt-5 space-y-3">
              <label className="block">
                <span className={label}>Новый пароль</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={field}
                />
              </label>
              <label className="block">
                <span className={label}>Ещё раз</span>
                <input
                  type="password"
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
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
                Сохранить пароль
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
};

export default ResetPassword;

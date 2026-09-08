import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { forgotPassword, login, register, type AuthUser } from '@/lib/api';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuth: (user: AuthUser) => void;
};

const field =
  'w-full rounded-xl border border-border bg-secondary px-3.5 py-2.5 text-[0.95em] outline-none focus:border-ring';

const label = 'mb-1.5 block text-[0.78em] uppercase tracking-[0.14em] text-muted-foreground';

const AuthDialog = ({ open, onOpenChange, onAuth }: Props) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  const sendReset = async () => {
    setError(null);
    setBusy(true);
    try {
      const message = await forgotPassword(email.trim().toLowerCase());
      setSent(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить письмо');
    } finally {
      setBusy(false);
    }
  };

  const run = async (mode: 'login' | 'register') => {
    setError(null);
    setBusy(true);
    try {
      const user =
        mode === 'login'
          ? await login(email.trim().toLowerCase(), password)
          : await register(email.trim().toLowerCase(), password, name.trim());
      onAuth(user);
      onOpenChange(false);
      setPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось войти');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-popover text-popover-foreground">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-light tracking-[-0.02em]">
            Вход в Звучи
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            История треков сохраняется в вашем аккаунте
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="login" className="mt-2">
          <TabsList className="grid w-full grid-cols-2 bg-secondary">
            <TabsTrigger value="login">Вход</TabsTrigger>
            <TabsTrigger value="register">Регистрация</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-3 pt-4">
            {sent ? (
              <div className="rounded-xl border border-border bg-secondary p-4 text-center">
                <Icon name="MailCheck" size={22} className="mx-auto text-muted-foreground" />
                <p className="mt-3 text-[0.95em] text-foreground">Проверьте почту</p>
                <p className="mt-2 text-[0.85em] leading-relaxed text-muted-foreground">
                  {sent}. Ссылка действует час — если письма нет, посмотрите папку «Спам».
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSent(null);
                    setForgotMode(false);
                  }}
                  className="mt-3 text-[0.85em] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Вернуться ко входу
                </button>
              </div>
            ) : (
              <>
                <label className="block">
                  <span className={label}>Почта</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@mail.ru"
                    className={field}
                  />
                </label>
                {!forgotMode && (
                  <label className="block">
                    <span className={label}>Пароль</span>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={field}
                    />
                  </label>
                )}
                {forgotMode && (
                  <p className="text-[0.85em] leading-relaxed text-muted-foreground">
                    Пришлём на эту почту ссылку, по которой вы зададите новый пароль.
                  </p>
                )}
                {error && <p className="text-[0.85em] text-destructive">{error}</p>}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => (forgotMode ? sendReset() : run('login'))}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[0.95em] text-primary-foreground transition-transform hover:scale-[1.02] disabled:opacity-60"
                >
                  {busy && <Icon name="Loader" size={15} className="animate-spin" />}
                  {forgotMode ? 'Прислать ссылку' : 'Войти'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForgotMode((v) => !v);
                    setError(null);
                  }}
                  className="w-full text-[0.85em] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  {forgotMode ? 'Я вспомнил пароль' : 'Забыли пароль?'}
                </button>
              </>
            )}
          </TabsContent>

          <TabsContent value="register" className="space-y-3 pt-4">
            <label className="block">
              <span className={label}>Имя</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className={label}>Почта</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@mail.ru"
                className={field}
              />
            </label>
            <label className="block">
              <span className={label}>Пароль</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="минимум 6 символов"
                className={field}
              />
            </label>
            {error && <p className="text-[0.85em] text-destructive">{error}</p>}
            <button
              type="button"
              disabled={busy}
              onClick={() => run('register')}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[0.95em] text-primary-foreground transition-transform hover:scale-[1.02] disabled:opacity-60"
            >
              {busy && <Icon name="Loader" size={15} className="animate-spin" />}
              Создать аккаунт
            </button>
            <p className="text-[0.78em] leading-relaxed text-muted-foreground">
              Регистрируясь, вы соглашаетесь с{' '}
              <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">
                политикой конфиденциальности
              </a>
              .
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AuthDialog;

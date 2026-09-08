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
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  email: string;
  credits: number;
  used: number;
  onSave: (name: string, email: string) => void;
  onLogout?: () => void;
};

const PLANS = [
  {
    id: 'free',
    name: 'Бесплатный',
    price: '0 ₽',
    note: '10 треков в месяц · длина до 1 минуты',
    limits: ['Без редактирования трека', 'Только скачивание готового файла'],
  },
  {
    id: 'standard',
    name: 'Стандарт',
    price: '299 ₽',
    note: '50 генераций в месяц',
    limits: [
      'Свободная лицензия на трек',
      'Приоритетная генерация',
      'Базовое редактирование трека',
    ],
  },
  {
    id: 'premium',
    name: 'Премиум',
    price: '999 ₽',
    note: '300 генераций в месяц',
    limits: [
      'Свободное редактирование в студии',
      'Разделение вокала и минусовки',
      'Инструмент разделения на дорожки',
    ],
  },
];

const AccountDialog = ({
  open,
  onOpenChange,
  userName,
  email,
  credits,
  used,
  onSave,
  onLogout,
}: Props) => {
  const [name, setName] = useState(userName);
  const [mail, setMail] = useState(email);
  const [plan, setPlan] = useState('standard');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (name.trim().length < 2) {
      setError('Введите имя — минимум 2 символа');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setError('Проверьте адрес почты');
      return;
    }
    setError(null);
    onSave(name.trim(), mail.trim());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-popover text-popover-foreground">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-light tracking-[-0.02em]">
            Личный кабинет
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Профиль, лимит генераций и тариф
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profile" className="mt-2">
          <TabsList className="grid w-full grid-cols-3 bg-secondary">
            <TabsTrigger value="profile">Профиль</TabsTrigger>
            <TabsTrigger value="limits">Лимит</TabsTrigger>
            <TabsTrigger value="plan">Тариф</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-3 pt-4">
            <label className="block">
              <span className="mb-1.5 block text-[0.78em] uppercase tracking-[0.14em] text-muted-foreground">
                Имя
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-border bg-secondary px-3.5 py-2.5 text-[0.95em] outline-none focus:border-ring"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[0.78em] uppercase tracking-[0.14em] text-muted-foreground">
                Почта
              </span>
              <input
                value={mail}
                onChange={(e) => setMail(e.target.value)}
                className="w-full rounded-xl border border-border bg-secondary px-3.5 py-2.5 text-[0.95em] outline-none focus:border-ring"
              />
            </label>
            {error && <p className="text-[0.85em] text-destructive">{error}</p>}
            <button
              type="button"
              onClick={submit}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[0.95em] text-primary-foreground transition-transform hover:scale-[1.02]"
            >
              {saved && <Icon name="Check" size={15} />}
              {saved ? 'Сохранено' : 'Сохранить'}
            </button>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-[0.9em] text-muted-foreground transition-colors hover:text-foreground"
              >
                <Icon name="LogOut" size={15} />
                Выйти из аккаунта
              </button>
            )}
          </TabsContent>

          <TabsContent value="limits" className="space-y-3 pt-4">
            <div className="rounded-2xl border border-border bg-secondary p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-[0.9em] text-foreground">Использовано в этом месяце</span>
                <span className="font-display text-lg">
                  {used} / {credits}
                </span>
              </div>
              <div className="mt-3 h-[5px] w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, (used / credits) * 100)}%` }}
                />
              </div>
              <p className="mt-3 text-[0.85em] text-muted-foreground">
                Лимит обновится 1 октября. Неизрасходованные генерации не переносятся.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-secondary p-4">
              <p className="flex items-center gap-2 text-[0.9em] text-foreground">
                <Icon name="ShieldCheck" size={15} />
                Права на треки
              </p>
              <p className="mt-2 text-[0.85em] text-muted-foreground">
                Музыка создаётся с нуля на моделях со свободной лицензией и не содержит чужих
                записей. Исключительные права на каждый созданный трек принадлежат вам — включая
                коммерческое использование, рекламу, YouTube и стриминг.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="plan" className="space-y-2 pt-4">
            {PLANS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlan(p.id)}
                className={cn(
                  'w-full rounded-2xl border px-4 py-3 text-left transition-colors',
                  plan === p.id
                    ? 'border-ring bg-secondary'
                    : 'border-border bg-transparent hover:bg-secondary/60',
                )}
              >
                <span className="flex items-center justify-between gap-3">
                  <span>
                    <span className="block text-[0.95em] text-foreground">{p.name}</span>
                    <span className="block text-[0.82em] text-muted-foreground">{p.note}</span>
                  </span>
                  <span className="font-display text-[1em] text-foreground">{p.price}</span>
                </span>
                {p.limits.length > 0 && (
                  <span className="mt-2 block space-y-1">
                    {p.limits.map((limit) => (
                      <span
                        key={limit}
                        className="flex items-center gap-1.5 text-[0.8em] text-muted-foreground"
                      >
                        <Icon
                          name={p.id === 'free' ? 'Minus' : 'Check'}
                          size={12}
                          className="flex-none"
                        />
                        {limit}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AccountDialog;
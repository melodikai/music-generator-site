import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { STYLES } from '@/lib/studio-data';

export type SectionId = 'create' | 'tracks' | 'library' | 'favorites' | 'account' | 'history';

export const SECTIONS: { id: SectionId; label: string; icon: string }[] = [
  { id: 'create', label: 'Создать', icon: 'AudioLines' },
  { id: 'tracks', label: 'Мои треки', icon: 'Music' },
  { id: 'library', label: 'Библиотека', icon: 'ListMusic' },
  { id: 'favorites', label: 'Избранное', icon: 'Star' },
  { id: 'history', label: 'История', icon: 'Clock' },
];

type Props = {
  current: SectionId;
  onSelect: (id: SectionId) => void;
  activeStyle: string;
  onStyle: (style: string) => void;
  onAccount: () => void;
  userName: string;
  credits: number;
  onClose?: () => void;
};

const BrandMark = () => (
  <span className="grid h-5 w-5 flex-none place-items-center rounded-md bg-primary">
    <span className="flex items-end gap-[2px]">
      <i className="block h-[5px] w-[2px] rounded-[1px] bg-primary-foreground" />
      <i className="block h-[9px] w-[2px] rounded-[1px] bg-primary-foreground" />
      <i className="block h-[6px] w-[2px] rounded-[1px] bg-primary-foreground" />
    </span>
  </span>
);

const StudioSidebar = ({
  current,
  onSelect,
  activeStyle,
  onStyle,
  onAccount,
  userName,
  credits,
  onClose,
}: Props) => (
  <aside className="flex h-full flex-col px-3 py-3 pr-3.5">
    <div className="mb-8 flex items-center justify-between gap-2 px-1.5 pt-1">
      <button
        type="button"
        onClick={() => onSelect('create')}
        className="flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-80"
      >
        <BrandMark />
        <span className="font-display text-[1.15em] font-medium tracking-[-0.02em] text-foreground">
          Звучи
        </span>
      </button>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть меню"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground lg:hidden"
        >
          <Icon name="X" size={18} />
        </button>
      )}
    </div>

    <nav className="flex flex-col gap-0.5">
      {SECTIONS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className={cn(
            'flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-[0.93em] tracking-[0.005em] transition-colors',
            current === item.id
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
          )}
        >
          <Icon name={item.icon} size={15} className="opacity-85" fallback="Circle" />
          {item.label}
        </button>
      ))}
    </nav>

    <p className="mb-2 mt-7 px-3 text-[0.72em] uppercase tracking-[0.14em] text-muted-foreground">
      Стили
    </p>
    <div className="scroll-slim -mr-1 flex max-h-[220px] flex-col gap-0.5 overflow-y-auto pr-1">
      {STYLES.map((style) => (
        <button
          key={style}
          type="button"
          onClick={() => onStyle(style)}
          className={cn(
            'rounded-[10px] px-3 py-2.5 text-left text-[0.93em] transition-colors',
            activeStyle === style
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
          )}
        >
          {style}
        </button>
      ))}
    </div>

    <div className="mt-auto pt-6">
      <button
        type="button"
        onClick={onAccount}
        className="flex w-full items-center gap-2.5 rounded-xl bg-secondary px-2.5 py-2.5 text-left transition-colors hover:bg-secondary/70"
      >
        <span
          className="h-7 w-7 flex-none rounded-full"
          style={{ background: 'linear-gradient(150deg, hsl(var(--accent)), hsl(var(--wave)))' }}
        />
        <span className="min-w-0">
          <span className="block truncate text-[0.9em] leading-tight text-foreground">
            {userName}
          </span>
          <span className="block text-[0.78em] leading-tight text-muted-foreground">
            {credits} генераций в месяц
          </span>
        </span>
      </button>
    </div>
  </aside>
);

export default StudioSidebar;

import { FormEvent, useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { MOODS, PROMPT_IDEAS, STYLES, TYPING_PLACEHOLDER } from '@/lib/studio-data';
import PhotoDrop from '@/components/studio/PhotoDrop';

type Props = {
  value: string;
  onChange: (value: string) => void;
  image: string | null;
  onImage: (value: string | null) => void;
  style: string;
  onStyle: (style: string) => void;
  mood: string;
  onMood: (mood: string) => void;
  withVocal: boolean;
  onVocal: (value: boolean) => void;
  generating: boolean;
  progress: number;
  onGenerate: () => void;
  error: string | null;
};

const useTypedPlaceholder = (active: boolean) => {
  const [text, setText] = useState('');

  useEffect(() => {
    if (!active) {
      setText('');
      return;
    }
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setText(TYPING_PLACEHOLDER.slice(0, i));
      if (i >= TYPING_PLACEHOLDER.length) window.clearInterval(timer);
    }, 45);
    return () => window.clearInterval(timer);
  }, [active]);

  return text;
};

const PromptPanel = ({
  value,
  onChange,
  image,
  onImage,
  style,
  onStyle,
  mood,
  onMood,
  withVocal,
  onVocal,
  generating,
  progress,
  onGenerate,
  error,
}: Props) => {
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const typed = useTypedPlaceholder(!value && !focused);

  const togglePhoto = () => {
    setPhotoOpen((v) => {
      if (v) onImage(null);
      return !v;
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onGenerate();
  };

  return (
    <section className="px-4 pt-12 text-center sm:px-8 md:pt-[74px]">
      <h1 className="animate-rise font-display text-[34px] font-light leading-[1.08] tracking-[-0.03em] sm:text-[44px] md:text-[57px]">
        Звучи.
        <br />
        <span className="text-foreground/55">Опишите музыку словами</span>
      </h1>
      <p
        className="animate-rise mx-auto mt-3.5 max-w-[430px] text-[0.98em] leading-[1.5] text-foreground/60"
        style={{ animationDelay: '0.05s' }}
      >
        Трек по описанию или по фото — за минуту. Все права на результат остаются у вас.
      </p>

      <form
        onSubmit={submit}
        className="animate-rise mx-auto mt-6 w-full max-w-[620px]"
        style={{ animationDelay: '0.16s' }}
      >
        <div
          className={cn(
            'glass-panel flex items-center gap-3 rounded-[999px] py-2 pl-5 pr-2 transition-shadow sm:pl-[22px]',
            focused && 'shadow-[0_0_0_1px_hsl(var(--ring)/0.35)]',
          )}
        >
          <div className="relative flex-1 text-left">
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              disabled={generating}
              aria-label="Опишите музыку"
              className="w-full bg-transparent text-[1em] text-foreground/90 outline-none placeholder:text-transparent disabled:opacity-60"
              placeholder={TYPING_PLACEHOLDER}
            />
            {!value && !focused && (
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center text-[1em] text-foreground/70">
                {typed}
                <span className="caret-blink" />
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={togglePhoto}
            aria-label="Создать музыку по фото"
            className={cn(
              'grid h-[38px] w-[38px] flex-none place-items-center rounded-full transition-colors',
              photoOpen || image
                ? 'bg-white/25 text-foreground'
                : 'bg-white/10 text-foreground/70 hover:text-foreground',
            )}
          >
            <Icon name="Image" size={16} />
          </button>
          <button
            type="submit"
            disabled={generating}
            aria-label="Сгенерировать трек"
            className="grid h-[38px] w-[38px] flex-none place-items-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 disabled:opacity-60"
          >
            <Icon name={generating ? 'Loader' : 'ArrowUp'} size={16} className={cn(generating && 'animate-spin')} />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="glass-panel flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.82em] text-foreground/75 transition-colors hover:text-foreground"
          >
            <Icon name="SlidersHorizontal" size={13} />
            Настройки
            <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={13} />
          </button>
          <button
            type="button"
            onClick={togglePhoto}
            className={cn(
              'glass-panel flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.82em] transition-colors',
              photoOpen || image ? 'text-foreground' : 'text-foreground/75 hover:text-foreground',
            )}
          >
            <Icon name="ImagePlus" size={13} />
            Музыка по фото
          </button>
          <span className="glass-panel rounded-full px-3 py-1.5 text-[0.82em] text-foreground/75">
            {style}
          </span>
          <span className="glass-panel rounded-full px-3 py-1.5 text-[0.82em] text-foreground/75">
            {mood}
          </span>
          {withVocal && (
            <span className="glass-panel rounded-full px-3 py-1.5 text-[0.82em] text-foreground/75">
              С вокалом
            </span>
          )}
        </div>

        {photoOpen && (
          <PhotoDrop
            image={image}
            onImage={onImage}
            onClose={() => {
              setPhotoOpen(false);
              onImage(null);
            }}
          />
        )}

        {open && (
          <div className="glass-panel animate-scale-in mx-auto mt-3 space-y-4 rounded-2xl p-4 text-left">
            <div>
              <p className="mb-2 text-[0.72em] uppercase tracking-[0.14em] text-foreground/50">
                Стиль
              </p>
              <div className="flex flex-wrap gap-1.5">
                {STYLES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onStyle(item)}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-[0.82em] transition-colors',
                      style === item
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-white/10 text-foreground/75 hover:text-foreground',
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[0.72em] uppercase tracking-[0.14em] text-foreground/50">
                Настроение
              </p>
              <div className="flex flex-wrap gap-1.5">
                {MOODS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onMood(item)}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-[0.82em] transition-colors',
                      mood === item
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-white/10 text-foreground/75 hover:text-foreground',
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-3 text-[0.9em] text-foreground/80">
              Добавить вокал
              <span
                onClick={() => onVocal(!withVocal)}
                className={cn(
                  'relative h-6 w-11 flex-none rounded-full transition-colors',
                  withVocal ? 'bg-primary' : 'bg-white/15',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all',
                    withVocal ? 'left-[22px]' : 'left-0.5',
                  )}
                />
              </span>
            </label>
            <div>
              <p className="mb-2 text-[0.72em] uppercase tracking-[0.14em] text-foreground/50">
                Идеи запроса
              </p>
              <div className="flex flex-col gap-1">
                {PROMPT_IDEAS.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => onChange(idea)}
                    className="rounded-lg px-2.5 py-1.5 text-left text-[0.85em] text-foreground/70 transition-colors hover:bg-white/10 hover:text-foreground"
                  >
                    {idea}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-[0.85em] text-destructive">{error}</p>}

        {generating ? (
          <div className="mx-auto mt-4 max-w-[420px]">
            <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/12">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-[0.85em] text-foreground/55">
              Собираем аранжировку и сведение — {progress}%
            </p>
          </div>
        ) : (
          !error && (
            <p className="mt-3 text-[0.85em] text-foreground/45">
              {image
                ? 'Фото готово — нажмите стрелку, чтобы собрать трек'
                : 'Опишите настроение, инструменты и темп'}
            </p>
          )
        )}
      </form>
    </section>
  );
};

export default PromptPanel;
import { DragEvent, useRef, useState } from 'react';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { Track } from '@/lib/studio-data';
import { Stem } from '@/lib/api';
import { splitStems } from '@/lib/stem-split';

type Props = {
  tracks: Track[];
};

const MAX_MB = 30;

const STEM_ICONS: Record<string, string> = {
  vocals: 'Mic',
  drums: 'Drum',
  bass: 'Waves',
  other: 'Piano',
  guitar: 'Guitar',
  piano: 'Piano',
  no_vocals: 'Music2',
};

const StemPlayer = ({ stem }: { stem: Stem }) => {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(100);

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (playing) el.pause();
    else el.play().catch(() => undefined);
    setPlaying(!playing);
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card px-3.5 py-3 text-card-foreground">
      <button
        type="button"
        onClick={toggle}
        aria-label={`Слушать ${stem.name}`}
        className="grid h-9 w-9 flex-none place-items-center rounded-full bg-black/8 text-card-foreground transition-colors hover:bg-black/15"
      >
        <Icon name={playing ? 'Pause' : 'Play'} size={14} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[0.9em] font-medium">
          <Icon name={STEM_ICONS[stem.id] || 'AudioLines'} size={13} fallback="AudioLines" />
          {stem.name}
        </p>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => {
            const v = Number(e.target.value);
            setVolume(v);
            if (audio.current) audio.current.volume = v / 100;
          }}
          aria-label={`Громкость дорожки ${stem.name}`}
          className="mt-2 h-1 w-full cursor-pointer appearance-none rounded-full bg-black/15 accent-black"
        />
      </div>
      <a
        href={stem.url}
        download={`${stem.name}.mp3`}
        aria-label={`Скачать ${stem.name}`}
        className="grid h-8 w-8 flex-none place-items-center rounded-full text-card-muted transition-colors hover:bg-black/5 hover:text-card-foreground"
      >
        <Icon name="Download" size={15} />
      </a>
      <audio
        ref={audio}
        src={stem.url}
        preload="none"
        onEnded={() => setPlaying(false)}
        className="hidden"
      />
    </div>
  );
};

const StemSplitter = ({ tracks }: Props) => {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stems, setStems] = useState<Stem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const ready = tracks.filter((t) => t.audio);

  const read = (picked: File) => {
    if (!picked.type.startsWith('audio/')) {
      setError('Нужен аудиофайл: MP3, WAV, M4A или OGG');
      return;
    }
    if (picked.size > MAX_MB * 1024 * 1024) {
      setError(`Файл больше ${MAX_MB} МБ — выберите поменьше`);
      return;
    }
    setError(null);
    setStems([]);
    setSourceUrl(null);
    setFileName(picked.name);
    setFile(picked);
  };

  const drop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) read(file);
  };

  const split = async () => {
    if (busy || (!file && !sourceUrl)) return;
    setBusy(true);
    setError(null);
    setStems([]);
    setProgress(5);

    try {
      const result = await splitStems(file || sourceUrl!, setProgress);
      setProgress(100);
      setStems(result.map(({ id, name, url }) => ({ id, name, url })));
    } catch (e) {
      setError(
        e instanceof Error && e.message.includes('decode')
          ? 'Не удалось прочитать этот файл — попробуйте MP3 или WAV'
          : 'Не удалось разделить трек — попробуйте другой файл',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="px-4 pb-6 pt-8 sm:px-8">
      <div className="mx-auto max-w-[620px] text-center">
        <h1 className="animate-rise font-display text-[30px] font-light leading-[1.08] tracking-[-0.03em] sm:text-[38px]">
          Разделение на дорожки
        </h1>
        <p className="animate-rise mx-auto mt-3 max-w-[460px] text-[0.98em] leading-[1.5] text-foreground/60">
          Загрузите трек — вокал, минусовка, бас и ударные разложатся по отдельным файлам.
          Работает прямо в браузере: бесплатно и без ограничений.
        </p>
      </div>

      <div className="glass-panel animate-scale-in mx-auto mt-6 max-w-[620px] rounded-2xl p-4 text-left">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={drop}
          onClick={() => input.current?.click()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors',
            over ? 'border-foreground/60 bg-white/10' : 'border-white/25 hover:bg-white/5',
          )}
        >
          <Icon name={fileName ? 'FileAudio' : 'Upload'} size={22} className="text-foreground/60" />
          <p className="text-[0.92em] text-foreground/80">
            {fileName || 'Перетащите аудиофайл или нажмите, чтобы выбрать'}
          </p>
          <p className="text-[0.8em] text-foreground/45">MP3, WAV, M4A, OGG · до {MAX_MB} МБ</p>
        </div>

        <input
          ref={input}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) read(file);
            e.target.value = '';
          }}
        />

        {ready.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[0.72em] uppercase tracking-[0.14em] text-foreground/50">
              Или выберите свой трек
            </p>
            <div className="flex flex-wrap gap-2">
              {ready.slice(0, 6).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSourceUrl(t.audio || null);
                    setFile(null);
                    setFileName(t.title);
                    setStems([]);
                    setError(null);
                  }}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-[0.82em] transition-colors',
                    sourceUrl === t.audio
                      ? 'bg-white/25 text-foreground'
                      : 'bg-white/10 text-foreground/70 hover:text-foreground',
                  )}
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={split}
          disabled={busy || (!file && !sourceUrl)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-[0.95em] text-primary-foreground transition-transform hover:scale-[1.01] disabled:opacity-45 disabled:hover:scale-100"
        >
          <Icon name={busy ? 'Loader' : 'Split'} size={16} className={cn(busy && 'animate-spin')} />
          {busy ? 'Разделяем…' : 'Разделить на дорожки'}
        </button>

        {busy && (
          <div className="mt-3 h-[4px] w-full overflow-hidden rounded-full bg-white/12">
            <div
              className="h-full rounded-full bg-foreground/70 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {error && <p className="mt-3 text-[0.85em] text-destructive">{error}</p>}
      </div>

      {stems.length > 0 && (
        <div className="mx-auto mt-5 max-w-[620px] space-y-2">
          {stems.map((stem) => (
            <StemPlayer key={stem.id} stem={stem} />
          ))}
          <p className="pt-1 text-center text-[0.78em] text-foreground/45">
            Все дорожки ваши — используйте их в любых проектах
          </p>
        </div>
      )}
    </section>
  );
};

export default StemSplitter;
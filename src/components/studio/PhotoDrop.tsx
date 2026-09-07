import { DragEvent, useRef, useState } from 'react';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';

type Props = {
  image: string | null;
  onImage: (dataUrl: string | null) => void;
  onClose: () => void;
};

const MAX_MB = 8;

const PhotoDrop = ({ image, onImage, onClose }: Props) => {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const read = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Нужен файл-изображение: JPG, PNG или WebP');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Файл больше ${MAX_MB} МБ — выберите поменьше`);
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => onImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const drop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) read(file);
  };

  return (
    <div className="glass-panel animate-scale-in mx-auto mt-3 rounded-2xl p-4 text-left">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[0.72em] uppercase tracking-[0.14em] text-foreground/50">
          Музыка по фото
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть загрузку фото"
          className="rounded-md p-1 text-foreground/50 transition-colors hover:text-foreground"
        >
          <Icon name="X" size={15} />
        </button>
      </div>

      {image ? (
        <div className="flex items-center gap-3">
          <img
            src={image}
            alt="Загруженное фото"
            className="h-[74px] w-[74px] flex-none rounded-xl object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[0.9em] text-foreground/85">Фото загружено</p>
            <p className="mt-0.5 text-[0.82em] text-foreground/55">
              Соберём настроение снимка в трек. Можно дополнить описанием в поле выше.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onImage(null)}
            className="flex-none rounded-full bg-white/10 px-3 py-1.5 text-[0.82em] text-foreground/75 transition-colors hover:text-foreground"
          >
            Заменить
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={drop}
          onClick={() => input.current?.click()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-7 text-center transition-colors',
            over ? 'border-foreground/60 bg-white/10' : 'border-white/25 hover:bg-white/5',
          )}
        >
          <Icon name="ImagePlus" size={22} className="text-foreground/60" />
          <p className="text-[0.92em] text-foreground/80">
            Перетащите фото сюда или нажмите, чтобы выбрать
          </p>
          <p className="text-[0.8em] text-foreground/45">JPG, PNG, WebP · до {MAX_MB} МБ</p>
        </div>
      )}

      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) read(file);
          e.target.value = '';
        }}
      />

      {error && <p className="mt-2 text-[0.85em] text-destructive">{error}</p>}
    </div>
  );
};

export default PhotoDrop;

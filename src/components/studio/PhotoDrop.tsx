import { DragEvent, useRef, useState } from 'react';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';

type Props = {
  image: string | null;
  onImage: (dataUrl: string | null) => void;
  onClose: () => void;
};

const MAX_MB = 8;
const MAX_SIDE = 1024;

const shrink = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode'));
      img.onload = () => {
        const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });

const PhotoDrop = ({ image, onImage, onClose }: Props) => {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const read = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Нужен файл-изображение: JPG, PNG или WebP');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Файл больше ${MAX_MB} МБ — выберите поменьше`);
      return;
    }
    setError(null);
    try {
      onImage(await shrink(file));
    } catch {
      setError('Не удалось прочитать это изображение');
    }
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
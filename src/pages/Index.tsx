import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { INITIAL_TRACKS, Track, makeTrack } from '@/lib/studio-data';
import StudioSidebar, { SectionId } from '@/components/studio/Sidebar';
import PromptPanel from '@/components/studio/PromptPanel';
import Player from '@/components/studio/Player';
import TrackFeed from '@/components/studio/TrackFeed';
import AccountDialog from '@/components/studio/AccountDialog';
import DawEditor from '@/components/studio/DawEditor';
import StemSplitter from '@/components/studio/StemSplitter';
import { checkGeneration, fetchSavedTracks, saveProfile, startGeneration } from '@/lib/api';

const STAGE_IMAGE =
  'https://cdn.poehali.dev/projects/1b7a339a-91f0-4ef8-9965-ce631414fd64/files/8a003fe7-72fb-4cd1-b63b-928feb3c181e.jpg';

const Index = () => {
  const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS);
  const [section, setSection] = useState<SectionId>('create');
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [style, setStyle] = useState('Лоу-фай');
  const [mood, setMood] = useState('Тёплое');
  const [withVocal, setWithVocal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(INITIAL_TRACKS[0].id);
  const [playing, setPlaying] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [profile, setProfile] = useState({ name: 'Анна Ковалёва', email: 'anna@zvuchi.ru' });
  const [used, setUsed] = useState(12);
  const timer = useRef<number | null>(null);

  const activeTrack = useMemo(
    () => tracks.find((t) => t.id === activeId) ?? tracks[0] ?? null,
    [tracks, activeId],
  );

  useEffect(
    () => () => {
      if (timer.current) window.clearInterval(timer.current);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    fetchSavedTracks(profile.email)
      .then((saved) => {
        if (cancelled || !saved.length) return;
        const restored: Track[] = saved.map((t, i) => ({
          id: t.id,
          title: t.title || `Трек ${i + 1}`,
          style: t.style || 'лоу-фай',
          duration: `${Math.floor((t.seconds || 47) / 60)}:${String((t.seconds || 47) % 60).padStart(2, '0')}`,
          bpm: 92,
          createdAt: t.createdAt ? new Date(t.createdAt).toLocaleDateString('ru-RU') : 'Ранее',
          favorite: false,
          cover: 'linear-gradient(150deg, #f0d9c0, #b98a63)',
          prompt: t.prompt,
          audio: t.audio,
          fromPhoto: t.fromPhoto,
        }));
        setTracks((prev) => [...restored, ...prev]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [profile.email]);

  const handleGenerate = async () => {
    if (generating) return;
    const text = prompt.trim();
    if (!image && text.length < 8) {
      setError('Опишите музыку чуть подробнее — хотя бы 8 символов');
      return;
    }

    setError(null);
    setGenerating(true);
    setProgress(4);

    timer.current = window.setInterval(() => {
      setProgress((p) => (p >= 92 ? p : p + 1));
    }, 700);

    const stop = () => {
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
    };

    try {
      const started = await startGeneration({
        prompt: text,
        style,
        mood,
        vocal: withVocal,
        image,
      });

      let audio: string | null = null;
      for (let i = 0; i < 90; i += 1) {
        await new Promise((r) => window.setTimeout(r, 3000));
        const state = await checkGeneration(started.id, {
          email: profile.email,
          title: started.prompt?.slice(0, 40) || text.slice(0, 40),
          prompt: started.prompt || text,
          style,
          mood,
          seconds: '47',
          ...(started.imageUrl ? { imageUrl: started.imageUrl } : {}),
        });
        if (state.status === 'succeeded') {
          audio = state.audio;
          break;
        }
        if (state.status === 'failed' || state.status === 'canceled') {
          throw new Error('Движок не справился с этим запросом — попробуйте описать иначе');
        }
      }

      stop();
      if (!audio) throw new Error('Генерация заняла слишком много времени, попробуйте ещё раз');

      setProgress(100);
      const fresh = makeTrack(started.prompt || text, style, tracks.length, {
        audio,
        seconds: 47,
        fromPhoto: Boolean(image),
      });
      setTracks((prev) => [fresh, ...prev]);
      setActiveId(fresh.id);
      setPlaying(true);
      setPrompt('');
      setImage(null);
      setUsed((u) => u + 1);
      setSection('create');
    } catch (e) {
      stop();
      setError(e instanceof Error ? e.message : 'Не удалось создать трек');
    } finally {
      stop();
      setGenerating(false);
    }
  };

  const handlePlay = (track: Track) => {
    if (track.id === activeId) {
      setPlaying((p) => !p);
      return;
    }
    setActiveId(track.id);
    setPlaying(true);
  };

  const handleFavorite = (id: string) =>
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, favorite: !t.favorite } : t)));

  const handleSection = (id: SectionId) => {
    setMenuOpen(false);
    if (id === 'account') {
      setAccountOpen(true);
      return;
    }
    setSection(id);
  };

  const sidebar = (
    <StudioSidebar
      current={section}
      onSelect={handleSection}
      activeStyle={style}
      onStyle={(s) => {
        setStyle(s);
        setSection('create');
        setMenuOpen(false);
      }}
      onAccount={() => {
        setAccountOpen(true);
        setMenuOpen(false);
      }}
      userName={profile.name}
      credits={50}
      onClose={() => setMenuOpen(false)}
    />
  );

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background p-2.5 lg:h-screen lg:overflow-hidden">
      <div className="flex h-full gap-2.5">
        <div className="hidden w-[234px] flex-none lg:block">{sidebar}</div>

        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[14px] bg-stage">
          <div
            className="stage-veil pointer-events-none absolute inset-0 rounded-[14px] bg-cover"
            style={{ backgroundImage: `url(${STAGE_IMAGE})`, backgroundPosition: 'center 42%' }}
            aria-hidden
          />

          <div className="scroll-slim relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-4 pt-3 lg:hidden">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Открыть меню"
                className="glass-panel grid h-9 w-9 place-items-center rounded-full text-foreground"
              >
                <Icon name="Menu" size={17} />
              </button>
              <span className="font-display text-[1.05em] font-medium tracking-[-0.02em]">
                Звучи
              </span>
              <button
                type="button"
                onClick={() => setAccountOpen(true)}
                aria-label="Личный кабинет"
                className="glass-panel grid h-9 w-9 place-items-center rounded-full text-foreground"
              >
                <Icon name="User" size={17} />
              </button>
            </div>

            {section === 'create' ? (
              <PromptPanel
                value={prompt}
                onChange={setPrompt}
                image={image}
                onImage={setImage}
                style={style}
                onStyle={setStyle}
                mood={mood}
                onMood={setMood}
                withVocal={withVocal}
                onVocal={setWithVocal}
                generating={generating}
                progress={Math.min(100, progress)}
                onGenerate={handleGenerate}
                error={error}
              />
            ) : section === 'studio' ? (
              <DawEditor tracks={tracks} />
            ) : section === 'stems' ? (
              <StemSplitter tracks={tracks} />
            ) : (
              <section className="px-4 pt-10 text-center sm:px-8">
                <h1 className="animate-rise font-display text-[30px] font-light leading-[1.08] tracking-[-0.03em] sm:text-[40px]">
                  {section === 'tracks' && 'Мои треки'}
                  {section === 'library' && 'Библиотека'}
                  {section === 'favorites' && 'Избранное'}
                  {section === 'history' && 'История генераций'}
                </h1>
                <p className="animate-rise mx-auto mt-3 max-w-[430px] text-[0.98em] text-foreground/60">
                  {section === 'tracks' && 'Всё, что вы создали в «Звучи». Слушайте и скачивайте.'}
                  {section === 'library' && 'Готовые треки и черновики в одном месте.'}
                  {section === 'favorites' && 'Отмеченные сердечком треки.'}
                  {section === 'history' && 'Каждая генерация вместе с исходным запросом.'}
                </p>
                <button
                  type="button"
                  onClick={() => setSection('create')}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[0.9em] text-primary-foreground transition-transform hover:scale-105"
                >
                  <Icon name="Sparkles" size={15} />
                  Новый трек
                </button>
              </section>
            )}

            {section !== 'studio' && section !== 'stems' && (
              <>
                <Player
                  track={activeTrack}
                  playing={playing}
                  onToggle={() => setPlaying((p) => !p)}
                  onFavorite={handleFavorite}
                />

                <TrackFeed
                  section={section}
                  tracks={tracks}
                  activeId={activeTrack?.id ?? null}
                  playing={playing}
                  onPlay={handlePlay}
                  onFavorite={handleFavorite}
                  onSection={handleSection}
                />
              </>
            )}
          </div>
        </main>
      </div>

      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden',
          menuOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
      >
        <div
          onClick={() => setMenuOpen(false)}
          className={cn(
            'absolute inset-0 bg-black/60 transition-opacity',
            menuOpen ? 'opacity-100' : 'opacity-0',
          )}
        />
        <div
          className={cn(
            'absolute inset-y-0 left-0 w-[260px] bg-background transition-transform duration-300',
            menuOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          {sidebar}
        </div>
      </div>

      <AccountDialog
        open={accountOpen}
        onOpenChange={setAccountOpen}
        userName={profile.name}
        email={profile.email}
        credits={50}
        used={used}
        onSave={(name, email) => {
          setProfile({ name, email });
          saveProfile(email, name, 'standard').catch(() => undefined);
        }}
      />
    </div>
  );
};

export default Index;
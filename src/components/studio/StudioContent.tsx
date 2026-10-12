import Icon from '@/components/ui/icon';
import PromptPanel from '@/components/studio/PromptPanel';
import Player from '@/components/studio/Player';
import TrackFeed from '@/components/studio/TrackFeed';
import DawEditor from '@/components/studio/DawEditor';
import StemSplitter from '@/components/studio/StemSplitter';
import LockedSection from '@/components/studio/LockedSection';
import type { StudioPageState } from '@/hooks/useStudioPage';

type Props = {
  studio: StudioPageState;
};

const StudioContent = ({ studio }: Props) => {
  const {
    tracks,
    section,
    setSection,
    prompt,
    setPrompt,
    image,
    setImage,
    style,
    setStyle,
    mood,
    setMood,
    withVocal,
    setWithVocal,
    voice,
    setVoice,
    lyrics,
    setLyrics,
    styleText,
    setStyleText,
    generating,
    progress,
    error,
    playing,
    setPlaying,
    setAuthOpen,
    usage,
    activeTrack,
    handleGenerate,
    handlePlay,
    handleFavorite,
    handleSection,
  } = studio;

  return (
    <>
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
          voice={voice}
          onVoice={setVoice}
          lyrics={lyrics}
          onLyrics={setLyrics}
          styleText={styleText}
          onStyleText={setStyleText}
          generating={generating}
          progress={Math.min(100, progress)}
          onGenerate={handleGenerate}
          error={error}
          usage={usage}
          onRequestAuth={() => setAuthOpen(true)}
        />
      ) : section === 'studio' ? (
        usage.canStudio ? (
          <DawEditor tracks={tracks} />
        ) : (
          <LockedSection
            title="Студия — после регистрации"
            description="Разложите трек на дорожки, сведите заново и выгрузите каждую партию отдельно. Бесплатный аккаунт открывает студию полностью."
            onRequestAuth={() => setAuthOpen(true)}
          />
        )
      ) : section === 'stems' ? (
        usage.canStudio ? (
          <StemSplitter tracks={tracks} />
        ) : (
          <LockedSection
            title="Разделение на дорожки — после регистрации"
            description="Вытащите из трека вокал, минусовку, бас и ударные отдельными файлами. Достаточно бесплатного аккаунта."
            onRequestAuth={() => setAuthOpen(true)}
          />
        )
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
            canDownload={usage.canDownload}
            onRequestAuth={() => setAuthOpen(true)}
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
    </>
  );
};

export default StudioContent;

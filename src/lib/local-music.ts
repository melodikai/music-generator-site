type Params = {
  prompt: string;
  style: string;
  mood: string;
  vocal: boolean;
  seconds: number;
};

const SCALES: Record<string, number[]> = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  penta: [0, 3, 5, 7, 10],
};

const STYLE_PRESET: Record<string, { bpm: number; scale: string; wave: OscillatorType }> = {
  'Лоу-фай': { bpm: 76, scale: 'dorian', wave: 'sine' },
  Рок: { bpm: 128, scale: 'minor', wave: 'sawtooth' },
  Поп: { bpm: 110, scale: 'major', wave: 'triangle' },
  Метал: { bpm: 160, scale: 'minor', wave: 'sawtooth' },
  'Хард-рок': { bpm: 140, scale: 'minor', wave: 'sawtooth' },
  'Хип-хоп': { bpm: 90, scale: 'minor', wave: 'square' },
  Рэп: { bpm: 90, scale: 'minor', wave: 'square' },
  Электроника: { bpm: 124, scale: 'minor', wave: 'sawtooth' },
  Джаз: { bpm: 96, scale: 'dorian', wave: 'sine' },
  Блюз: { bpm: 72, scale: 'penta', wave: 'triangle' },
  Регги: { bpm: 78, scale: 'major', wave: 'triangle' },
  Кинематографика: { bpm: 68, scale: 'minor', wave: 'triangle' },
  Акустика: { bpm: 92, scale: 'major', wave: 'triangle' },
  Панк: { bpm: 170, scale: 'major', wave: 'sawtooth' },
  'Панк-поп': { bpm: 160, scale: 'major', wave: 'sawtooth' },
  Фанк: { bpm: 104, scale: 'dorian', wave: 'square' },
  Кантри: { bpm: 100, scale: 'major', wave: 'triangle' },
  Синтвейв: { bpm: 108, scale: 'minor', wave: 'sawtooth' },
  Классика: { bpm: 72, scale: 'major', wave: 'sine' },
  Эмбиент: { bpm: 60, scale: 'penta', wave: 'sine' },
  Диско: { bpm: 118, scale: 'major', wave: 'square' },
  Инди: { bpm: 112, scale: 'major', wave: 'triangle' },
  Шансон: { bpm: 84, scale: 'minor', wave: 'triangle' },
  Латина: { bpm: 98, scale: 'dorian', wave: 'triangle' },
  'Ар-эн-би': { bpm: 82, scale: 'dorian', wave: 'sine' },
  Народная: { bpm: 96, scale: 'penta', wave: 'triangle' },
  Детская: { bpm: 104, scale: 'major', wave: 'sine' },
  Гранж: { bpm: 120, scale: 'minor', wave: 'sawtooth' },
  Марш: { bpm: 112, scale: 'major', wave: 'square' },
  Вальс: { bpm: 90, scale: 'major', wave: 'sine' },
};

const MOOD_SHIFT: Record<string, number> = {
  Тёплое: 0,
  Грустное: -3,
  Бодрое: 4,
  Спокойное: -1,
  Тревожное: 1,
};

const hash = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

const rng = (seed: number) => {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
};

const encodeWav = (buffer: AudioBuffer) => {
  const channels = buffer.numberOfChannels;
  const length = buffer.length * channels * 2 + 44;
  const view = new DataView(new ArrayBuffer(length));
  const write = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i));
  };

  write(0, 'RIFF');
  view.setUint32(4, length - 8, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, length - 44, true);

  const data: Float32Array[] = [];
  for (let c = 0; c < channels; c += 1) data.push(buffer.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < buffer.length; i += 1) {
    for (let c = 0; c < channels; c += 1) {
      const sample = Math.max(-1, Math.min(1, data[c][i]));
      view.setInt16(offset, sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([view], { type: 'audio/wav' });
};

const note = (root: number, semitone: number) => root * 2 ** (semitone / 12);

export const generateLocalTrack = async (params: Params): Promise<Blob> => {
  const preset =
    STYLE_PRESET[params.style] ||
    STYLE_PRESET[params.style.charAt(0).toUpperCase() + params.style.slice(1)] ||
    STYLE_PRESET['Поп'];
  const seed = hash(`${params.prompt}|${params.style}|${params.mood}|${Date.now()}`);
  const random = rng(seed);
  const scale = SCALES[preset.scale];
  const shift = MOOD_SHIFT[params.mood] ?? 0;

  const rate = 22050;
  const duration = Math.max(20, Math.min(40, params.seconds || 32));
  const ctx = new OfflineAudioContext(1, rate * duration, rate);

  const master = ctx.createGain();
  master.gain.value = 0.85;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);

  const reverb = ctx.createConvolver();
  const irLen = Math.floor(rate * 1.5);
  const ir = ctx.createBuffer(1, irLen, rate);
  const irCh = ir.getChannelData(0);
  for (let i = 0; i < irLen; i += 1) {
    irCh[i] = (Math.random() * 2 - 1) * (1 - i / irLen) ** 2.6;
  }
  reverb.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.3;
  reverb.connect(wet).connect(master);

  const beat = 60 / preset.bpm;
  const root = 110 * 2 ** (shift / 12);
  const progression = [0, 5, 3, 4].map((step) => scale[step % scale.length]);

  const playNote = (
    freq: number,
    start: number,
    len: number,
    gainValue: number,
    wave: OscillatorType,
  ) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1600 + random() * 1800;

    osc.type = wave;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + len);

    osc.connect(filter).connect(gain);
    gain.connect(master);
    gain.connect(reverb);
    osc.start(start);
    osc.stop(start + len + 0.05);
  };

  const kick = (start: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(140, start);
    osc.frequency.exponentialRampToValueAtTime(46, start + 0.14);
    gain.gain.setValueAtTime(0.9, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(start + 0.35);
  };

  const hat = (start: number) => {
    const len = 0.05;
    const buf = ctx.createBuffer(1, Math.floor(rate * len), rate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i += 1) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const gain = ctx.createGain();
    gain.gain.value = 0.16;
    src.buffer = buf;
    src.connect(filter).connect(gain).connect(master);
    src.start(start);
  };

  const bars = Math.floor(duration / (beat * 4));
  for (let bar = 0; bar < bars; bar += 1) {
    const barStart = bar * beat * 4;
    const chordRoot = note(root, progression[bar % progression.length]);

    [0, 3, 4].forEach((deg, i) => {
      playNote(
        note(chordRoot, scale[deg % scale.length]) * 2,
        barStart,
        beat * 3.6,
        0.1 - i * 0.015,
        preset.wave,
      );
    });

    playNote(chordRoot / 2, barStart, beat * 3.8, 0.24, 'sine');

    for (let step = 0; step < 8; step += 1) {
      const t = barStart + step * (beat / 2);
      if (random() > 0.42) {
        const deg = scale[Math.floor(random() * scale.length)];
        playNote(note(chordRoot, deg) * 4, t, beat * 0.42, 0.075, preset.wave);
      }
      if (preset.bpm > 70 && step % 2 === 1) hat(t);
    }

    kick(barStart);
    if (preset.bpm > 90) kick(barStart + beat * 2);
  }

  const rendered = await ctx.startRendering();
  return encodeWav(rendered);
};

export const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
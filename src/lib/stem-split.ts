export type LocalStem = {
  id: string;
  name: string;
  url: string;
};

const STEM_TITLES: Record<string, string> = {
  vocals: 'Вокал',
  no_vocals: 'Минусовка',
  bass: 'Бас',
  drums: 'Ударные',
};

export const decodeAudio = async (source: File | string): Promise<AudioBuffer> => {
  const data =
    typeof source === 'string'
      ? await (await fetch(source, { mode: 'cors' })).arrayBuffer()
      : await source.arrayBuffer();

  const decoder = new OfflineAudioContext(1, 1, 44100);
  return decoder.decodeAudioData(data);
};

const makeBuffer = (channels: Float32Array[], rate: number) => {
  const helper = new OfflineAudioContext(channels.length, channels[0].length, rate);
  const buffer = helper.createBuffer(channels.length, channels[0].length, rate);
  channels.forEach((data, i) => buffer.getChannelData(i).set(data));
  return buffer;
};

const midSide = (buffer: AudioBuffer) => {
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
  const size = left.length;
  const mid = new Float32Array(size);
  const side = new Float32Array(size);

  for (let i = 0; i < size; i += 1) {
    mid[i] = (left[i] + right[i]) / 2;
    side[i] = (left[i] - right[i]) / 2;
  }
  return { mid, side };
};

const renderFiltered = async (
  buffer: AudioBuffer,
  filters: { type: BiquadFilterType; freq: number; q?: number }[],
  gain = 1,
  limitSeconds?: number,
): Promise<AudioBuffer> => {
  const length = limitSeconds
    ? Math.min(buffer.length, Math.floor(limitSeconds * buffer.sampleRate))
    : buffer.length;
  const offline = new OfflineAudioContext(
    buffer.numberOfChannels,
    length,
    buffer.sampleRate,
  );
  const src = offline.createBufferSource();
  src.buffer = buffer;

  let node: AudioNode = src;
  filters.forEach((f) => {
    const biquad = offline.createBiquadFilter();
    biquad.type = f.type;
    biquad.frequency.value = f.freq;
    if (f.q) biquad.Q.value = f.q;
    node.connect(biquad);
    node = biquad;
  });

  const out = offline.createGain();
  out.gain.value = gain;
  node.connect(out);
  out.connect(offline.destination);
  src.start();
  return offline.startRendering();
};

export const encodeWav = (buffer: AudioBuffer): Blob => {
  const channels = buffer.numberOfChannels;
  const size = buffer.length;
  const bytes = new ArrayBuffer(44 + size * channels * 2);
  const view = new DataView(bytes);

  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };

  text(0, 'RIFF');
  view.setUint32(4, 36 + size * channels * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, size * channels * 2, true);

  const data: Float32Array[] = [];
  for (let c = 0; c < channels; c += 1) data.push(buffer.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < size; i += 1) {
    for (let c = 0; c < channels; c += 1) {
      const s = Math.max(-1, Math.min(1, data[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([view], { type: 'audio/wav' });
};

const MAX_SECONDS = 300;

export const splitStems = async (
  source: File | string,
  onProgress?: (percent: number) => void,
): Promise<LocalStem[]> => {
  const decoded = await decodeAudio(source);
  onProgress?.(20);

  const buffer =
    decoded.duration > MAX_SECONDS
      ? await renderFiltered(decoded, [], 1, MAX_SECONDS)
      : decoded;

  const rate = buffer.sampleRate;
  const { mid, side } = midSide(buffer);
  const stereo = buffer.numberOfChannels > 1;

  const centerBuffer = makeBuffer([mid], rate);
  const sideBuffer = makeBuffer([stereo ? side : mid], rate);

  const recipes: {
    id: string;
    from: AudioBuffer;
    filters: { type: BiquadFilterType; freq: number; q?: number }[];
    gain: number;
  }[] = [
    {
      id: 'vocals',
      from: centerBuffer,
      filters: [
        { type: 'highpass', freq: 220, q: 0.7 },
        { type: 'lowpass', freq: 9000, q: 0.7 },
        { type: 'peaking', freq: 2600, q: 1.1 },
      ],
      gain: 1.35,
    },
    {
      id: 'no_vocals',
      from: sideBuffer,
      filters: stereo
        ? [{ type: 'highpass', freq: 60, q: 0.7 }]
        : [
            { type: 'notch', freq: 1200, q: 0.5 },
            { type: 'notch', freq: 2800, q: 0.5 },
          ],
      gain: stereo ? 1.9 : 1.2,
    },
    {
      id: 'bass',
      from: centerBuffer,
      filters: [
        { type: 'lowpass', freq: 190, q: 0.9 },
        { type: 'lowpass', freq: 240, q: 0.7 },
      ],
      gain: 1.5,
    },
    {
      id: 'drums',
      from: centerBuffer,
      filters: [
        { type: 'highpass', freq: 5200, q: 0.7 },
        { type: 'peaking', freq: 9000, q: 1.2 },
      ],
      gain: 1.8,
    },
  ];

  const stems: LocalStem[] = [];

  for (let i = 0; i < recipes.length; i += 1) {
    const recipe = recipes[i];
    const rendered = await renderFiltered(recipe.from, recipe.filters, recipe.gain);
    stems.push({
      id: recipe.id,
      name: STEM_TITLES[recipe.id] || recipe.id,
      url: URL.createObjectURL(encodeWav(rendered)),
    });
    onProgress?.(20 + Math.round(((i + 1) / recipes.length) * 78));
  }

  return stems;
};
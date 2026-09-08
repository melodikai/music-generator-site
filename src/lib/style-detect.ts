const STYLE_KEYS: [string, string[]][] = [
  ['Хард-рок', ['хард-рок', 'хардрок', 'hard rock']],
  ['Панк-поп', ['панк-поп', 'поп-панк', 'pop punk']],
  ['Метал', ['метал', 'металл', 'metal', 'хэви', 'хеви']],
  ['Панк', ['панк', 'punk']],
  ['Рок', ['рок', 'rock']],
  ['Блюз', ['блюз', 'blues']],
  ['Джаз', ['джаз', 'jazz', 'свинг', 'swing']],
  ['Регги', ['регги', 'рэгги', 'reggae', 'ска', 'даб', 'dub']],
  ['Фанк', ['фанк', 'funk', 'соул', 'soul']],
  ['Диско', ['диско', 'disco']],
  ['Кантри', ['кантри', 'country', 'фолк', 'folk']],
  ['Латина', ['латина', 'латино', 'latin', 'босса', 'самба', 'сальса']],
  ['Хип-хоп', ['хип-хоп', 'хипхоп', 'hip-hop', 'hiphop', 'рэп', 'rap', 'трэп', 'trap']],
  ['Синтвейв', ['синтвейв', 'synthwave', 'ретровейв', 'вейпорвейв']],
  ['Электроника', ['электроник', 'электронн', 'electronic', 'edm', 'техно', 'techno', 'хаус', 'house', 'транс', 'trance', 'дабстеп']],
  ['Лоу-фай', ['лоу-фай', 'лоуфай', 'lo-fi', 'lofi', 'лофай']],
  ['Эмбиент', ['эмбиент', 'ambient', 'дроун', 'медитат']],
  ['Классика', ['классик', 'classic', 'оркестр', 'симфон', 'orchestral', 'фортепиан', 'пианин']],
  ['Кинематографика', ['кинематограф', 'киношн', 'cinematic', 'саундтрек', 'эпичн']],
  ['Ар-эн-би', ['рнб', 'r&b', 'rnb', 'ритм-н-блюз']],
  ['Гранж', ['гранж', 'grunge']],
  ['Инди', ['инди', 'indie']],
  ['Акустика', ['акустик', 'acoustic', 'бард', 'под гитару']],
  ['Шансон', ['шансон', 'chanson', 'романс']],
  ['Народная', ['народн', 'этно', 'ethnic', 'фольклор']],
  ['Детская', ['детск', 'детям', 'ребён', 'ребен', 'малыш', 'колыбельн']],
  ['Марш', ['марш', 'march', 'гимн']],
  ['Вальс', ['вальс', 'waltz']],
  ['Поп', ['поп-музык', 'попса', 'pop']],
];

const normalize = (text: string) =>
  ` ${text.toLowerCase().replace(/ё/g, 'е').replace(/[^\wа-я\s-]/gi, ' ').replace(/\s+/g, ' ').trim()} `;

/** Находит стиль, названный пользователем прямо в запросе. */
export const detectStyle = (text: string): string | null => {
  if (!text) return null;
  const haystack = normalize(text);

  let best: { weight: number; title: string } | null = null;

  for (const [title, keys] of STYLE_KEYS) {
    for (const key of keys) {
      const needle = normalize(key).trim();
      if (!needle) continue;

      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(?<![\\wа-я-])${escaped}[а-яa-z]{0,4}(?![\\wа-я])`, 'i');

      if (pattern.test(haystack)) {
        if (!best || needle.length > best.weight) {
          best = { weight: needle.length, title };
        }
        break;
      }
    }
  }

  return best ? best.title : null;
};

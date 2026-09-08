import re
from typing import Dict, List, Optional, Tuple

# Ключевые слова → музыкальное описание для движка.
# Первое слово каждой группы — то, что показываем пользователю.
STYLE_MAP: List[Tuple[str, List[str], str]] = [
    ('Рок', ['рок', 'rock', 'рок-н-ролл', 'rocknroll'],
     'rock, electric guitars, live drums, driving energy'),
    ('Хард-рок', ['хард-рок', 'хардрок', 'hard rock'],
     'hard rock, heavy distorted guitars, powerful drums'),
    ('Метал', ['метал', 'металл', 'metal', 'хэви', 'хеви', 'heavy metal'],
     'heavy metal, aggressive distorted guitars, double bass drums, powerful'),
    ('Панк', ['панк', 'punk'],
     'punk rock, fast raw guitars, energetic drums, rebellious'),
    ('Блюз', ['блюз', 'blues'],
     'blues, soulful guitar, walking bass, warm vintage tone'),
    ('Джаз', ['джаз', 'jazz', 'свинг', 'swing'],
     'jazz, swing rhythm, brushed drums, upright bass, saxophone'),
    ('Регги', ['регги', 'рэгги', 'reggae', 'ска', 'ska', 'даб', 'dub'],
     'reggae, offbeat guitar skank, deep bass, relaxed groove'),
    ('Фанк', ['фанк', 'funk', 'соул', 'soul'],
     'funk, syncopated bass, rhythm guitar, brass section, groovy'),
    ('Диско', ['диско', 'disco'],
     'disco, four on the floor beat, strings, groovy bassline'),
    ('Кантри', ['кантри', 'country', 'фолк', 'folk', 'блюграсс'],
     'country folk, acoustic guitar, banjo, warm storytelling mood'),
    ('Латина', ['латина', 'латино', 'latin', 'босса', 'bossa', 'самба', 'сальса', 'salsa'],
     'latin, warm acoustic guitar, congas, syncopated rhythm'),
    ('Хип-хоп', ['хип-хоп', 'хипхоп', 'hip-hop', 'hiphop', 'рэп', 'rap', 'трэп', 'trap'],
     'hip hop, punchy drums, deep 808 bass, head nodding groove'),
    ('Рэп', ['рэп', 'rap'],
     'rap beat, punchy drums, deep bass, strong rhythmic groove'),
    ('Электроника', ['электроник', 'электронн', 'electronic', 'edm', 'техно', 'techno',
                     'хаус', 'house', 'транс', 'trance', 'драм-н-бэйс', 'dnb', 'дабстеп'],
     'electronic, synthesizers, driving beat, club energy'),
    ('Синтвейв', ['синтвейв', 'synthwave', 'ретровейв', 'retrowave', 'вейпорвейв', '80-х', '80s'],
     'synthwave, retro analog synths, neon eighties mood, gated drums'),
    ('Лоу-фай', ['лоу-фай', 'лоуфай', 'lo-fi', 'lofi', 'лофай'],
     'lo-fi, dusty vinyl texture, mellow keys, relaxed boom bap drums'),
    ('Эмбиент', ['эмбиент', 'ambient', 'дроун', 'медитат'],
     'ambient, slow evolving pads, spacious reverb, meditative'),
    ('Классика', ['классик', 'classic', 'оркестр', 'симфон', 'orchestral', 'фортепиан', 'пианин'],
     'classical orchestral, strings, piano, expressive dynamics'),
    ('Кинематографика', ['кинематограф', 'киношн', 'cinematic', 'саундтрек', 'эпичн', 'epic'],
     'cinematic score, epic strings, deep percussion, emotional build'),
    ('Поп', ['поп-музык', 'попса', 'поп ', ' поп', 'pop'],
     'pop, catchy melody, polished modern production, bright hooks'),
    ('Панк-поп', ['панк-поп', 'поп-панк', 'pop punk'],
     'pop punk, bright distorted guitars, energetic youthful drums'),
    ('Ар-эн-би', ['рнб', 'r&b', 'rnb', 'ритм-н-блюз'],
     'r&b, smooth groove, silky chords, laid back drums'),
    ('Гранж', ['гранж', 'grunge'],
     'grunge, raw fuzzy guitars, loose drums, nineties mood'),
    ('Инди', ['инди', 'indie'],
     'indie, jangly guitars, warm lo-fi production, honest mood'),
    ('Акустика', ['акустик', 'acoustic', 'бард', 'под гитару'],
     'acoustic, fingerpicked guitar, natural warm recording'),
    ('Шансон', ['шансон', 'chanson', 'романс'],
     'russian chanson, acoustic guitar, accordion, sentimental mood'),
    ('Народная', ['народн', 'этно', 'ethnic', 'фольклор', 'традицион'],
     'folk ethnic, traditional instruments, authentic acoustic timbre'),
    ('Детская', ['детск', 'детям', 'ребён', 'ребен', 'малыш', 'колыбельн'],
     'childrens music, playful bright melody, gentle simple arrangement'),
    ('Марш', ['марш', 'march', 'гимн', 'торжествен'],
     'triumphant march, brass fanfare, powerful drums, ceremonial'),
    ('Вальс', ['вальс', 'waltz'],
     'waltz, three four time, elegant strings, graceful'),
]

MOOD_MAP: Dict[str, str] = {
    'Спокойное': 'calm, peaceful, gentle',
    'Тёплое': 'warm, cosy, inviting',
    'Драйвовое': 'energetic, driving, powerful',
    'Мечтательное': 'dreamy, floating, nostalgic',
    'Тревожное': 'tense, dark, uneasy',
    'Радостное': 'joyful, uplifting, bright',
    'Грустное': 'sad, melancholic, touching',
    'Романтичное': 'romantic, tender, intimate',
    'Эпичное': 'epic, cinematic, monumental',
}


def _norm(text: str) -> str:
    cleaned = re.sub(r'[^\w\s-]', ' ', (text or '').lower().replace('ё', 'е'))
    return ' ' + re.sub(r'\s+', ' ', cleaned).strip() + ' '


def detect_style(text: str) -> Optional[Tuple[str, str]]:
    """Ищет стиль в тексте пользователя. Возвращает (название, описание) или None."""
    haystack = _norm(text)

    best: Optional[Tuple[int, str, str]] = None

    for title, keys, prompt in STYLE_MAP:
        for key in keys:
            needle = _norm(key).strip()
            if not needle:
                continue

            # Слово должно начинаться с границы: «рок» не ловится внутри «урок»,
            # но допускаем окончания — «роковый», «джазовая», «металлом».
            pattern = r'(?<![\w-])' + re.escape(needle) + r'[а-яa-z]{0,4}(?![\w])'
            if not re.search(pattern, haystack):
                continue

            # Более длинное совпадение точнее: «хард-рок» важнее «рок».
            weight = len(needle)
            if best is None or weight > best[0]:
                best = (weight, title, prompt)
            break

    if not best:
        return None
    return best[1], best[2]


def style_prompt(style: str) -> str:
    """Переводит выбранный в интерфейсе стиль в описание для движка."""
    if not style:
        return ''
    found = detect_style(style)
    if found:
        return found[1]
    return style


def mood_prompt(mood: str) -> str:
    if not mood:
        return ''
    return MOOD_MAP.get(mood.strip(), mood)
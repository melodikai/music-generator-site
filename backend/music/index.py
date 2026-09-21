import base64
import json
import os
import time
from typing import Any, Dict, Optional

import requests

import db
import limits
import styles
from storage import upload_file

VOCAL_API_URL = os.environ.get('VOCAL_API_URL', 'https://gptunnel.ru/v1/media/create')
VOCAL_RESULT_URL = os.environ.get('VOCAL_RESULT_URL', 'https://gptunnel.ru/v1/media/result')
VOCAL_MODEL = os.environ.get('VOCAL_MODEL', 'suno')

HF_API = os.environ.get('HF_API', 'https://router.huggingface.co/hf-inference/models')
HF_MUSIC_MODEL = os.environ.get('HF_MUSIC_MODEL', 'facebook/musicgen-small')
HF_CAPTION_MODELS = [
    m.strip()
    for m in (os.environ.get('HF_CAPTION_MODEL') or '').split(',')
    if m.strip()
]

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
}


def respond(status: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'statusCode': status,
        'headers': CORS,
        'isBase64Encoded': False,
        'body': json.dumps(payload, ensure_ascii=False),
    }


class ProviderError(Exception):
    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.message = message
        self.status = status


def upload_image(data_url: str) -> str:
    raw = data_url.split(',', 1)[-1]
    binary = base64.b64decode(raw)
    ext = 'png'
    if 'image/jpeg' in data_url or 'image/jpg' in data_url:
        ext = 'jpg'
    elif 'image/webp' in data_url:
        ext = 'webp'
    return upload_file('images', ext, binary, f'image/{ext}')


def vocal_token() -> Optional[str]:
    return os.environ.get('VOCAL_API_KEY')


def extract_audio_url(data: Any) -> Optional[str]:
    """Ищет ссылку на аудио в ответе шлюза любой формы."""
    if isinstance(data, str):
        return data if data.startswith('http') and '.mp3' in data or data.startswith('http') else None
    if isinstance(data, list):
        for item in data:
            found = extract_audio_url(item)
            if found:
                return found
        return None
    if isinstance(data, dict):
        for name in ('audio_url', 'audioUrl', 'audio', 'url', 'source_audio_url'):
            value = data.get(name)
            if isinstance(value, str) and value.startswith('http'):
                return value
        for value in data.values():
            if isinstance(value, (dict, list)):
                found = extract_audio_url(value)
                if found:
                    return found
    return None


VOICE_HINT = {
    'male': 'male vocalist, male lead vocals',
    'female': 'female vocalist, female lead vocals',
    'duet': 'male and female duet vocals',
}


def vocal_start(
    prompt: str,
    style: str,
    title: str,
    voice: str = 'any',
    lyrics: str = '',
    seconds: int = 165,
) -> Dict[str, Any]:
    """Ставит задачу на песню с вокалом в очередь российского шлюза."""
    key = vocal_token()
    if not key:
        return {'error': 'no-key'}

    hint = VOICE_HINT.get(voice, '')
    tags = ', '.join([p for p in (style, hint) if p])

    body = {
        'model': VOCAL_MODEL,
        'instrumental': False,
        'title': (title or 'Трек')[:60],
    }

    # Просим движок уложиться в нужный хронометраж словами:
    # отдельного поля длительности у шлюза нет.
    length_hint = f'song length about {max(1, round(seconds / 60, 1))} minutes'

    if lyrics:
        body['custom'] = True
        body['customMode'] = True
        body['lyrics'] = lyrics
        body['prompt'] = lyrics
        body['tags'] = tags or 'pop'
        body['style'] = tags or 'pop'
    else:
        body['prompt'] = ', '.join([p for p in (prompt, hint, length_hint) if p])
        if tags:
            body['tags'] = tags



    try:
        r = requests.post(
            VOCAL_API_URL,
            headers={'Authorization': key, 'Content-Type': 'application/json'},
            json=body,
            timeout=60,
        )
    except requests.RequestException as e:
        return {'error': f'network: {e}'}

    try:
        data = r.json()
    except ValueError:
        return {'error': f'bad-response: {r.status_code} {r.text[:200]}'}

    if r.status_code >= 400:
        return {'error': f'{r.status_code}: {json.dumps(data, ensure_ascii=False)[:300]}'}

    task_id = None
    if isinstance(data, dict):
        for name in ('id', 'task_id', 'taskId', 'requestId'):
            if data.get(name):
                task_id = data[name]
                break
        if not task_id and isinstance(data.get('data'), dict):
            inner = data['data']
            for name in ('id', 'task_id', 'taskId'):
                if inner.get(name):
                    task_id = inner[name]
                    break
    if not task_id:
        return {'error': f'no-task-id: {json.dumps(data, ensure_ascii=False)[:300]}'}

    return {'taskId': str(task_id)}


def vocal_result(task_id: str) -> Dict[str, Any]:
    """Проверяет готовность песни и возвращает ссылку на аудио."""
    key = vocal_token()
    if not key:
        return {'status': 'failed', 'error': 'Движок с вокалом не подключён'}

    try:
        r = requests.post(
            VOCAL_RESULT_URL,
            headers={'Authorization': key, 'Content-Type': 'application/json'},
            json={'task_id': task_id},
            timeout=60,
        )
        data = r.json()
    except (requests.RequestException, ValueError):
        return {'status': 'processing'}

    print(f'[vocal] result {r.status_code}: {json.dumps(data, ensure_ascii=False)[:600]}')

    if r.status_code >= 400:
        return {'status': 'processing'}

    status = ''
    if isinstance(data, dict):
        status = str(data.get('status') or data.get('state') or '').lower()

    audio = extract_audio_url(data)
    if audio:
        return {'status': 'succeeded', 'audio': audio}

    if status in ('failed', 'error', 'canceled'):
        return {
            'status': 'failed',
            'error': 'Движок с вокалом не справился. Попробуйте ещё раз — '
                     'обычно со второй попытки получается.',
        }

    return {'status': 'processing'}


def hf_token() -> Optional[str]:
    return os.environ.get('HUGGINGFACE_API_TOKEN')


def hf_generate_music(prompt: str, duration: int) -> Optional[str]:
    """Генерирует трек на бесплатном движке Hugging Face. Возвращает ссылку или None."""
    tok = hf_token()
    if not tok:
        return None

    payload = {
        'inputs': prompt,
        'parameters': {'duration': min(30, max(8, duration))},
        'options': {'wait_for_model': True},
    }
    try:
        r = requests.post(
            f'{HF_API}/{HF_MUSIC_MODEL}',
            headers={'Authorization': f'Bearer {tok}', 'Content-Type': 'application/json'},
            json=payload,
            timeout=240,
        )
    except requests.RequestException:
        return None

    if r.status_code >= 400:
        return None

    content_type = r.headers.get('Content-Type', '')
    if 'audio' not in content_type and not r.content[:4] in (b'RIFF', b'fLaC', b'OggS'):
        return None

    ext = 'flac' if 'flac' in content_type else 'wav'
    return upload_file('tracks', ext, r.content, f'audio/{ext}')


def hf_caption(image_url: str) -> str:
    """Описывает фото словами через бесплатные модели Hugging Face."""
    tok = hf_token()
    if not tok:
        return ''

    try:
        img = requests.get(image_url, timeout=30).content
    except requests.RequestException:
        return ''

    mime = 'image/jpeg'
    if image_url.lower().endswith('.png'):
        mime = 'image/png'
    elif image_url.lower().endswith('.webp'):
        mime = 'image/webp'

    encoded = base64.b64encode(img).decode()
    auth = {'Authorization': f'Bearer {tok}'}

    for model in HF_CAPTION_MODELS:
        attempts = (
            {'headers': {**auth, 'Content-Type': mime}, 'data': img},
            {'headers': auth, 'json': {'inputs': encoded}},
        )

        for attempt in attempts:
            try:
                r = requests.post(f'{HF_API}/{model}', timeout=90, **attempt)
                if r.status_code >= 400:
                    print(f'[caption] {model} -> {r.status_code}: {r.text[:160]}')
                    continue

                out = r.json()
                if isinstance(out, dict):
                    out = [out]
                if isinstance(out, list) and out and isinstance(out[0], dict):
                    text = str(out[0].get('generated_text', '')).strip()
                    if text:
                        return text
            except (requests.RequestException, ValueError) as e:
                print(f'[caption] {model} failed: {type(e).__name__}')
                continue

    return ''


MOOD_BY_LIGHT = [
    (55, 'night mood, dark deep low tones, very slow tempo, sparse arrangement'),
    (100, 'evening mood, warm mellow tones, unhurried tempo, intimate feel'),
    (150, 'soft daylight mood, gentle warm harmony, medium tempo'),
    (200, 'bright daylight mood, light shimmering harmony, flowing tempo'),
    (256, 'radiant sunlit mood, airy uplifting harmony, joyful tempo'),
]

SCENE_HINTS = [
    ('nature', 'organic acoustic instruments, natural open air feeling'),
    ('sky', 'wide spacious pads, floating airy texture'),
    ('sunset', 'warm nostalgic chords, golden hour feeling, tender melody'),
    ('urban', 'steady rhythmic pulse, modern city groove'),
]


def image_mood_prompt(image_data_url: str) -> str:
    """Собирает музыкальное описание по цветам и свету фото. Работает без внешних сервисов."""
    try:
        from io import BytesIO

        from PIL import Image

        raw = base64.b64decode(image_data_url.split(',', 1)[-1])
        img = Image.open(BytesIO(raw)).convert('RGB')
        img.thumbnail((72, 72))
        pixels = list(img.getdata())
    except Exception as e:
        print(f'[mood] image read failed: {type(e).__name__}')
        return ''

    if not pixels:
        return ''

    count = len(pixels)
    r_avg = sum(p[0] for p in pixels) / count
    g_avg = sum(p[1] for p in pixels) / count
    b_avg = sum(p[2] for p in pixels) / count
    light = (r_avg + g_avg + b_avg) / 3
    spread = sum(max(p) - min(p) for p in pixels) / count

    parts = []

    for edge, phrase in MOOD_BY_LIGHT:
        if light < edge:
            parts.append(phrase)
            break

    if r_avg > b_avg + 30:
        parts.append('warm golden colours, analog warmth, tape saturation')
    elif r_avg > b_avg + 12:
        parts.append('warm amber tones, soft vintage character')
    elif b_avg > r_avg + 30:
        parts.append('cool blue colours, airy reverb, spacious pads')
    elif b_avg > r_avg + 12:
        parts.append('cool calm tones, clean transparent mix')
    else:
        parts.append('neutral natural colours, balanced acoustic timbre')

    # Верхняя треть снимка часто небо, нижняя — земля.
    top = pixels[: max(1, count // 3)]
    bottom = pixels[-max(1, count // 3):]
    top_light = sum(sum(p) for p in top) / (3 * len(top))
    bottom_light = sum(sum(p) for p in bottom) / (3 * len(bottom))

    green_share = sum(1 for p in pixels if p[1] > p[0] + 12 and p[1] > p[2] + 12) / count
    blue_top = sum(1 for p in top if p[2] > p[0] + 20) / len(top)
    warm_share = sum(1 for p in pixels if p[0] > 150 and p[1] > 90 and p[2] < 110) / count

    if green_share > 0.18:
        parts.append(SCENE_HINTS[0][1])
    if blue_top > 0.35 and top_light > bottom_light:
        parts.append(SCENE_HINTS[1][1])
    if warm_share > 0.2 and light < 165:
        parts.append(SCENE_HINTS[2][1])

    if spread < 24:
        parts.append('calm minimal arrangement, few instruments, ambient texture')
    elif spread > 82:
        parts.append('rich vivid arrangement, expressive layered instruments')

    return ', '.join(parts)


def build_prompt(
    text: str,
    style: str,
    mood: str,
    vocal: bool,
    lyrics: str = '',
) -> Dict[str, str]:
    """Собирает запрос для движка. Стиль из текста пользователя важнее выбранного в настройках."""
    spoken = f'{text} {lyrics}'.strip()
    from_text = styles.detect_style(spoken)

    if from_text:
        style_title, style_line = from_text
    else:
        style_title = style
        style_line = styles.style_prompt(style)

    parts = [text.strip()]
    if style_line:
        parts.append(style_line)

    mood_line = styles.mood_prompt(mood)
    if mood_line:
        parts.append(mood_line)

    parts.append('vocals' if vocal else 'instrumental')
    parts.append('high quality, clean mix')

    return {
        'prompt': ', '.join(p for p in parts if p),
        'style': style_title,
        'styleLine': style_line,
        'fromText': 'yes' if from_text else '',
    }


def handle_start(body: Dict[str, Any]) -> Dict[str, Any]:
    """Запускает генерацию музыки по тексту или по загруженному фото."""
    text = (body.get('prompt') or '').strip()
    image = body.get('image') or ''
    source_note = ''
    image_url = None
    photo_mood = ''

    db.ensure_schema()
    email = str(body.get('email') or '').strip().lower()
    device_id = str(body.get('deviceId') or '').strip()[:64]
    wants_vocal = bool(body.get('vocal'))

    verdict = limits.check_allowed(email, device_id, wants_vocal)
    if not verdict['ok']:
        return respond(403, {
            'error': verdict['error'],
            'code': verdict['code'],
            'usage': limits.usage_snapshot(email, device_id),
        })

    plan_cfg = limits.plan_config(verdict['plan'])

    if image:
        image_url = upload_image(image)
        caption = hf_caption(image_url)
        photo_mood = image_mood_prompt(image)

        if caption:
            source_note = caption
            text = f'{caption}. {text}'.strip() if text else caption
        elif photo_mood:
            source_note = 'Настроение снимка считано по свету и цветам'
            if not text:
                text = 'music inspired by this photograph'
        elif not text:
            return respond(400, {
                'error': 'Не удалось прочитать изображение, добавьте описание словами'
            })

    if len(text) < 4 and not str(body.get('lyrics') or '').strip():
        return respond(400, {'error': 'Опишите музыку подробнее'})

    duration = int(body.get('duration') or 47)
    duration = max(10, min(plan_cfg['maxSeconds'], duration))

    built = build_prompt(
        text,
        str(body.get('style') or ''),
        str(body.get('mood') or ''),
        wants_vocal,
        str(body.get('lyrics') or ''),
    )
    full_prompt = built['prompt']
    final_style = built['style']

    if photo_mood:
        full_prompt = f'{full_prompt}, {photo_mood}'

    meta = {
        'email': email,
        'deviceId': device_id,
        'title': str(body.get('title') or ''),
        'prompt': text,
        'style': final_style,
        'mood': str(body.get('mood') or ''),
        'imageUrl': image_url,
        'seconds': duration,
    }

    if wants_vocal:
        if not vocal_token():
            return respond(503, {
                'error': 'Песни со словами пока недоступны: не подключён движок с вокалом. '
                         'Снимите флажок «С текстом», чтобы создать инструментал.',
                'needVocalEngine': True,
            })
        vocal_seconds = limits.vocal_duration(duration)
        meta['seconds'] = vocal_seconds

        started = vocal_start(
            text,
            built['styleLine'] or final_style,
            text[:60] or 'Песня',
            str(body.get('voice') or 'any'),
            str(body.get('lyrics') or '').strip(),
            vocal_seconds,
        )
        if started.get('error'):
            print(f'[vocal] start failed: {started["error"]}')
            return respond(502, {
                'error': 'Движок с вокалом не принял запрос. Проверьте баланс и ключ доступа.'
            })

        limits.log_generation(email, device_id, 'vocal', 'suno', vocal_seconds)

        return respond(200, {
            'id': f'vocal:{started["taskId"]}',
            'status': 'processing',
            'engine': 'vocal',
            'caption': source_note,
            'prompt': text,
            'style': final_style,
            'seconds': vocal_seconds,
            'imageUrl': image_url if image else None,
            'usage': limits.usage_snapshot(email, device_id),
        })

    audio = hf_generate_music(full_prompt, duration)
    if audio:
        store_track(audio, meta, 'hf')
        limits.log_generation(email, device_id, 'free', 'huggingface', duration)
        return respond(200, {
            'id': f'hf-{int(time.time())}',
            'status': 'succeeded',
            'audio': audio,
            'engine': 'huggingface',
            'caption': source_note,
            'prompt': text,
            'style': final_style,
            'seconds': duration,
            'imageUrl': image_url if image else None,
            'usage': limits.usage_snapshot(email, device_id),
        })

    limits.log_generation(email, device_id, 'free', 'browser', duration)

    return respond(200, {
        'id': f'local-{int(time.time())}',
        'status': 'local',
        'engine': 'browser',
        'audio': None,
        'caption': source_note,
        'prompt': full_prompt,
        'style': final_style,
        'seconds': duration,
        'imageUrl': image_url if image else None,
        'usage': limits.usage_snapshot(email, device_id),
    })


def store_track(audio: str, meta: Dict[str, Any], prediction_id: str) -> None:
    db.ensure_schema()
    db.save_track({
        'user_email': meta.get('email', ''),
        'title': meta.get('title', ''),
        'prompt': meta.get('prompt', ''),
        'style': meta.get('style', ''),
        'mood': meta.get('mood', ''),
        'audio_url': audio,
        'image_url': meta.get('imageUrl'),
        'from_photo': bool(meta.get('imageUrl')),
        'duration_seconds': int(meta.get('seconds') or 0),
        'prediction_id': prediction_id,
    })
    if meta.get('email'):
        db.bump_usage(meta['email'])


def handle_status(prediction_id: str, meta: Dict[str, Any]) -> Dict[str, Any]:
    """Отдаёт состояние генерации и ссылку на готовый трек."""
    if prediction_id.startswith('vocal:'):
        task_id = prediction_id.split(':', 1)[1]
        state = vocal_result(task_id)
        if state['status'] == 'succeeded':
            file = requests.get(state['audio'], timeout=180)
            audio = upload_file('tracks', 'mp3', file.content, 'audio/mpeg')
            store_track(audio, meta, prediction_id)
            return respond(200, {
                'id': prediction_id,
                'status': 'succeeded',
                'audio': audio,
                'error': None,
            })
        return respond(200, {
            'id': prediction_id,
            'status': 'failed' if state['status'] == 'failed' else 'processing',
            'audio': None,
            'error': state.get('error'),
        })

    return respond(200, {
        'id': prediction_id,
        'status': 'local',
        'audio': None,
        'error': None,
    })


def handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Генерация музыки по текстовому запросу или по фотографии через открытые модели."""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'isBase64Encoded': False, 'body': ''}

    params = event.get('queryStringParameters') or {}

    if method == 'GET':
        if params.get('list') == 'tracks':
            db.ensure_schema()
            return respond(200, {'tracks': db.list_tracks(params.get('email') or '')})

        if params.get('list') == 'showcase':
            db.ensure_schema()
            return respond(200, {'tracks': db.showcase_tracks(12)})

        if params.get('list') == 'usage':
            db.ensure_schema()
            return respond(200, limits.usage_snapshot(
                str(params.get('email') or '').strip().lower(),
                str(params.get('deviceId') or '').strip()[:64],
            ))

        prediction_id = params.get('id')
        if not prediction_id:
            return respond(400, {'error': 'Не указан идентификатор генерации'})
        try:
            return handle_status(prediction_id, {
                'email': params.get('email') or '',
                'title': params.get('title') or '',
                'prompt': params.get('prompt') or '',
                'style': params.get('style') or '',
                'mood': params.get('mood') or '',
                'imageUrl': params.get('imageUrl'),
                'seconds': params.get('seconds') or 0,
            })
        except ProviderError as e:
            return respond(e.status, {'error': e.message})

    if method == 'POST':
        body = json.loads(event.get('body') or '{}')
        if body.get('action') == 'publish':
            db.ensure_schema()
            db.set_public(
                str(body.get('trackId')), str(body.get('email') or ''), bool(body.get('public'))
            )
            return respond(200, {'ok': True})

        if body.get('action') == 'like':
            db.ensure_schema()
            db.add_like(str(body.get('trackId')))
            return respond(200, {'ok': True})

        if body.get('action') == 'profile':
            db.ensure_schema()
            return respond(200, {'user': db.upsert_user(
                str(body.get('email') or ''),
                str(body.get('name') or ''),
                str(body.get('plan') or 'free'),
            )})
        if body.get('action') == 'saveLocal':
            audio_b64 = str(body.get('audio') or '')
            if not audio_b64:
                return respond(400, {'error': 'Пустой аудиофайл'})
            raw = base64.b64decode(audio_b64.split(',', 1)[-1])
            url = upload_file('tracks', 'wav', raw, 'audio/wav')
            store_track(url, {
                'email': str(body.get('email') or ''),
                'title': str(body.get('title') or ''),
                'prompt': str(body.get('prompt') or ''),
                'style': str(body.get('style') or ''),
                'mood': str(body.get('mood') or ''),
                'imageUrl': body.get('imageUrl'),
                'seconds': int(body.get('seconds') or 0),
            }, f'local-{int(time.time())}')
            return respond(200, {'audio': url})

        try:
            return handle_start(body)
        except ProviderError as e:
            return respond(e.status, {'error': e.message})

    return respond(405, {'error': 'Метод не поддерживается'})
import base64
import json
import os
import time
from typing import Any, Dict, Optional

import requests

import db
from storage import upload_file

REPLICATE_API = 'https://api.replicate.com/v1'
MUSIC_MODEL = os.environ.get('MUSIC_MODEL', 'stackadoc/stable-audio-open-1.0')
CAPTION_MODEL = os.environ.get('CAPTION_MODEL', 'salesforce/blip')

VOCAL_API_URL = os.environ.get('VOCAL_API_URL', 'https://gptunnel.ru/v1/suno/generate')
VOCAL_MODEL = os.environ.get('VOCAL_MODEL', 'suno-v5')

HF_API = 'https://api-inference.huggingface.co/models'
HF_MUSIC_MODEL = os.environ.get('HF_MUSIC_MODEL', 'facebook/musicgen-small')
HF_CAPTION_MODEL = os.environ.get('HF_CAPTION_MODEL', 'Salesforce/blip-image-captioning-base')

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


def token() -> Optional[str]:
    return os.environ.get('REPLICATE_API_TOKEN')


def headers() -> Dict[str, str]:
    return {'Authorization': f'Token {token()}', 'Content-Type': 'application/json'}


def latest_version(model: str) -> str:
    r = requests.get(f'{REPLICATE_API}/models/{model}', headers=headers(), timeout=15)
    if r.status_code >= 400:
        raise provider_message(r.status_code, r.text)
    return r.json()['latest_version']['id']


class ProviderError(Exception):
    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.message = message
        self.status = status


def provider_message(status_code: int, text: str) -> ProviderError:
    if status_code == 402 or 'Insufficient credit' in text:
        return ProviderError(
            'На балансе сервиса генерации закончились средства. '
            'Пополните счёт Replicate — после этого генерация заработает.',
            402,
        )
    if status_code in (401, 403):
        return ProviderError('Ключ доступа к сервису генерации недействителен.', 401)
    if status_code == 429:
        return ProviderError('Сервис генерации перегружен. Попробуйте через минуту.', 429)
    return ProviderError('Сервис генерации временно недоступен. Попробуйте позже.', 502)


def start_prediction(model: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    body = {'version': latest_version(model), 'input': payload}
    r = requests.post(f'{REPLICATE_API}/predictions', headers=headers(), json=body, timeout=20)
    if r.status_code >= 400:
        raise provider_message(r.status_code, r.text)
    return r.json()


def upload_image(data_url: str) -> str:
    raw = data_url.split(',', 1)[-1]
    binary = base64.b64decode(raw)
    ext = 'png'
    if 'image/jpeg' in data_url or 'image/jpg' in data_url:
        ext = 'jpg'
    elif 'image/webp' in data_url:
        ext = 'webp'
    return upload_file('images', ext, binary, f'image/{ext}')


def describe_image(image_url: str) -> str:
    started = start_prediction(CAPTION_MODEL, {'image': image_url, 'task': 'image_captioning'})
    prediction_url = started['urls']['get']
    for _ in range(24):
        time.sleep(1)
        r = requests.get(prediction_url, headers=headers(), timeout=15)
        data = r.json()
        if data['status'] == 'succeeded':
            out = data.get('output')
            if isinstance(out, list):
                out = ' '.join(str(x) for x in out)
            text = str(out or '').replace('Caption:', '').strip()
            return text
        if data['status'] in ('failed', 'canceled'):
            return ''
    return ''


def vocal_token() -> Optional[str]:
    return os.environ.get('VOCAL_API_KEY')


def vocal_generate(prompt: str, style: str, title: str) -> Optional[str]:
    """Генерирует песню с вокалом и текстом через российский шлюз к Suno."""
    key = vocal_token()
    if not key:
        return None

    try:
        r = requests.post(
            VOCAL_API_URL,
            headers={'Authorization': key, 'Content-Type': 'application/json'},
            json={
                'model': VOCAL_MODEL,
                'prompt': prompt,
                'tags': style,
                'title': title[:60] or 'Трек',
                'customMode': False,
                'instrumental': False,
                'make_instrumental': False,
            },
            timeout=240,
        )
        if r.status_code >= 400:
            return None
        data = r.json()
    except (requests.RequestException, ValueError):
        return None

    audio = None
    if isinstance(data, dict):
        for key_name in ('audio_url', 'audioUrl', 'url', 'audio'):
            if data.get(key_name):
                audio = data[key_name]
                break
        if not audio:
            items = data.get('data') or data.get('clips') or data.get('result')
            if isinstance(items, list) and items:
                first = items[0]
                if isinstance(first, dict):
                    audio = first.get('audio_url') or first.get('audioUrl') or first.get('url')
                elif isinstance(first, str):
                    audio = first
    if not audio:
        return None

    try:
        file = requests.get(str(audio), timeout=120)
        if file.status_code >= 400:
            return None
        return upload_file('tracks', 'mp3', file.content, 'audio/mpeg')
    except requests.RequestException:
        return None


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
    tok = hf_token()
    if not tok:
        return ''
    try:
        img = requests.get(image_url, timeout=30).content
        r = requests.post(
            f'{HF_API}/{HF_CAPTION_MODEL}',
            headers={'Authorization': f'Bearer {tok}'},
            data=img,
            timeout=120,
        )
        if r.status_code >= 400:
            return ''
        out = r.json()
        if isinstance(out, list) and out:
            return str(out[0].get('generated_text', '')).strip()
    except (requests.RequestException, ValueError):
        return ''
    return ''


def build_prompt(text: str, style: str, mood: str, vocal: bool) -> str:
    parts = [text.strip()]
    if style:
        parts.append(style)
    if mood:
        parts.append(mood)
    parts.append('vocals' if vocal else 'instrumental')
    parts.append('high quality, clean mix')
    return ', '.join(p for p in parts if p)


def handle_start(body: Dict[str, Any]) -> Dict[str, Any]:
    """Запускает генерацию музыки по тексту или по загруженному фото."""
    text = (body.get('prompt') or '').strip()
    image = body.get('image') or ''
    source_note = ''
    image_url = None

    if image:
        image_url = upload_image(image)
        caption = hf_caption(image_url)
        if not caption and token():
            caption = describe_image(image_url)
        if caption:
            source_note = caption
            text = f'{caption}. {text}'.strip() if text else caption
        elif not text:
            return respond(400, {'error': 'Не удалось прочитать изображение, добавьте описание словами'})

    if len(text) < 4:
        return respond(400, {'error': 'Опишите музыку подробнее'})

    duration = int(body.get('duration') or 47)
    duration = max(10, min(47, duration))

    full_prompt = build_prompt(
        text,
        str(body.get('style') or ''),
        str(body.get('mood') or ''),
        bool(body.get('vocal')),
    )

    meta = {
        'email': str(body.get('email') or ''),
        'title': str(body.get('title') or ''),
        'prompt': text,
        'style': str(body.get('style') or ''),
        'mood': str(body.get('mood') or ''),
        'imageUrl': image_url,
        'seconds': duration,
    }

    wants_vocal = bool(body.get('vocal'))

    if wants_vocal:
        if not vocal_token():
            return respond(503, {
                'error': 'Песни со словами пока недоступны: не подключён движок с вокалом. '
                         'Снимите флажок «С текстом», чтобы создать инструментал.',
                'needVocalEngine': True,
            })
        audio = vocal_generate(text, str(body.get('style') or ''), text[:60])
        if audio:
            store_track(audio, meta, f'vocal-{int(time.time())}')
            return respond(200, {
                'id': f'vocal-{int(time.time())}',
                'status': 'succeeded',
                'audio': audio,
                'engine': 'vocal',
                'caption': source_note,
                'prompt': text,
                'imageUrl': image_url if image else None,
            })
        return respond(502, {
            'error': 'Движок с вокалом не ответил. Попробуйте ещё раз через минуту.'
        })

    audio = hf_generate_music(full_prompt, duration)
    if audio:
        store_track(audio, meta, 'hf')
        return respond(200, {
            'id': f'hf-{int(time.time())}',
            'status': 'succeeded',
            'audio': audio,
            'engine': 'huggingface',
            'caption': source_note,
            'prompt': text,
            'imageUrl': image_url if image else None,
        })

    if token():
        try:
            prediction = start_prediction(
                MUSIC_MODEL,
                {
                    'prompt': full_prompt,
                    'seconds_total': duration,
                    'steps': int(body.get('steps') or 100),
                },
            )
            return respond(200, {
                'id': prediction['id'],
                'status': prediction['status'],
                'engine': 'replicate',
                'caption': source_note,
                'prompt': text,
                'imageUrl': image_url if image else None,
            })
        except ProviderError:
            pass

    return respond(200, {
        'id': f'local-{int(time.time())}',
        'status': 'local',
        'engine': 'browser',
        'audio': None,
        'caption': source_note,
        'prompt': full_prompt,
        'imageUrl': image_url if image else None,
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
    if prediction_id.startswith(('local-', 'hf-')):
        return respond(200, {
            'id': prediction_id,
            'status': 'local',
            'audio': None,
            'error': None,
        })

    if not token():
        return respond(200, {
            'id': prediction_id,
            'status': 'local',
            'audio': None,
            'error': None,
        })

    r = requests.get(f'{REPLICATE_API}/predictions/{prediction_id}', headers=headers(), timeout=15)
    if r.status_code >= 400:
        return respond(200, {
            'id': prediction_id,
            'status': 'local',
            'audio': None,
            'error': None,
        })
    data = r.json()
    status = data.get('status')
    audio = None

    if status == 'succeeded':
        out = data.get('output')
        if isinstance(out, list):
            out = out[0] if out else None
        if isinstance(out, dict):
            out = out.get('audio') or out.get('url')
        if out:
            file = requests.get(str(out), timeout=60)
            audio = upload_file('tracks', 'wav', file.content, 'audio/wav')
            store_track(audio, meta, prediction_id)

    return respond(200, {
        'id': prediction_id,
        'status': status,
        'audio': audio,
        'error': data.get('error'),
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
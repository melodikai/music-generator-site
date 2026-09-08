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

    prediction = start_prediction(
        MUSIC_MODEL,
        {
            'prompt': build_prompt(
                text,
                str(body.get('style') or ''),
                str(body.get('mood') or ''),
                bool(body.get('vocal')),
            ),
            'seconds_total': duration,
            'steps': int(body.get('steps') or 100),
        },
    )

    return respond(200, {
        'id': prediction['id'],
        'status': prediction['status'],
        'caption': source_note,
        'prompt': text,
        'imageUrl': image_url if image else None,
    })


def handle_status(prediction_id: str, meta: Dict[str, Any]) -> Dict[str, Any]:
    """Отдаёт состояние генерации и ссылку на готовый трек."""
    r = requests.get(f'{REPLICATE_API}/predictions/{prediction_id}', headers=headers(), timeout=15)
    if r.status_code >= 400:
        return respond(404, {'error': 'Генерация не найдена'})
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
        if not token():
            return respond(503, {'error': 'Генерация временно недоступна: не настроен доступ к движку'})
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
        if not token():
            return respond(503, {'error': 'Генерация временно недоступна: не настроен доступ к движку'})
        try:
            return handle_start(body)
        except ProviderError as e:
            return respond(e.status, {'error': e.message})

    return respond(405, {'error': 'Метод не поддерживается'})
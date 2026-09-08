import base64
import json
import os
import uuid
from typing import Any, Dict, Optional

import boto3
import requests

REPLICATE_API = 'https://api.replicate.com/v1'
STEMS_MODEL = os.environ.get('STEMS_MODEL', 'ryan5453/demucs')

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
}

STEM_NAMES = {
    'vocals': 'Вокал',
    'drums': 'Ударные',
    'bass': 'Бас',
    'other': 'Остальное',
    'guitar': 'Гитара',
    'piano': 'Клавиши',
    'no_vocals': 'Минусовка',
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


def s3_client():
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )


def cdn_url(key: str) -> str:
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"


def upload_audio(data_url: str) -> str:
    raw = data_url.split(',', 1)[-1]
    binary = base64.b64decode(raw)
    ext = 'mp3'
    if 'audio/wav' in data_url or 'audio/x-wav' in data_url:
        ext = 'wav'
    elif 'audio/ogg' in data_url:
        ext = 'ogg'
    elif 'audio/mp4' in data_url or 'audio/m4a' in data_url:
        ext = 'm4a'
    key = f'uploads/{uuid.uuid4().hex}.{ext}'
    s3_client().put_object(Bucket='files', Key=key, Body=binary, ContentType=f'audio/{ext}')
    return cdn_url(key)


def latest_version(model: str) -> str:
    r = requests.get(f'{REPLICATE_API}/models/{model}', headers=headers(), timeout=15)
    r.raise_for_status()
    return r.json()['latest_version']['id']


def handle_start(body: Dict[str, Any]) -> Dict[str, Any]:
    """Запускает разделение трека на отдельные дорожки."""
    audio_url = (body.get('audioUrl') or '').strip()
    upload = body.get('audio')

    if not audio_url and upload:
        audio_url = upload_audio(upload)

    if not audio_url:
        return respond(400, {'error': 'Загрузите аудиофайл или выберите свой трек'})

    payload = {
        'audio': audio_url,
        'stem': body.get('stem') or 'none',
        'output_format': 'mp3',
    }

    r = requests.post(
        f'{REPLICATE_API}/predictions',
        headers=headers(),
        json={'version': latest_version(STEMS_MODEL), 'input': payload},
        timeout=20,
    )
    if r.status_code >= 400:
        return respond(502, {'error': 'Движок разделения недоступен, попробуйте позже'})

    data = r.json()
    return respond(200, {'id': data['id'], 'status': data['status'], 'source': audio_url})


def handle_status(prediction_id: str) -> Dict[str, Any]:
    """Отдаёт состояние разделения и ссылки на готовые дорожки."""
    r = requests.get(f'{REPLICATE_API}/predictions/{prediction_id}', headers=headers(), timeout=15)
    if r.status_code >= 400:
        return respond(404, {'error': 'Задача не найдена'})

    data = r.json()
    stems = []

    if data.get('status') == 'succeeded':
        out = data.get('output') or {}
        if isinstance(out, list):
            out = {f'stem_{i + 1}': v for i, v in enumerate(out)}
        for key, value in out.items():
            if not value or not isinstance(value, str):
                continue
            stems.append({'id': key, 'name': STEM_NAMES.get(key, key), 'url': value})

    return respond(200, {
        'id': prediction_id,
        'status': data.get('status'),
        'stems': stems,
        'error': data.get('error'),
    })


def handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Разделение музыкального трека на дорожки: вокал, ударные, бас и остальное."""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'isBase64Encoded': False, 'body': ''}

    params = event.get('queryStringParameters') or {}

    if method == 'GET':
        prediction_id = params.get('id')
        if not prediction_id:
            return respond(400, {'error': 'Не указан идентификатор задачи'})
        if not token():
            return respond(503, {'error': 'Разделение временно недоступно: не настроен доступ'})
        return handle_status(prediction_id)

    if not token():
        return respond(503, {'error': 'Разделение временно недоступно: не настроен доступ'})

    if method == 'POST':
        return handle_start(json.loads(event.get('body') or '{}'))

    return respond(405, {'error': 'Метод не поддерживается'})

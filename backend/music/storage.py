import os
import uuid
from typing import Optional

import boto3
import requests

DISK_API = 'https://cloud-api.yandex.net/v1/disk/resources'
ROOT_FOLDER = os.environ.get('YANDEX_DISK_FOLDER', 'app:/zvuchi')


def disk_token() -> Optional[str]:
    return os.environ.get('YANDEX_DISK_TOKEN')


def _disk_headers() -> dict:
    return {'Authorization': f'OAuth {disk_token()}'}


def _ensure_folder(path: str) -> None:
    requests.put(f'{DISK_API}?path={path}', headers=_disk_headers(), timeout=15)


def _publish(path: str) -> Optional[str]:
    requests.put(f'{DISK_API}/publish?path={path}', headers=_disk_headers(), timeout=15)
    meta = requests.get(
        f'{DISK_API}?path={path}&fields=public_url,file', headers=_disk_headers(), timeout=15
    )
    if meta.status_code >= 400:
        return None
    data = meta.json()
    return data.get('file') or data.get('public_url')


def upload_to_disk(folder: str, filename: str, body: bytes) -> Optional[str]:
    if not disk_token():
        return None

    _ensure_folder(ROOT_FOLDER)
    target_folder = f'{ROOT_FOLDER}/{folder}'
    _ensure_folder(target_folder)
    path = f'{target_folder}/{filename}'

    link = requests.get(
        f'{DISK_API}/upload?path={path}&overwrite=true', headers=_disk_headers(), timeout=15
    )
    if link.status_code >= 400:
        return None

    href = link.json().get('href')
    if not href:
        return None

    put = requests.put(href, data=body, timeout=120)
    if put.status_code >= 400:
        return None

    return _publish(path)


def _s3():
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )


def upload_file(folder: str, ext: str, body: bytes, content_type: str) -> str:
    filename = f'{uuid.uuid4().hex}.{ext}'

    disk_url = upload_to_disk(folder, filename, body)
    if disk_url:
        return disk_url

    key = f'{folder}/{filename}'
    _s3().put_object(Bucket='files', Key=key, Body=body, ContentType=content_type)
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"

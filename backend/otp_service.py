import hashlib
import json
import os
import random
import string
import time
import uuid
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
STORE_PATH = BASE_DIR / "otp_store.json"
DELIVERY_LOG_PATH = BASE_DIR / "otp_delivery.log"
OTP_TTL_SECONDS = 300
SESSION_TTL_SECONDS = 600


def _load_store():
    if not STORE_PATH.exists():
        return {"codes": {}, "sessions": {}}

    try:
        with STORE_PATH.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except Exception:
        return {"codes": {}, "sessions": {}}


def _save_store(store):
    os.makedirs(BASE_DIR, exist_ok=True)
    with STORE_PATH.open("w", encoding="utf-8") as handle:
        json.dump(store, handle, indent=2, sort_keys=True)


def _cleanup(now=None):
    if now is None:
        now = time.time()

    store = _load_store()
    store.setdefault("codes", {})
    store.setdefault("sessions", {})

    cleaned_codes = {}
    for user_id, data in store["codes"].items():
        if data.get("expires_at", 0) > now:
            cleaned_codes[user_id] = data

    cleaned_sessions = {}
    for token, data in store["sessions"].items():
        if data.get("expires_at", 0) > now:
            cleaned_sessions[token] = data

    store["codes"] = cleaned_codes
    store["sessions"] = cleaned_sessions
    _save_store(store)


def _hash_value(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _generate_code():
    return "".join(random.choices(string.digits, k=6))


def _deliver_sms(phone_no, code):
    try:
        from twilio.rest import Client

        account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        from_number = os.getenv("TWILIO_FROM_NUMBER")

        if not all([account_sid, auth_token, from_number]):
            raise RuntimeError("Twilio environment variables are not configured")

        client = Client(account_sid, auth_token)
        client.messages.create(body=f"Your Rainbow ERP verification code is {code}", from_=from_number, to=phone_no)
        return True
    except Exception:
        with DELIVERY_LOG_PATH.open("a", encoding="utf-8") as handle:
            handle.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] OTP {code} sent to {phone_no} via fallback log\n")
        print(f"[OTP DELIVERY FALLBACK] OTP {code} would be sent to {phone_no}")
        return True


def create_otp_request(user_id, phone_no):
    _cleanup()

    code = _generate_code()
    store = _load_store()
    store.setdefault("codes", {})

    store["codes"][str(user_id)] = {
        "code_hash": _hash_value(code),
        "phone_no": phone_no,
        "expires_at": time.time() + OTP_TTL_SECONDS,
    }

    _save_store(store)
    _deliver_sms(phone_no, code)
    return code


def verify_otp_code(user_id, code):
    _cleanup()

    store = _load_store()
    record = store.get("codes", {}).get(str(user_id))
    if not record:
        raise ValueError("OTP expired or invalid")

    if record.get("expires_at", 0) < time.time():
        store["codes"].pop(str(user_id), None)
        _save_store(store)
        raise ValueError("OTP expired or invalid")

    if record.get("code_hash") != _hash_value(code):
        raise ValueError("OTP is incorrect")

    store["codes"].pop(str(user_id), None)
    session_token = str(uuid.uuid4())
    store.setdefault("sessions", {})
    store["sessions"][session_token] = {
        "user_id": str(user_id),
        "target_phone": record.get("phone_no"),
        "expires_at": time.time() + SESSION_TTL_SECONDS,
    }
    _save_store(store)
    return session_token


def consume_verification_session(user_id, session_token):
    _cleanup()

    store = _load_store()
    session = store.get("sessions", {}).get(session_token)
    if not session:
        return None

    if session.get("user_id") != str(user_id):
        return None

    if session.get("expires_at", 0) < time.time():
        store["sessions"].pop(session_token, None)
        _save_store(store)
        return None

    store["sessions"].pop(session_token, None)
    _save_store(store)
    return session

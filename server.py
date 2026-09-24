"""
Kindred local server — static files + PayHero M-Pesa STK proxy.
Secrets stay in .env (never exposed to the browser).

Run:  python server.py
Open: http://127.0.0.1:8765
"""

from __future__ import annotations

import json
import os
import re
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
ENV_PATH = ROOT / ".env"
PAYHERO_PAYMENTS = "https://backend.payhero.co.ke/api/v2/payments"


def load_env() -> None:
    if not ENV_PATH.exists():
        return
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def normalize_phone(raw: str) -> str | None:
    digits = re.sub(r"\D", "", raw or "")
    if digits.startswith("254") and len(digits) == 12:
        digits = "0" + digits[3:]
    if digits.startswith("7") and len(digits) == 9:
        digits = "0" + digits
    if re.fullmatch(r"0[17]\d{8}", digits):
        return digits
    return None


def json_response(handler: SimpleHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


def initiate_stk(amount: int, phone: str, name: str, cause: str) -> tuple[int, dict]:
    auth = os.environ.get("PAYHERO_BASIC_AUTH", "").strip()
    channel = os.environ.get("PAYHERO_CHANNEL_ID", "").strip()
    if not auth or not channel:
        return 500, {
            "success": False,
            "message": "PayHero is not configured. Add credentials to .env and restart the server.",
        }

    reference = f"KINDRED-{cause or 'gift'}-{uuid.uuid4().hex[:10].upper()}"
    payload = {
        "amount": amount,
        "phone_number": phone,
        "channel_id": int(channel),
        "provider": "m-pesa",
        "external_reference": reference,
        "customer_name": name or "Kindred donor",
    }
    callback = os.environ.get("PAYHERO_CALLBACK_URL", "").strip()
    if callback:
        payload["callback_url"] = callback

    req = Request(
        PAYHERO_PAYMENTS,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": auth,
            "Content-Type": "application/json",
            "User-Agent": "KindredDonate/1.0",
        },
        method="POST",
    )

    try:
        with urlopen(req, timeout=45) as resp:
            raw = resp.read().decode("utf-8")
            data = json.loads(raw) if raw else {}
            return resp.status, {
                "success": True,
                "message": "STK push sent. Enter your M-Pesa PIN on your phone.",
                "reference": reference,
                "payhero": data,
            }
    except HTTPError as err:
        raw = err.read().decode("utf-8", errors="replace")
        try:
            data = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            data = {"error_message": raw or str(err)}
        message = (
            data.get("error_message")
            or data.get("message")
            or f"PayHero error ({err.code})"
        )
        if "insufficient balance" in message.lower():
            message = (
                "PayHero merchant wallet has insufficient balance. "
                "Top up the service wallet in PayHero, then try again."
            )
        return err.code, {"success": False, "message": message, "payhero": data}
    except URLError as err:
        return 502, {"success": False, "message": f"Could not reach PayHero: {err.reason}"}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt: str, *args) -> None:
        print(f"[kindred] {self.address_string()} - {fmt % args}")

    def do_OPTIONS(self) -> None:
        if self.path.startswith("/api/"):
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            return
        self.send_error(404)

    def do_POST(self) -> None:
        if self.path.rstrip("/") == "/api/payhero/stk":
            length = int(self.headers.get("Content-Length") or 0)
            try:
                body = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
            except json.JSONDecodeError:
                json_response(self, 400, {"success": False, "message": "Invalid JSON body."})
                return

            try:
                amount = int(body.get("amount"))
            except (TypeError, ValueError):
                amount = 0
            phone = normalize_phone(str(body.get("phone") or body.get("mpesaPhone") or ""))
            name = str(body.get("name") or "").strip()[:80]
            cause = re.sub(r"[^a-z0-9_-]", "", str(body.get("cause") or "gift").lower())[:32]

            if amount < 100:
                json_response(self, 400, {"success": False, "message": "Minimum donation is KSh 100."})
                return
            if not phone:
                json_response(self, 400, {"success": False, "message": "Enter a valid Safaricom M-Pesa number."})
                return

            status, payload = initiate_stk(amount, phone, name, cause)
            json_response(self, status if status >= 400 else 200, payload)
            return

        if self.path.rstrip("/") == "/api/payhero/callback":
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length).decode("utf-8", errors="replace")
            print(f"[kindred] PayHero callback: {raw}")
            json_response(self, 200, {"ok": True})
            return

        self.send_error(404)

    def end_headers(self) -> None:
        if self.path.startswith("/api/"):
            self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()


def main() -> None:
    load_env()
    port = int(os.environ.get("PORT") or 8765)
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Kindred + PayHero running at http://127.0.0.1:{port}")
    print("STK endpoint: POST /api/payhero/stk")
    server.serve_forever()


if __name__ == "__main__":
    main()

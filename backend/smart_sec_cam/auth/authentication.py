import datetime
import os
import jwt
import logging
from smart_sec_cam.auth.database import AuthDatabase

logger = logging.getLogger(__name__)

class Authenticator:
    JWT_SECRET_LENGTH = 24
    TOKEN_DURATION_HOURS = 1

    def __init__(self, auth_db: AuthDatabase):
        self.auth_db = auth_db
        self.secret = os.urandom(self.JWT_SECRET_LENGTH)

    def authenticate(self, username: str, password: str, client_ip_addr: str) -> str:
        existing_user = self.auth_db.get_user_by_username(username)
        if not existing_user:
            raise ValueError(f"Failed to find user with username: {username}")
        if not existing_user.does_password_match(password):
            raise ValueError(f"Password mismatch for user: {username}")
        return self._generate_token(existing_user.user_id, client_ip_addr)

    def validate_token(self, token: str, client_ip_addr: str) -> bool:
        try:
            payload = jwt.decode(token, self.secret, algorithms=['HS256'])
            is_valid = (
                payload['exp'] > datetime.datetime.utcnow().timestamp()
                and payload['client_ip'] == client_ip_addr
            )
            if not is_valid:
                logger.warning("Token validation failed: Exp=%s, IP=%s", payload['exp'], payload['client_ip'])
            return is_valid
        except jwt.ExpiredSignatureError:
            logger.warning("Token expired.")
            return False
        except jwt.InvalidTokenError as e:
            logger.warning("Invalid token: %s", e)
            return False

    def refresh_token(self, token: str, client_ip_addr: str) -> str:
        try:
            if self.validate_token(token, client_ip_addr):
                payload = jwt.decode(token, self.secret, algorithms=['HS256'])
                return self._generate_token(payload['sub'], client_ip_addr)
        except jwt.InvalidTokenError as e:
            logger.warning("Failed to refresh token: %s", e)
        return None

    def get_token_ttl(self, token: str) -> float:
        try:
            payload = jwt.decode(token, self.secret, algorithms=['HS256'])
            return payload['exp'] - datetime.datetime.utcnow().timestamp()
        except jwt.InvalidTokenError as e:
            logger.warning("Failed to get token TTL: %s", e)
            return -1

    def _generate_token(self, user_id: str, client_ip_addr: str) -> str:
        payload = {
            'exp': (datetime.datetime.utcnow() + datetime.timedelta(hours=self.TOKEN_DURATION_HOURS)).timestamp(),
            'iat': datetime.datetime.utcnow().timestamp(),
            'sub': user_id,
            'client_ip': client_ip_addr
        }
        return jwt.encode(payload, self.secret, algorithm='HS256')

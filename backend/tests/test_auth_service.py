"""
Tests for authentication service, password hashing, and JWT tokens.
"""

from app.services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)


def test_password_hashing_and_verification():
    password = "SuperSecretPassword123!"
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_jwt_token_creation_and_decoding():
    payload = {"sub": "user_id_456", "username": "tester", "role": "OPERATOR"}
    token = create_access_token(payload)
    assert isinstance(token, str)
    assert len(token) > 20

    decoded = decode_access_token(token)
    assert decoded["sub"] == "user_id_456"
    assert decoded["username"] == "tester"
    assert decoded["role"] == "OPERATOR"
    assert "exp" in decoded


def test_tampered_token_fails():
    token = create_access_token({"sub": "user_1"})
    tampered = token[:-4] + "abcd"
    decoded = decode_access_token(tampered)
    assert decoded is None

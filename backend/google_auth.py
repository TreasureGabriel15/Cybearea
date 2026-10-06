def verify_google_token(credential, client_id):
    """Checks a Google ID token with Google's public keys. Raises ValueError if it is not valid.
    Needs the google-auth package and internet access."""
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token

    return id_token.verify_oauth2_token(credential, google_requests.Request(), client_id)

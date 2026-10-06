class ApiError(Exception):
    """Raise this anywhere in a route to send a clean JSON error."""

    def __init__(self, status, message, code="error"):
        super().__init__(message)
        self.status = status
        self.message = message
        self.code = code

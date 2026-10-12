from flask import jsonify

def problem(status: int, title: str, detail: str, type_suffix: str = None):
    """
    Standard RFC-7807 Problem Details representation.
    Produces: type, title, status, and detail.
    """
    type_uri = f"https://agrirent.in/errors/{type_suffix or title.lower().replace(' ', '-')}"
    payload = {
        "type": type_uri,
        "title": title,
        "status": status,
        "detail": detail
    }
    response = jsonify(payload)
    response.status_code = status
    response.headers["Content-Type"] = "application/problem+json"
    return response
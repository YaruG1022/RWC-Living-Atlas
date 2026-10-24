"""Validate non-destructive per-image framing."""
import json
import math
from fastapi import HTTPException


def parse_presentation(value):
    try:
        data = json.loads(value) if isinstance(value, str) else value
        if not isinstance(data, dict) or data.get('fit', 'cover') not in ('cover', 'contain'):
            raise ValueError()
        result = {'fit': data.get('fit', 'cover')}
        for key, default, low, high in [('x', 50, 0, 100), ('y', 50, 0, 100), ('zoom', 1, 1, 3)]:
            number = data.get(key, default)
            if isinstance(number, bool) or not isinstance(number, (int, float)) or not math.isfinite(number) or not low <= number <= high:
                raise ValueError()
            result[key] = number
        return result
    except (ValueError, TypeError):
        raise HTTPException(422, 'Invalid image framing. Use Fill or Full image, position 0–100 and zoom 1–3.')

"""
atlas_summary.py — GET /atlas/summary and /atlas/summary/*

Read-only, non-sensitive summary endpoints consumed by the external RWC Living
Atlas Helper Chatbot service.

These serve the facts that *change over time* — the card taxonomy (categories
and tags), the ArcGIS folder/service inventory, and overall counts — so the
chatbot no longer has to keep them hardcoded in its markdown knowledge base.
The markdown docs are for stable explanations (how a feature works, what a term
means); anything countable or enumerable belongs here instead.

Each endpoint returns a ready-to-inject ``context`` text block alongside the
structured data, matching the shape the chatbot already consumes from
/cards/summary.

Security: these queries touch only public card columns and the ArcGIS catalog.
They never join Users and never expose usernames, emails, or credentials, and
uploader-only (private) cards are excluded.
"""

import time
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query

from database import get_connection

atlas_summary_router = APIRouter(prefix="/atlas", tags=["atlas-summary"])

# Summaries are aggregate counts that change slowly; a short TTL keeps the
# chatbot from re-running these aggregates on every question.
_CACHE_TTL_SECONDS = 60
_cache: dict[str, tuple[float, Any]] = {}

_STATE_MAP = {
    "wa": "washington",
    "washington": "washington",
    "id": "idaho",
    "idaho": "idaho",
    "or": "oregon",
    "oregon": "oregon",
}

# How many entries to list before collapsing the tail into "+N more". Keeps the
# context block small enough to sit inside the chatbot's system prompt.
_MAX_TAGS = 40
_MAX_FOLDERS_PER_STATE = 25


def _normalize_state(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    key = value.strip().lower()
    return _STATE_MAP.get(key, key)


def _cached(key: str, producer):
    """Return producer() memoized for _CACHE_TTL_SECONDS."""
    now = time.time()
    hit = _cache.get(key)
    if hit and now - hit[0] < _CACHE_TTL_SECONDS:
        return hit[1]
    value = producer()
    _cache[key] = (now, value)
    return value


def _fetch_all(sql: str, params: tuple = ()) -> list[tuple]:
    connection = get_connection()
    if connection is None:
        raise HTTPException(status_code=503, detail="Database connection unavailable")
    with connection.cursor() as local_cur:
        local_cur.execute(sql, params)
        return local_cur.fetchall()


def _plural(count: int, noun: str) -> str:
    return f"{count} {noun}" if count == 1 else f"{count} {noun}s"


def _format_counts(pairs, limit: int) -> str:
    """Render [(label, count), ...] as 'A (3), B (2), +5 more'."""
    shown = [f"{label} ({count})" for label, count in pairs[:limit]]
    remainder = len(pairs) - limit
    if remainder > 0:
        shown.append(f"+{remainder} more")
    return ", ".join(shown)


# ---------------------------------------------------------------------------
# Taxonomy — card categories and tag vocabulary
# ---------------------------------------------------------------------------
def build_taxonomy() -> dict:
    """Live category and tag vocabulary, with public-card usage counts."""
    category_rows = _fetch_all(
        """
        SELECT cat.CategoryLabel,
               COUNT(c.CardID) FILTER (WHERE c.is_public IS NOT FALSE)
        FROM Categories cat
        LEFT JOIN Cards c ON c.CategoryID = cat.CategoryID
        GROUP BY cat.CategoryLabel
        ORDER BY 2 DESC, cat.CategoryLabel
        """
    )
    tag_rows = _fetch_all(
        """
        SELECT t.TagLabel,
               COUNT(ct.CardID) FILTER (WHERE c.is_public IS NOT FALSE)
        FROM Tags t
        LEFT JOIN CardTags ct ON ct.TagID = t.TagID
        LEFT JOIN Cards c ON c.CardID = ct.CardID
        GROUP BY t.TagLabel
        ORDER BY 2 DESC, t.TagLabel
        """
    )
    location_rows = _fetch_all(
        """
        SELECT COALESCE(LocationType, 'point'), COUNT(*)
        FROM Cards
        WHERE is_public IS NOT FALSE
        GROUP BY COALESCE(LocationType, 'point')
        ORDER BY 2 DESC
        """
    )

    categories = [{"label": label, "public_cards": count} for label, count in category_rows]
    tags = [{"label": label, "public_cards": count} for label, count in tag_rows]
    location_types = [{"type": name, "public_cards": count} for name, count in location_rows]

    lines = ["Card taxonomy (live from the Living Atlas database):"]
    if category_rows:
        lines.append(
            "Categories (a card has exactly one): "
            + _format_counts(category_rows, len(category_rows))
        )
    if location_rows:
        lines.append("Location types: " + _format_counts(location_rows, len(location_rows)))
    if tag_rows:
        lines.append(
            f"Tags ({len(tag_rows)} defined; a card may have several): "
            + _format_counts(tag_rows, _MAX_TAGS)
        )

    return {
        "context": "\n".join(lines),
        "categories": categories,
        "tags": tags,
        "location_types": location_types,
    }


@atlas_summary_router.get("/summary/taxonomy")
def taxonomy_summary():
    return _cached("taxonomy", build_taxonomy)


# ---------------------------------------------------------------------------
# ArcGIS catalog — per-state service and folder inventory
# ---------------------------------------------------------------------------
def build_arcgis_summary(state: Optional[str] = None) -> dict:
    """Live per-state ArcGIS service counts, host, types, and folder breakdown."""
    norm_state = _normalize_state(state)
    where_sql = "WHERE LOWER(state) = %s" if norm_state else ""
    params: tuple = (norm_state,) if norm_state else ()

    state_rows = _fetch_all(
        f"""
        SELECT LOWER(state),
               MIN(split_part(url, '/', 3)) AS host,
               COUNT(*)
        FROM arcgis_services
        {where_sql}
        GROUP BY LOWER(state)
        ORDER BY 3 DESC
        """,
        params,
    )
    type_rows = _fetch_all(
        f"""
        SELECT LOWER(state), type, COUNT(*)
        FROM arcgis_services
        {where_sql}
        GROUP BY LOWER(state), type
        ORDER BY 3 DESC
        """,
        params,
    )
    folder_rows = _fetch_all(
        f"""
        SELECT LOWER(state), COALESCE(folder, 'Root'), COUNT(*)
        FROM arcgis_services
        {where_sql}
        GROUP BY LOWER(state), COALESCE(folder, 'Root')
        ORDER BY 1, 3 DESC
        """,
        params,
    )

    types_by_state: dict[str, list] = {}
    for state_name, type_name, count in type_rows:
        types_by_state.setdefault(state_name, []).append((type_name, count))

    folders_by_state: dict[str, list] = {}
    for state_name, folder, count in folder_rows:
        folders_by_state.setdefault(state_name, []).append((folder, count))

    states = []
    lines = ["ArcGIS catalog summary (live from the Living Atlas database):"]
    for state_name, host, total in state_rows:
        folders = folders_by_state.get(state_name, [])
        types = types_by_state.get(state_name, [])
        states.append({
            "state": state_name,
            "host": host,
            "services": total,
            "types": [{"type": t, "services": c} for t, c in types],
            "folders": [{"folder": f, "services": c} for f, c in folders],
        })

        header = f"{state_name.title()} ({host}) — {_plural(total, 'service')}"
        if types:
            header += " [" + _format_counts(types, len(types)) + "]"
        lines.append(header)
        if folders:
            lines.append(
                f"  {_plural(len(folders), 'folder')}: "
                + _format_counts(folders, _MAX_FOLDERS_PER_STATE)
            )

    if not state_rows:
        lines.append("(no ArcGIS services are currently catalogued)")

    return {"context": "\n".join(lines), "states": states}


@atlas_summary_router.get("/summary/arcgis")
def arcgis_summary(
    state: Optional[str] = Query(None, description="WA|ID|OR or full state name"),
):
    norm_state = _normalize_state(state) or "all"
    return _cached(f"arcgis:{norm_state}", lambda: build_arcgis_summary(state))


# ---------------------------------------------------------------------------
# Stats — overall public counts
# ---------------------------------------------------------------------------
def build_stats() -> dict:
    """Headline counts: public cards, contributing organizations, catalog size."""
    card_rows = _fetch_all(
        """
        SELECT COUNT(*),
               COUNT(DISTINCT NULLIF(TRIM(Organization), '')),
               MIN(DatePosted),
               MAX(DatePosted)
        FROM Cards
        WHERE is_public IS NOT FALSE
        """
    )
    total_cards, total_orgs, first_posted, last_posted = card_rows[0]

    service_rows = _fetch_all(
        "SELECT COUNT(*), COUNT(DISTINCT LOWER(state)) FROM arcgis_services"
    )
    total_services, total_states = service_rows[0]

    lines = [
        "Living Atlas headline numbers (live):",
        f"Public cards: {total_cards}",
        f"Contributing organizations: {total_orgs}",
        f"ArcGIS services catalogued: {total_services} across {total_states} states",
    ]
    if first_posted and last_posted:
        lines.append(f"Cards posted between {first_posted} and {last_posted}")

    return {
        "context": "\n".join(lines),
        "public_cards": total_cards,
        "organizations": total_orgs,
        "arcgis_services": total_services,
        "arcgis_states": total_states,
        "first_card_posted": str(first_posted) if first_posted else None,
        "last_card_posted": str(last_posted) if last_posted else None,
    }


@atlas_summary_router.get("/summary/stats")
def stats_summary():
    return _cached("stats", build_stats)


# ---------------------------------------------------------------------------
# Combined — one call for the chatbot's per-question context
# ---------------------------------------------------------------------------
def build_combined() -> dict:
    """All three blocks in one context string, degrading past any that fail."""
    blocks: list[str] = []
    for name, producer in (
        ("stats", build_stats),
        ("taxonomy", build_taxonomy),
        ("arcgis", build_arcgis_summary),
    ):
        try:
            context = _cached(name if name != "arcgis" else "arcgis:all", producer).get("context", "")
            if context:
                blocks.append(context)
        except Exception as exc:
            print(f"[atlas_summary] {name} block unavailable: {exc}")
    return {"context": "\n\n".join(blocks)}


@atlas_summary_router.get("/summary")
def combined_summary():
    return build_combined()

"""
PubMed connector using NCBI E-utilities.
"""

from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
from typing import Any, Dict, List

import httpx


class PubMedConnector:
    BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"

    async def search(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        async with httpx.AsyncClient(timeout=20.0) as client:
            esearch = await client.get(
                f"{self.BASE_URL}/esearch.fcgi",
                params={
                    "db": "pubmed",
                    "retmode": "json",
                    "sort": "pub_date",
                    "retmax": limit,
                    "term": query,
                },
            )
            esearch.raise_for_status()
            id_list = esearch.json().get("esearchresult", {}).get("idlist", [])
            if not id_list:
                return []

            esummary = await client.get(
                f"{self.BASE_URL}/esummary.fcgi",
                params={
                    "db": "pubmed",
                    "retmode": "json",
                    "id": ",".join(id_list),
                },
            )
            esummary.raise_for_status()
            raw = esummary.json().get("result", {})

        now = datetime.now(timezone.utc)
        items: List[Dict[str, Any]] = []
        for pmid in id_list:
            row = raw.get(str(pmid), {})
            title = row.get("title") or "Untitled publication"
            pubdate = row.get("pubdate")

            published_at = None
            if pubdate:
                parsed = self._try_parse_pubdate(pubdate)
                if parsed:
                    published_at = parsed.isoformat()

            items.append(
                {
                    "claim_id": f"pubmed-{pmid}",
                    "claim_text": f"PubMed entry found for query '{query}': {title}",
                    "query": query,
                    "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                    "source_name": "PubMed",
                    "source_tier": "peer-reviewed",
                    "snippet": title,
                    "published_at": published_at,
                    "fetched_at": now.isoformat(),
                    "hash": sha256(f"pubmed:{pmid}:{title}".encode()).hexdigest(),
                    "document_id": str(pmid),
                }
            )

        return items

    def _try_parse_pubdate(self, value: str) -> datetime | None:
        candidate = (value or "").strip()
        if not candidate:
            return None

        tokens = candidate.split()
        variants = [
            " ".join(tokens[:3]),
            " ".join(tokens[:2]),
            tokens[0],
            candidate,
        ]
        fmts = ["%Y %b %d", "%Y %B %d", "%Y %b", "%Y %B", "%Y"]

        for variant in variants:
            for fmt in fmts:
                try:
                    dt = datetime.strptime(variant, fmt)
                    return dt.replace(tzinfo=timezone.utc)
                except ValueError:
                    continue
        return None

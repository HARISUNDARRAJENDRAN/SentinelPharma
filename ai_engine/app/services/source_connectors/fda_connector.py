"""
FDA connector using openFDA APIs.
"""

from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
from typing import Any, Dict, List

import httpx


class FDAConnector:
    BASE_URL = "https://api.fda.gov"

    async def search_labels(self, molecule: str, limit: int = 5) -> List[Dict[str, Any]]:
        term = molecule.replace('"', '').strip()
        query = f'openfda.generic_name:"{term}"+openfda.brand_name:"{term}"'

        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(
                f"{self.BASE_URL}/drug/label.json",
                params={"search": query, "limit": limit},
            )
            if response.status_code >= 400:
                return []
            data = response.json().get("results", [])

        now = datetime.now(timezone.utc)
        results: List[Dict[str, Any]] = []
        for index, row in enumerate(data):
            set_id = row.get("set_id") or f"label-{index}"
            effective_time = row.get("effective_time")
            indication = ""
            indications = row.get("indications_and_usage") or []
            if indications:
                indication = indications[0][:300]

            published_at = None
            if effective_time and len(effective_time) == 8:
                try:
                    published_at = datetime.strptime(effective_time, "%Y%m%d").replace(tzinfo=timezone.utc).isoformat()
                except ValueError:
                    published_at = None

            results.append(
                {
                    "claim_id": f"fda-label-{set_id}",
                    "claim_text": f"FDA drug label entry found for {molecule}",
                    "query": molecule,
                    "url": f"https://api.fda.gov/drug/label.json?search=set_id:{set_id}",
                    "source_name": "openFDA",
                    "source_tier": "official",
                    "snippet": indication or f"FDA label available for set_id={set_id}",
                    "published_at": published_at,
                    "fetched_at": now.isoformat(),
                    "hash": sha256(f"fda:{set_id}:{indication}".encode()).hexdigest(),
                    "document_id": set_id,
                }
            )

        return results

"""
ClinicalTrials.gov connector using v2 API.

Provides:
- search(): returns enriched study rows with phase, enrollment, sponsor
- count(): returns total study count matching a query (fast metadata call)
- phase_counts(): returns per-phase breakdown from API
"""

from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
from typing import Any, Dict, List, Optional

import httpx


class ClinicalTrialsConnector:
    BASE_URL = "https://clinicaltrials.gov/api/v2/studies"

    # ------------------------------------------------------------------
    # Rich search – returns detailed rows
    # ------------------------------------------------------------------
    async def search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        async with httpx.AsyncClient(timeout=25.0) as client:
            response = await client.get(
                self.BASE_URL,
                params={
                    "query.term": query,
                    "pageSize": limit,
                    "sort": "@relevance",
                },
            )
            if response.status_code >= 400:
                return []
            body = response.json()
            studies = body.get("studies", [])
            total_count = body.get("totalCount", len(studies))

        now = datetime.now(timezone.utc)
        results: List[Dict[str, Any]] = []
        for study in studies:
            protocol = study.get("protocolSection", {})
            ident = protocol.get("identificationModule", {})
            status_mod = protocol.get("statusModule", {})
            design = protocol.get("designModule", {})
            sponsor_mod = protocol.get("sponsorCollaboratorsModule", {})

            nct_id = ident.get("nctId", "unknown")
            brief_title = ident.get("briefTitle", "Clinical study")
            overall_status = status_mod.get("overallStatus", "Unknown")

            # Phase
            phases = design.get("phases") or []
            phase_str = ", ".join(phases) if phases else "N/A"

            # Enrollment
            enrollment_info = design.get("enrollmentInfo", {})
            enrollment = enrollment_info.get("count")

            # Sponsor
            lead_sponsor = (sponsor_mod.get("leadSponsor") or {}).get("name", "Unknown")

            # Date
            updated = status_mod.get("lastUpdatePostDateStruct", {}).get("date")
            published_at = None
            if updated:
                try:
                    published_at = datetime.fromisoformat(updated).replace(tzinfo=timezone.utc).isoformat()
                except ValueError:
                    published_at = None

            snippet_parts = [
                f"Phase: {phase_str}",
                f"Status: {overall_status}",
            ]
            if enrollment is not None:
                snippet_parts.append(f"Enrollment: {enrollment}")
            snippet_parts.append(f"Sponsor: {lead_sponsor}")

            results.append(
                {
                    "claim_id": f"ctgov-{nct_id}",
                    "claim_text": f"ClinicalTrials.gov: {brief_title}",
                    "query": query,
                    "url": f"https://clinicaltrials.gov/study/{nct_id}",
                    "source_name": "ClinicalTrials.gov",
                    "source_tier": "official",
                    "snippet": " | ".join(snippet_parts),
                    "published_at": published_at,
                    "fetched_at": now.isoformat(),
                    "hash": sha256(f"ctgov:{nct_id}:{brief_title}".encode()).hexdigest(),
                    "document_id": nct_id,
                    # Extra structured fields (not part of evidence schema, used by ClinicalAgent)
                    "nct_id": nct_id,
                    "title": brief_title,
                    "overall_status": overall_status,
                    "phase": phase_str,
                    "enrollment": enrollment,
                    "sponsor": lead_sponsor,
                    "total_count": total_count,
                }
            )

        return results

    # ------------------------------------------------------------------
    # Lightweight total count
    # ------------------------------------------------------------------
    async def count(self, query: str) -> int:
        """Return total number of studies matching *query*."""
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                self.BASE_URL,
                params={
                    "query.term": query,
                    "pageSize": 1,
                    "countTotal": "true",
                },
            )
            if response.status_code >= 400:
                return 0
            return response.json().get("totalCount", 0)

    # ------------------------------------------------------------------
    # Phase breakdown – queries each phase bucket
    # ------------------------------------------------------------------
    async def phase_counts(self, query: str) -> Dict[str, int]:
        """Return dict like {"PHASE1": 12, "PHASE2": 34, ...}."""
        phases = {
            "PHASE1": f"({query}) AND AREA[Phase](PHASE1)",
            "PHASE2": f"({query}) AND AREA[Phase](PHASE2)",
            "PHASE3": f"({query}) AND AREA[Phase](PHASE3)",
            "PHASE4": f"({query}) AND AREA[Phase](PHASE4)",
        }
        counts: Dict[str, int] = {}
        async with httpx.AsyncClient(timeout=25.0) as client:
            for label, term in phases.items():
                try:
                    resp = await client.get(
                        self.BASE_URL,
                        params={"query.term": term, "pageSize": 1, "countTotal": "true"},
                    )
                    if resp.status_code < 400:
                        counts[label] = resp.json().get("totalCount", 0)
                    else:
                        counts[label] = 0
                except Exception:
                    counts[label] = 0
        return counts

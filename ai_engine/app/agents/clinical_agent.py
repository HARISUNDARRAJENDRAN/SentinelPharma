"""
SentinelPharma Clinical Agent (Evidence-Grounded)
================================================
Retrieves real clinical trial data from ClinicalTrials.gov and PubMed,
then scores evidence quality, detects conflicts, and abstains when
the data is insufficient or stale.

Provides:
- Actual trial counts and phase distributions from ClinicalTrials.gov v2 API
- Real study titles, sponsors, enrollment, and statuses
- PubMed publication cross-references
- Evidence-backed safety/efficacy narrative (no fabricated scores)
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List

import structlog

from ..core.evidence_schema import (
    EvidenceRecord,
    EvidenceSource,
    EvidenceRetrieval,
    EvidenceQuality,
)
from ..services.evidence_validator import EvidenceValidator
from ..services.grounded_summarizer import GroundedSummarizer
from ..services.llm_service import get_llm_service
from ..services.source_connectors import ClinicalTrialsConnector, PubMedConnector

logger = structlog.get_logger(__name__)


class ClinicalAgent:
    """
    Clinical Trial Analysis Agent — evidence-first implementation.

    All factual outputs (trial counts, phase distribution, trial list)
    come directly from ClinicalTrials.gov and PubMed.
    Synthetic scores are replaced by real data or explicit "N/A".
    """

    def __init__(self):
        self.name = "ClinicalAgent"
        self.version = "2.0.0"  # bumped – grounded
        self.llm_service = get_llm_service()
        self.evidence_validator = EvidenceValidator()
        self.grounded_summarizer = GroundedSummarizer()
        self.clinical_trials = ClinicalTrialsConnector()
        self.pubmed = PubMedConnector()
        logger.info(f"Initialized {self.name} v{self.version}")

    # ------------------------------------------------------------------
    # Main entry
    # ------------------------------------------------------------------
    async def analyze(self, molecule: str, llm_config: Dict[str, Any]) -> Dict[str, Any]:
        start_time = datetime.now()

        logger.info(
            "clinical_analysis_started",
            molecule=molecule,
            agent=self.name,
            model=llm_config.get("model"),
            provider=llm_config.get("provider"),
        )

        # ----- 1. Parallel data retrieval from real APIs -----
        ct_rows, ct_total, ct_phases, pubmed_rows = await asyncio.gather(
            self.clinical_trials.search(query=molecule, limit=15),
            self.clinical_trials.count(query=molecule),
            self.clinical_trials.phase_counts(query=molecule),
            self.pubmed.search(query=f"{molecule} clinical trial", limit=10),
            return_exceptions=True,
        )

        # Handle any connector failures gracefully
        if isinstance(ct_rows, Exception):
            logger.warning("ct_search_failed", error=str(ct_rows))
            ct_rows = []
        if isinstance(ct_total, Exception):
            logger.warning("ct_count_failed", error=str(ct_total))
            ct_total = 0
        if isinstance(ct_phases, Exception):
            logger.warning("ct_phases_failed", error=str(ct_phases))
            ct_phases = {}
        if isinstance(pubmed_rows, Exception):
            logger.warning("pubmed_search_failed", error=str(pubmed_rows))
            pubmed_rows = []

        # ----- 2. Convert to evidence records -----
        all_raw: List[Dict[str, Any]] = []
        all_raw.extend(ct_rows if isinstance(ct_rows, list) else [])
        all_raw.extend(pubmed_rows if isinstance(pubmed_rows, list) else [])

        evidence = self._rows_to_evidence(all_raw)
        evidence = self.evidence_validator.detect_and_mark_conflicts(evidence)
        verification_summary = self.evidence_validator.summarize_verification(evidence)
        freshness_summary = self.evidence_validator.summarize_freshness(evidence)
        abstained, abstain_reason = self.evidence_validator.should_abstain(evidence)

        # ----- 3. Build real clinical metrics -----
        total_trials = ct_total if isinstance(ct_total, int) else 0
        phase_distribution = self._safe_phase_dict(ct_phases)
        active_trials = sum(
            1 for row in ct_rows
            if isinstance(row, dict) and row.get("overall_status") in {
                "Recruiting", "Not yet recruiting", "Active, not recruiting",
                "Enrolling by invitation",
            }
        )
        completed_trials = sum(
            1 for row in ct_rows
            if isinstance(row, dict) and row.get("overall_status") == "Completed"
        )

        # Build a human-readable trials list from real data
        trials = []
        for row in (ct_rows if isinstance(ct_rows, list) else []):
            if not isinstance(row, dict):
                continue
            trials.append({
                "nct_id": row.get("nct_id", "N/A"),
                "title": row.get("title", "N/A"),
                "phase": row.get("phase", "N/A"),
                "status": row.get("overall_status", "N/A"),
                "enrollment": row.get("enrollment"),
                "sponsor": row.get("sponsor", "N/A"),
                "url": row.get("url"),
            })

        # Indications: extract from trial titles (real, not random)
        indications = self._extract_indications_from_titles(ct_rows)

        # ----- 4. Grounded LLM summary (or abstain message) -----
        llm_interpretation = None
        if abstained:
            llm_interpretation = (
                f"Insufficient verified clinical evidence for {molecule} right now. "
                f"Reason: {abstain_reason}"
            )
        else:
            llm_interpretation = await self.grounded_summarizer.summarize(evidence, llm_config)

        # ----- 5. Claims list -----
        claims = [
            {
                "claim_id": item.claim_id,
                "claim_text": item.claim_text,
                "verification_status": item.quality.verification_status,
                "support_count": 1,
            }
            for item in evidence
        ]

        processing_ms = round((datetime.now() - start_time).total_seconds() * 1000, 2)

        result = {
            "molecule": molecule,
            "analysis_date": datetime.now(timezone.utc).isoformat(),

            # ===== Grounding contract =====
            "claims": claims,
            "evidence": [item.model_dump(mode="json") for item in evidence],
            "verification_summary": verification_summary.model_dump(),
            "freshness_summary": freshness_summary.model_dump(mode="json"),
            "abstained": abstained,
            "abstain_reason": abstain_reason,

            # ===== Real clinical metrics =====
            "total_trials_found": total_trials,
            "active_trials": active_trials,
            "completed_trials": completed_trials,
            "phase_distribution": phase_distribution,
            "trials": trials[:15],  # top studies

            # Indications pulled from trial titles (real, not random)
            "indications": indications,
            "current_indications": indications,
            "potential_new_indications": indications,

            # Safety/efficacy — NO synthetic scores
            "safety_score": "N/A (no standardized metric exists)",
            "efficacy_rating": "See trial-level endpoints below",
            "adverse_events": [],  # will be populated from openFDA in Phase 2

            # LLM grounded interpretation
            "llm_enhanced": llm_interpretation is not None and not abstained,
            "llm_interpretation": llm_interpretation,

            # Data sources
            "data_sources": ["ClinicalTrials.gov", "PubMed"],
            "data_sources_queried": {
                "clinicaltrials_gov": {
                    "total_matching": total_trials,
                    "returned_rows": len(ct_rows) if isinstance(ct_rows, list) else 0,
                },
                "pubmed": {
                    "returned_rows": len(pubmed_rows) if isinstance(pubmed_rows, list) else 0,
                },
            },

            # Metadata
            "agent": self.name,
            "version": self.version,
            "model_used": llm_config.get("model"),
            "provider_used": llm_config.get("provider", "deterministic"),
            "processing_time_ms": processing_ms,
        }

        logger.info(
            "clinical_analysis_completed",
            molecule=molecule,
            total_trials=total_trials,
            evidence_count=len(evidence),
            abstained=abstained,
            processing_ms=processing_ms,
        )

        return result

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _rows_to_evidence(self, rows: List[Dict[str, Any]]) -> List[EvidenceRecord]:
        records: List[EvidenceRecord] = []
        for row in rows:
            try:
                fetched_at_raw = row.get("fetched_at")
                published_at_raw = row.get("published_at")
                fetched_at = (
                    datetime.fromisoformat(fetched_at_raw)
                    if fetched_at_raw
                    else datetime.now(timezone.utc)
                )
                published_at = (
                    datetime.fromisoformat(published_at_raw) if published_at_raw else None
                )

                record = EvidenceRecord(
                    claim_id=row["claim_id"],
                    claim_text=row["claim_text"],
                    source=EvidenceSource(
                        name=row.get("source_name", "Unknown"),
                        url=row["url"],
                        document_id=row.get("document_id"),
                        published_at=published_at,
                    ),
                    retrieval=EvidenceRetrieval(
                        fetched_at=fetched_at,
                        query=row.get("query", ""),
                        snippet=row.get("snippet", ""),
                        hash=row.get("hash", ""),
                    ),
                    quality=EvidenceQuality(
                        source_tier=row.get("source_tier", "other"),
                    ),
                )
                record = self.evidence_validator.apply_quality_defaults(record)
                records.append(record)
            except Exception as exc:
                logger.warning("clinical_evidence_row_skipped", error=str(exc))
        return records

    @staticmethod
    def _safe_phase_dict(raw: Any) -> Dict[str, int]:
        """Normalize phase counts from connector into a UI-friendly dict."""
        if not isinstance(raw, dict):
            return {"phase_1": 0, "phase_2": 0, "phase_3": 0, "phase_4": 0}
        return {
            "phase_1": raw.get("PHASE1", 0),
            "phase_2": raw.get("PHASE2", 0),
            "phase_3": raw.get("PHASE3", 0),
            "phase_4": raw.get("PHASE4", 0),
        }

    @staticmethod
    def _extract_indications_from_titles(rows: Any) -> List[str]:
        """Pull unique indication keywords from real trial titles."""
        if not isinstance(rows, list):
            return []
        indication_keywords: set[str] = set()
        disease_terms = {
            "cancer", "carcinoma", "tumor", "leukaemia", "leukemia", "lymphoma",
            "diabetes", "hypertension", "heart failure", "stroke", "alzheimer",
            "parkinson", "arthritis", "asthma", "copd", "obesity", "depression",
            "schizophrenia", "epilepsy", "hepatitis", "cirrhosis", "fibrosis",
            "sepsis", "pneumonia", "covid", "influenza", "hiv", "malaria",
            "tuberculosis", "anemia", "thrombosis", "embolism", "atrial fibrillation",
            "colorectal", "breast", "lung", "prostate", "pancreatic", "kidney",
            "liver", "melanoma", "glioblastoma", "myeloma", "sarcoma",
            "migraine", "pain", "inflammation", "infection",
        }
        for row in rows:
            if not isinstance(row, dict):
                continue
            title = (row.get("title") or "").lower()
            for term in disease_terms:
                if term in title:
                    indication_keywords.add(term.title())
        return sorted(indication_keywords)[:10]

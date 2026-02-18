"""
Evidence validation and trust scoring utilities.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable, Dict, Any

from app.core.evidence_schema import (
    EvidenceRecord,
    VerificationSummary,
    FreshnessSummary,
)


class EvidenceValidator:
    SOURCE_TRUST = {
        "official": 0.95,
        "peer-reviewed": 0.85,
        "news": 0.65,
        "other": 0.5,
    }

    FRESHNESS_SLA_HOURS = {
        "official": 24.0,
        "peer-reviewed": 24.0 * 24,
        "news": 24.0,
        "other": 24.0 * 7,
    }

    POSITIVE_TERMS = {
        "approved", "eligible", "positive", "cleared", "granted", "aligned", "safe"
    }

    NEGATIVE_TERMS = {
        "rejected", "denied", "warning", "withdrawn", "failed", "hold", "safety concern"
    }

    def compute_freshness_hours(self, timestamp: datetime) -> float:
        now = datetime.now(timezone.utc)
        ts = timestamp if timestamp.tzinfo else timestamp.replace(tzinfo=timezone.utc)
        return max((now - ts).total_seconds() / 3600.0, 0.0)

    def apply_quality_defaults(self, evidence: EvidenceRecord) -> EvidenceRecord:
        evidence.quality.freshness_hours = self.compute_freshness_hours(evidence.retrieval.fetched_at)
        base = self.SOURCE_TRUST.get(evidence.quality.source_tier, 0.5)

        sla = self.FRESHNESS_SLA_HOURS.get(evidence.quality.source_tier, 24.0 * 7)
        stale_penalty = 0.25 if evidence.quality.freshness_hours > sla else 0.0

        confidence = max(min(base - stale_penalty, 1.0), 0.0)
        evidence.quality.confidence = round(confidence, 2)

        if confidence >= 0.85:
            evidence.quality.verification_status = "verified"
        elif confidence >= 0.65:
            evidence.quality.verification_status = "partially_verified"
        else:
            evidence.quality.verification_status = "unverified"

        return evidence

    def detect_and_mark_conflicts(self, evidence_records: Iterable[EvidenceRecord]) -> list[EvidenceRecord]:
        records = list(evidence_records)
        grouped: dict[str, list[EvidenceRecord]] = {}

        for record in records:
            query_key = (record.retrieval.query or "").strip().lower()
            grouped.setdefault(query_key, []).append(record)

        for _, group in grouped.items():
            if len(group) < 2:
                continue

            has_positive = False
            has_negative = False

            for rec in group:
                text = f"{rec.claim_text} {rec.retrieval.snippet}".lower()
                if any(term in text for term in self.POSITIVE_TERMS):
                    has_positive = True
                if any(term in text for term in self.NEGATIVE_TERMS):
                    has_negative = True

            if has_positive and has_negative:
                for rec in group:
                    rec.quality.verification_status = "conflicting"
                    rec.quality.confidence = min(rec.quality.confidence, 0.5)

        return records

    def summarize_verification(self, evidence_records: Iterable[EvidenceRecord]) -> VerificationSummary:
        summary = VerificationSummary()
        for record in evidence_records:
            status = record.quality.verification_status
            if status == "verified":
                summary.verified_count += 1
            elif status == "partially_verified":
                summary.partial_count += 1
            elif status == "conflicting":
                summary.conflicting_count += 1
            else:
                summary.unverified_count += 1
        return summary

    def summarize_freshness(self, evidence_records: Iterable[EvidenceRecord]) -> FreshnessSummary:
        records = list(evidence_records)
        if not records:
            return FreshnessSummary(latest_fetch_at=None, max_age_hours=9999.0)

        latest = max(r.retrieval.fetched_at for r in records)
        max_age = max(r.quality.freshness_hours for r in records)
        return FreshnessSummary(latest_fetch_at=latest, max_age_hours=round(max_age, 2))

    def should_abstain(self, evidence_records: Iterable[EvidenceRecord], strict: bool = True) -> tuple[bool, str | None]:
        records = list(evidence_records)
        if not records:
            return True, "No verified evidence found from configured real-time sources"

        if strict and any(r.quality.verification_status == "conflicting" for r in records):
            return True, "Conflicting evidence detected across trusted sources"

        verified_like = [
            r for r in records if r.quality.verification_status in {"verified", "partially_verified"}
        ]
        if not verified_like:
            return True, "Evidence quality is too weak to support factual claims"

        if strict:
            stale_critical = [
                r for r in verified_like
                if r.quality.source_tier in {"official", "news"} and r.quality.freshness_hours > 24.0
            ]
            if stale_critical:
                return True, "Evidence is stale for real-time regulatory/news usage"

        return False, None

    def build_agent_truth_status(self, evidence_records: Iterable[EvidenceRecord]) -> Dict[str, Any]:
        records = self.detect_and_mark_conflicts(list(evidence_records))
        verification = self.summarize_verification(records)
        freshness = self.summarize_freshness(records)
        abstained, reason = self.should_abstain(records)

        return {
            "verification_summary": verification.model_dump(),
            "freshness_summary": freshness.model_dump(mode="json"),
            "abstained": abstained,
            "abstain_reason": reason,
        }

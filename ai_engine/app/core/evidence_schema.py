"""
Evidence and claim schema models for Phase 1 grounding.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional, Literal

from pydantic import BaseModel, Field, HttpUrl


VerificationStatus = Literal["verified", "partially_verified", "unverified", "conflicting"]
SourceTier = Literal["official", "peer-reviewed", "news", "other"]


class EvidenceSource(BaseModel):
    name: str
    url: HttpUrl
    document_id: Optional[str] = None
    published_at: Optional[datetime] = None


class EvidenceRetrieval(BaseModel):
    fetched_at: datetime
    query: str
    snippet: str
    hash: str


class EvidenceQuality(BaseModel):
    source_tier: SourceTier = "other"
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    verification_status: VerificationStatus = "unverified"
    freshness_hours: float = Field(default=9999.0, ge=0.0)


class EvidenceRecord(BaseModel):
    claim_id: str
    claim_text: str
    source: EvidenceSource
    retrieval: EvidenceRetrieval
    quality: EvidenceQuality


class ClaimRecord(BaseModel):
    claim_id: str
    claim_text: str
    support_count: int = 0
    verification_status: VerificationStatus = "unverified"


class VerificationSummary(BaseModel):
    verified_count: int = 0
    partial_count: int = 0
    unverified_count: int = 0
    conflicting_count: int = 0


class FreshnessSummary(BaseModel):
    latest_fetch_at: Optional[datetime] = None
    max_age_hours: float = 9999.0


class GroundingEnvelope(BaseModel):
    evidence: List[EvidenceRecord] = Field(default_factory=list)
    claims: List[ClaimRecord] = Field(default_factory=list)
    verification_summary: VerificationSummary = Field(default_factory=VerificationSummary)
    freshness_summary: FreshnessSummary = Field(default_factory=FreshnessSummary)
    abstained: bool = False
    abstain_reason: Optional[str] = None

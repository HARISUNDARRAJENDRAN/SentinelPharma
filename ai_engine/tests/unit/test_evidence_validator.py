import unittest
from datetime import datetime, timedelta, timezone

from app.core.evidence_schema import EvidenceRecord, EvidenceSource, EvidenceRetrieval, EvidenceQuality
from app.services.evidence_validator import EvidenceValidator


class TestEvidenceValidator(unittest.TestCase):
    def setUp(self):
        self.validator = EvidenceValidator()

    def _make_record(self, claim_id: str, claim_text: str, snippet: str, query: str, source_tier: str, hours_ago: int):
        fetched_at = datetime.now(timezone.utc) - timedelta(hours=hours_ago)
        return EvidenceRecord(
            claim_id=claim_id,
            claim_text=claim_text,
            source=EvidenceSource(
                name="TestSource",
                url="https://example.com/source",
            ),
            retrieval=EvidenceRetrieval(
                fetched_at=fetched_at,
                query=query,
                snippet=snippet,
                hash=f"hash-{claim_id}",
            ),
            quality=EvidenceQuality(source_tier=source_tier),
        )

    def test_apply_quality_defaults_fresh_official_is_verified(self):
        record = self._make_record(
            claim_id="c1",
            claim_text="FDA approved treatment",
            snippet="approved",
            query="metformin approval",
            source_tier="official",
            hours_ago=2,
        )
        scored = self.validator.apply_quality_defaults(record)

        self.assertEqual(scored.quality.verification_status, "verified")
        self.assertGreaterEqual(scored.quality.confidence, 0.85)

    def test_should_abstain_on_stale_official_data(self):
        record = self._make_record(
            claim_id="c2",
            claim_text="FDA approved treatment",
            snippet="approved",
            query="metformin approval",
            source_tier="official",
            hours_ago=72,
        )
        scored = self.validator.apply_quality_defaults(record)

        abstain, reason = self.validator.should_abstain([scored], strict=True)
        self.assertTrue(abstain)
        self.assertIn("stale", reason.lower())

    def test_detect_conflicts_marks_records_conflicting(self):
        a = self._make_record(
            claim_id="c3",
            claim_text="Regulator approved metformin indication",
            snippet="approved by regulator",
            query="metformin regulatory",
            source_tier="official",
            hours_ago=1,
        )
        b = self._make_record(
            claim_id="c4",
            claim_text="Regulator rejected metformin indication",
            snippet="application rejected",
            query="metformin regulatory",
            source_tier="official",
            hours_ago=1,
        )

        a = self.validator.apply_quality_defaults(a)
        b = self.validator.apply_quality_defaults(b)
        records = self.validator.detect_and_mark_conflicts([a, b])

        self.assertTrue(all(r.quality.verification_status == "conflicting" for r in records))

        abstain, reason = self.validator.should_abstain(records, strict=True)
        self.assertTrue(abstain)
        self.assertIn("conflicting", reason.lower())


if __name__ == "__main__":
    unittest.main()

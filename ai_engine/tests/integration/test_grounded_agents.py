import unittest

from app.agents.clinical_agent import ClinicalAgent
from app.agents.regulatory_agent import RegulatoryAgent
from app.agents.web_intelligence_agent import WebIntelligenceAgent


class TestGroundedAgents(unittest.IsolatedAsyncioTestCase):
    async def test_web_agent_abstains_on_conflicting_evidence(self):
        agent = WebIntelligenceAgent()

        async def fake_pubmed(query, limit=5):
            return [
                {
                    "claim_id": "pubmed-1",
                    "claim_text": "Regulator approved metformin pathway",
                    "query": query,
                    "url": "https://pubmed.ncbi.nlm.nih.gov/1/",
                    "source_name": "PubMed",
                    "source_tier": "peer-reviewed",
                    "snippet": "approved",
                    "published_at": "2026-02-18T00:00:00+00:00",
                    "fetched_at": "2026-02-18T00:00:00+00:00",
                    "hash": "h1",
                    "document_id": "1",
                }
            ]

        async def fake_fda(molecule, limit=5):
            return [
                {
                    "claim_id": "fda-1",
                    "claim_text": "Regulator rejected metformin pathway",
                    "query": molecule,
                    "url": "https://api.fda.gov/drug/label.json?search=set_id:1",
                    "source_name": "openFDA",
                    "source_tier": "official",
                    "snippet": "rejected",
                    "published_at": "2026-02-18T00:00:00+00:00",
                    "fetched_at": "2026-02-18T00:00:00+00:00",
                    "hash": "h2",
                    "document_id": "2",
                }
            ]

        async def fake_ct(query, limit=5):
            return []

        agent.pubmed.search = fake_pubmed
        agent.fda.search_labels = fake_fda
        agent.clinical_trials.search = fake_ct

        result = await agent.analyze("metformin", {"provider": "none", "model": "n/a"})
        self.assertTrue(result["abstained"])
        self.assertGreater(result["verification_summary"].get("conflicting_count", 0), 0)

    async def test_regulatory_agent_abstains_on_stale_official_evidence(self):
        agent = RegulatoryAgent()

        async def fake_fda(molecule, limit=5):
            return [
                {
                    "claim_id": "fda-label-1",
                    "claim_text": "FDA approved historical label",
                    "query": molecule,
                    "url": "https://api.fda.gov/drug/label.json?search=set_id:1",
                    "source_name": "openFDA",
                    "source_tier": "official",
                    "snippet": "approved",
                    "published_at": "2025-01-01T00:00:00+00:00",
                    "fetched_at": "2026-02-16T00:00:00+00:00",
                    "hash": "old-hash",
                    "document_id": "1",
                }
            ]

        async def fake_ct(query, limit=5):
            return []

        agent.fda.search_labels = fake_fda
        agent.clinical_trials.search = fake_ct

        result = await agent.analyze("metformin", {"provider": "none", "model": "n/a"})
        self.assertTrue(result["abstained"])
        self.assertIn("stale", (result.get("abstain_reason") or "").lower())

    # ------------------------------------------------------------------
    # ClinicalAgent grounding tests
    # ------------------------------------------------------------------

    async def test_clinical_agent_emits_grounding_contract(self):
        """ClinicalAgent should emit claims, evidence, verification_summary."""
        agent = ClinicalAgent()

        # Mock all connectors with realistic data
        async def fake_ct_search(query, limit=15):
            return [
                {
                    "claim_id": "ctgov-NCT00000001",
                    "claim_text": "ClinicalTrials.gov: Aspirin for Cardiovascular Prevention",
                    "query": query,
                    "url": "https://clinicaltrials.gov/study/NCT00000001",
                    "source_name": "ClinicalTrials.gov",
                    "source_tier": "official",
                    "snippet": "Phase: PHASE3 | Status: Completed | Enrollment: 19000 | Sponsor: NIH",
                    "published_at": "2026-02-17T00:00:00+00:00",
                    "fetched_at": "2026-02-18T00:00:00+00:00",
                    "hash": "h1",
                    "document_id": "NCT00000001",
                    "nct_id": "NCT00000001",
                    "title": "Aspirin for Cardiovascular Prevention",
                    "overall_status": "Completed",
                    "phase": "PHASE3",
                    "enrollment": 19000,
                    "sponsor": "NIH",
                    "total_count": 797,
                }
            ]

        async def fake_ct_count(query):
            return 797

        async def fake_ct_phases(query):
            return {"PHASE1": 45, "PHASE2": 120, "PHASE3": 310, "PHASE4": 200}

        async def fake_pubmed(query, limit=10):
            return [
                {
                    "claim_id": "pubmed-99999",
                    "claim_text": "PubMed: Aspirin reduces colorectal cancer risk",
                    "query": query,
                    "url": "https://pubmed.ncbi.nlm.nih.gov/99999/",
                    "source_name": "PubMed",
                    "source_tier": "peer-reviewed",
                    "snippet": "Aspirin reduces colorectal cancer risk",
                    "published_at": "2026-01-15T00:00:00+00:00",
                    "fetched_at": "2026-02-18T00:00:00+00:00",
                    "hash": "h2",
                    "document_id": "99999",
                }
            ]

        agent.clinical_trials.search = fake_ct_search
        agent.clinical_trials.count = fake_ct_count
        agent.clinical_trials.phase_counts = fake_ct_phases
        agent.pubmed.search = fake_pubmed

        result = await agent.analyze("aspirin", {"provider": "none", "model": "n/a"})

        # Must have grounding contract fields
        self.assertIn("claims", result)
        self.assertIn("evidence", result)
        self.assertIn("verification_summary", result)
        self.assertIn("freshness_summary", result)
        self.assertIn("abstained", result)

        # Real total trial count
        self.assertEqual(result["total_trials_found"], 797)

        # Real phase breakdown
        self.assertEqual(result["phase_distribution"]["phase_3"], 310)
        self.assertEqual(result["phase_distribution"]["phase_4"], 200)

        # No fabricated safety score
        self.assertIn("N/A", str(result["safety_score"]))

        # Evidence should have 2 records (1 CT + 1 PubMed)
        self.assertEqual(len(result["evidence"]), 2)
        self.assertEqual(len(result["claims"]), 2)

    async def test_clinical_agent_abstains_on_empty_connectors(self):
        """ClinicalAgent should abstain when all connectors fail."""
        agent = ClinicalAgent()

        async def empty_search(*args, **kwargs):
            return []

        async def zero_count(*args, **kwargs):
            return 0

        async def empty_phases(*args, **kwargs):
            return {}

        agent.clinical_trials.search = empty_search
        agent.clinical_trials.count = zero_count
        agent.clinical_trials.phase_counts = empty_phases
        agent.pubmed.search = empty_search

        result = await agent.analyze("nonexistentmolecule123", {"provider": "none", "model": "n/a"})

        self.assertTrue(result["abstained"])
        self.assertIsNotNone(result["abstain_reason"])
        self.assertEqual(result["total_trials_found"], 0)


if __name__ == "__main__":
    unittest.main()

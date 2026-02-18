# SentinelPharma Phase 1 Plan
## Evidence-First, Time-Aware, Truthful Agent Outputs

**Date:** 2026-02-18  
**Owner:** AI/Platform Team  
**Status:** Implemented (3 agents grounded, 7 tests passing)  
**Phase Duration Target:** 2 weeks (10 working days)

---

## 1) Why Phase 1

Current outputs can look polished but still contain non-grounded claims because:

- Several agents generate synthetic/deterministic/randomized values.
- LLM output is not strictly constrained to retrieved evidence.
- UI does not always distinguish verified vs inferred vs unavailable facts.

**Phase 1 goal:** keep the existing multi-agent architecture, but enforce **evidence-first generation** and **truthfulness guardrails** before any broader product redesign.

---

## 2) Phase 1 Outcomes (must-have)

By end of Phase 1:

1. At least one production path (Web + Regulatory intelligence) is fully evidence-backed.
2. Every user-visible claim in that path carries source metadata and freshness timestamps.
3. The system abstains when evidence is missing, stale, or conflicting.
4. UI clearly labels verification status and recency.
5. Orchestrator summary does not present unsupported claims as facts.

---

## 3) Scope

## In Scope

- New shared evidence schema and validation logic in AI engine.
- Grounded agents (evidence-first):
  - `WebIntelligenceAgent` — PubMed + openFDA + ClinicalTrials.gov
  - `RegulatoryAgent` — openFDA + ClinicalTrials.gov
  - `ClinicalAgent` — ClinicalTrials.gov (total count, phase breakdown, real study list) + PubMed
- Orchestrator-level truthfulness checks.
- API response additions for provenance metadata.
- Frontend rendering for verification badges + source list + last-updated.

## Out of Scope (Phase 2+)

- Replacing all agents at once (IQVIA, EXIM, Clinical, Patent, etc.).
- Full enterprise data licensing integrations (IQVIA paid feeds, etc.).
- Deep ranking/relevance ML models.
- Historical reindex/backfill of all previous reports.

---

## 4) Architecture Changes (Phase 1)

### 4.1 Evidence-First Data Flow

1. **Retrieve** from trusted source connectors.
2. **Normalize** into shared evidence objects.
3. **Verify/Score** (freshness, consistency, source trust).
4. **Summarize** with LLM constrained to evidence snippets only.
5. **Gate** any unsupported claims (abstain/fallback message).

### 4.2 Core Principle

> No claim enters `summary` unless linked to at least one evidence record.

---

## 5) Canonical Data Contracts

## 5.1 Evidence Record (new)

```json
{
  "claim_id": "string",
  "claim_text": "string",
  "source": {
    "name": "PubMed|FDA|EMA|ClinicalTrials.gov|...",
    "url": "https://...",
    "document_id": "optional",
    "published_at": "ISO-8601"
  },
  "retrieval": {
    "fetched_at": "ISO-8601",
    "query": "string",
    "snippet": "string",
    "hash": "string"
  },
  "quality": {
    "source_tier": "official|peer-reviewed|news|other",
    "confidence": 0.0,
    "verification_status": "verified|partially_verified|unverified|conflicting",
    "freshness_hours": 0
  }
}
```

## 5.2 Agent Result Additions

Each grounded agent should return:

- `evidence`: `EvidenceRecord[]`
- `claims`: array of claim objects with referenced `claim_id`s
- `verification_summary`:
  - `verified_count`
  - `partial_count`
  - `unverified_count`
  - `conflicting_count`
- `freshness_summary`:
  - `latest_fetch_at`
  - `max_age_hours`
- `abstained`: boolean
- `abstain_reason`: string | null

---

## 6) Trust Policy (Phase 1)

## 6.1 Freshness SLA

- Regulatory/news alerts: <= 24h target
- Publications/trials updates: <= 7d target
- If older than SLA -> mark stale; reduce confidence; may abstain

## 6.2 Source Priority (descending)

1. Official regulator/registry (FDA, EMA, ClinicalTrials.gov)
2. Peer-reviewed indexed sources (PubMed metadata)
3. Reputable pharma trade press
4. Other web content

## 6.3 Abstention Rules

Abstain from factual answer when any is true:

- No evidence records returned.
- Only low-trust sources for critical claim.
- Conflicting evidence without tie-break confidence.
- Evidence older than threshold for “real-time” question.

Response should say: **insufficient verified evidence available right now** and suggest next refresh/source.

---

## 7) Repo-Level Implementation Plan

## 7.1 AI Engine (backend Python)

### New files

- `ai_engine/app/core/evidence_schema.py`
  - Pydantic models for evidence + verification summary.
- `ai_engine/app/services/evidence_validator.py`
  - Freshness checks, trust scoring, conflict detection.
- `ai_engine/app/services/source_connectors/`
  - `pubmed_connector.py`
  - `fda_connector.py`
  - `clinicaltrials_connector.py` (as needed)
- `ai_engine/app/services/grounded_summarizer.py`
  - Prompt builder that only includes evidence snippets.

### Modified files

- `ai_engine/app/agents/web_intelligence_agent.py`
  - Replace mock/random generation path with connectors + normalized evidence.
  - Add `abstained` logic.
- `ai_engine/app/agents/regulatory_agent.py`
  - Use official source connector outputs where possible.
- `ai_engine/app/agents/clinical_agent.py`
  - Replace synthetic trial counts/phase distributions/safety scores with real ClinicalTrials.gov data.
  - Add real PubMed cross-references.
  - Emit grounding contract (claims, evidence, verification_summary, abstained).
  - Remove fabricated metrics (safety_score, efficacy_rating, success_rate).
- `ai_engine/app/agents/orchestrator.py`
  - Add final “truth gate” before summary assembly.
  - Prevent unsupported claims from entering final summary.
- `ai_engine/app/main.py` and response models
  - Expose provenance fields in API output.

## 7.2 Node Server Layer

### Modified files

- `server/src/controllers/researchController.js`
  - Preserve and forward evidence metadata from AI engine.
- `server/src/services/aiEngineService.js`
  - Ensure contract mapping includes verification and timestamps.

## 7.3 Frontend (React)

### Modified files

- `client/src/components/dashboard/ComprehensiveSummary.jsx`
- `client/src/components/dashboard/CitationPanel.jsx`
- `client/src/components/dashboard/AgentDetailPanel.jsx`
- `client/src/pages/ResearchDashboard.jsx`

### UI additions (minimal, no feature bloat)

- Verification badge per claim/report section:
  - `Verified`
  - `Partially Verified`
  - `Unverified`
  - `Conflicting`
- “Last updated” timestamp display.
- Source list with click-through links.
- Explicit abstention banner when no verified evidence.

---

## 8) Prompting & LLM Constraints

Use a strict grounded prompt format:

- Provide only retrieved evidence snippets.
- Forbid external assumptions.
- Require citations by `claim_id` in generated summary.
- If unsupported, force response token: `ABSTAIN_UNVERIFIED`.

Example system rule snippet:

> “You may only state facts that are directly supported by provided evidence snippets. For each factual sentence, include referenced claim IDs. If support is missing or conflicting, abstain.”

---

## 9) Testing Strategy

## 9.1 Unit Tests (Python)

- Evidence schema validation.
- Freshness computation.
- Conflict detection behavior.
- Abstention trigger rules.

## 9.2 Integration Tests

- Web/regulatory query returns evidence records with valid URLs/timestamps.
- Orchestrator filters unsupported claims from final summary.
- API payload includes provenance fields end-to-end.

## 9.3 Frontend Checks

- Badge rendering for each verification state.
- Source links + recency display visible.
- Abstain banner appears when `abstained=true`.

---

## 10) Definition of Done (DoD)

Phase 1 is complete only when all are true:

1. No mock/random values in selected grounded path output.
2. At least 90% of factual sentences in targeted path have evidence references.
3. Unsupported claims are abstained or marked unverified.
4. UI visibly communicates verification + recency.
5. Basic tests pass for schema/validator/orchestrator gating.

---

## 11) Delivery Timeline (2 weeks)

## Week 1

- Day 1-2: Evidence schema + validator scaffolding.
- Day 3-4: Source connectors (PubMed/FDA baseline).
- Day 5: Web/regulatory agent grounding integration.

## Week 2

- Day 6-7: Orchestrator truth gate + API propagation.
- Day 8: Frontend verification UI updates.
- Day 9: Test hardening + bug fixes.
- Day 10: Demo, docs, rollout checklist.

---

## 12) Risks and Mitigations

- **API limits/outages** -> add retries, caching, graceful abstain.
- **Source inconsistency** -> conflict detector + lower confidence labels.
- **Latency increase** -> parallel connector calls + timeout budget.
- **User trust confusion** -> explicit labels and “why abstained” messages.

---

## 13) Rollout Plan

1. Feature flag: `GROUNDING_PHASE1_ENABLED=true`.
2. Internal-only canary for selected users.
3. Compare old vs grounded outputs for 1 week.
4. Promote grounded path to default after acceptance metrics.

---

## 14) Success Metrics

- Hallucination incident rate in grounded path: down by >= 70%.
- User-reported trust score: up by >= 30%.
- Citation click-through and verification usage: increasing trend.
- Abstain correctness: no fabricated “definitive” answers when evidence absent.

---

## 15) Immediate Next Steps

1. Implement evidence schema + validator in AI engine.
2. Ground `WebIntelligenceAgent` with real connectors.
3. Add orchestrator truth gate.
4. Expose verification/freshness metadata through server to UI.
5. Add minimal verification badges and abstention banner in dashboard.

---

## Appendix A: Minimal API Response Shape (Phase 1)

```json
{
  "request_id": "...",
  "results": {
    "web_intelligence": {
      "claims": [],
      "evidence": [],
      "verification_summary": {
        "verified_count": 0,
        "partial_count": 0,
        "unverified_count": 0,
        "conflicting_count": 0
      },
      "freshness_summary": {
        "latest_fetch_at": "...",
        "max_age_hours": 0
      },
      "abstained": false,
      "abstain_reason": null
    }
  },
  "summary": {
    "text": "...",
    "supported_claim_ids": []
  }
}
```

---

## Appendix B: Non-Negotiables

- Never present synthetic values as real-world facts.
- Never omit source + timestamp for user-visible factual claims in grounded path.
- Never suppress abstention if verification fails.

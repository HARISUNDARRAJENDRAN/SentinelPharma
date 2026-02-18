"""
Evidence-grounded summarization service.
"""

from __future__ import annotations

from typing import List

from app.core.evidence_schema import EvidenceRecord
from app.services.llm_service import get_llm_service


class GroundedSummarizer:
    def __init__(self):
        self.llm = get_llm_service()

    async def summarize(self, evidence: List[EvidenceRecord], llm_config: dict) -> str:
        if not evidence:
            return "Insufficient verified evidence available right now."

        snippets = []
        for item in evidence[:12]:
            snippets.append(
                f"- [{item.claim_id}] ({item.source.name}) {item.claim_text} | snippet: {item.retrieval.snippet}"
            )

        prompt = (
            "Use ONLY the evidence below. "
            "Do not invent facts. "
            "If evidence is insufficient, return exactly: ABSTAIN_UNVERIFIED.\n\n"
            "Evidence:\n"
            f"{'\n'.join(snippets)}\n\n"
            "Return a concise summary with claim IDs in parentheses."
        )

        try:
            if llm_config.get("provider") in ["gemini", "ollama", "local"]:
                result = await self.llm.generate_completion(
                    prompt=prompt,
                    llm_config=llm_config,
                    system_prompt="You are a strict evidence-grounded pharmaceutical analyst.",
                    temperature=0.1,
                    max_tokens=600,
                )
                text = (result or "").strip()
                if text == "ABSTAIN_UNVERIFIED":
                    return "Insufficient verified evidence available right now."
                return text
        except Exception:
            pass

        top = evidence[:3]
        return " ".join(
            [f"{ev.claim_text} ({ev.claim_id})" for ev in top]
        )

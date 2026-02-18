"""
SentinelPharma Web Intelligence Agent (Real-Time Signals)
=======================================================
Monitors web sources for real-time pharmaceutical intelligence.

Responsibilities:
- Scrape Scientific Journals (PubMed) for efficacy signals
- Monitor News & Guidelines for regulatory changes
- Vision AI to read charts and graphs from PDF papers
- Track industry announcements and press releases
"""

import random
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, List
from datetime import timezone

import structlog
from ..services.llm_service import get_llm_service
from ..services.prompt_templates import PromptTemplates
from ..utils.drug_data_generator import DrugDataGenerator
from ..core.evidence_schema import EvidenceRecord, EvidenceSource, EvidenceRetrieval, EvidenceQuality
from ..services.evidence_validator import EvidenceValidator
from ..services.grounded_summarizer import GroundedSummarizer
from ..services.source_connectors import PubMedConnector, FDAConnector, ClinicalTrialsConnector

logger = structlog.get_logger(__name__)


class WebIntelligenceAgent:
    """
    Web Intelligence Agent - Real-Time Signal Detection.
    
    This agent monitors web sources for:
    - New scientific publications
    - Regulatory announcements
    - Industry news and guidelines
    - Chart/graph interpretation from papers
    """
    
    def __init__(self):
        self.name = "WebIntelligenceAgent"
        self.version = "1.0.0"
        self.llm_service = get_llm_service()
        self.evidence_validator = EvidenceValidator()
        self.grounded_summarizer = GroundedSummarizer()
        self.pubmed = PubMedConnector()
        self.fda = FDAConnector()
        self.clinical_trials = ClinicalTrialsConnector()
        
        # Grounded sources
        self.sources = [
            "PubMed", "ClinicalTrials.gov", "openFDA"
        ]
        
        logger.info(f"Initialized {self.name} v{self.version}")
    
    async def analyze(self, molecule: str, llm_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Perform web intelligence gathering for a molecule.
        
        Args:
            molecule: Drug/compound to research
            llm_config: LLM configuration
            
        Returns:
            Web intelligence report with real-time signals
        """
        start_time = datetime.now()
        
        logger.info(
            "web_intelligence_started",
            molecule=molecule,
            agent=self.name
        )
        
        pubmed_rows, fda_rows, ct_rows = await asyncio.gather(
            self.pubmed.search(query=molecule, limit=5),
            self.fda.search_labels(molecule=molecule, limit=5),
            self.clinical_trials.search(query=molecule, limit=5),
            return_exceptions=True,
        )

        raw_rows: List[Dict[str, Any]] = []
        for batch in [pubmed_rows, fda_rows, ct_rows]:
            if isinstance(batch, Exception):
                logger.warning("connector_failed", agent=self.name, error=str(batch))
                continue
            raw_rows.extend(batch)

        evidence = self._rows_to_evidence(raw_rows)
        evidence = self.evidence_validator.detect_and_mark_conflicts(evidence)
        verification_summary = self.evidence_validator.summarize_verification(evidence)
        freshness_summary = self.evidence_validator.summarize_freshness(evidence)
        abstained, abstain_reason = self.evidence_validator.should_abstain(evidence)

        if abstained:
            llm_intelligence = "Insufficient verified evidence available right now."
        else:
            llm_intelligence = await self.grounded_summarizer.summarize(evidence, llm_config)

        claims = [
            {
                "claim_id": item.claim_id,
                "claim_text": item.claim_text,
                "verification_status": item.quality.verification_status,
                "support_count": 1,
            }
            for item in evidence
        ]

        source_counts = {
            "pubmed": len([row for row in raw_rows if row.get("source_name") == "PubMed"]),
            "openfda": len([row for row in raw_rows if row.get("source_name") == "openFDA"]),
            "clinicaltrials": len([row for row in raw_rows if row.get("source_name") == "ClinicalTrials.gov"]),
        }

        result = {
            "molecule": molecule,
            "analysis_date": datetime.now(timezone.utc).isoformat(),
            "claims": claims,
            "evidence": [item.model_dump(mode="json") for item in evidence],
            "verification_summary": verification_summary.model_dump(),
            "freshness_summary": freshness_summary.model_dump(mode="json"),
            "abstained": abstained,
            "abstain_reason": abstain_reason,
            "intelligence_summary": {
                "overall_sentiment": "Evidence-based",
                "key_developments": [
                    f"PubMed records: {source_counts['pubmed']}",
                    f"openFDA label records: {source_counts['openfda']}",
                    f"ClinicalTrials.gov records: {source_counts['clinicaltrials']}",
                ],
                "watch_points": [
                    "Review latest official regulatory label updates",
                    "Track trial status changes in ClinicalTrials.gov",
                    "Monitor newly indexed PubMed publications",
                ],
                "opportunity_score": round(min(9.5, max(1.0, verification_summary.verified_count + (verification_summary.partial_count * 0.5))), 1),
                "last_updated": datetime.now(timezone.utc).isoformat(),
            },
            "llm_intelligence": llm_intelligence,
            "llm_provider": llm_config.get("provider") if llm_intelligence and not abstained else None,
            "data_sources": self.sources,
            "agent": self.name,
            "version": self.version,
            "model_used": llm_config.get("model"),
            "processing_time_ms": round((datetime.now() - start_time).total_seconds() * 1000, 2),
        }
        
        logger.info(
            "web_intelligence_completed",
            molecule=molecule,
            evidence_count=len(result["evidence"]),
            abstained=result["abstained"]
        )
        
        return result

    def _rows_to_evidence(self, rows: List[Dict[str, Any]]) -> List[EvidenceRecord]:
        evidence_records: List[EvidenceRecord] = []

        for row in rows:
            try:
                fetched_at_raw = row.get("fetched_at")
                published_at_raw = row.get("published_at")

                fetched_at = datetime.fromisoformat(fetched_at_raw) if fetched_at_raw else datetime.now(timezone.utc)
                published_at = datetime.fromisoformat(published_at_raw) if published_at_raw else None

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
                evidence_records.append(record)
            except Exception as exc:
                logger.warning("evidence_row_skipped", agent=self.name, error=str(exc))

        return evidence_records

    async def search_pubmed(self, query: str, limit: int = 10) -> Dict[str, Any]:
        rows = await self.pubmed.search(query=query, limit=limit)
        return {
            "query": query,
            "count": len(rows),
            "records": rows,
        }
    
    def _search_pubmed(self, molecule: str, web_data: Dict[str, Any]) -> Dict[str, Any]:
        """Search PubMed for recent publications."""
        # Generate mock recent papers
        paper_titles = [
            f"Novel therapeutic applications of {molecule} in metabolic disorders",
            f"Phase 2 results for {molecule} combination therapy show promise",
            f"Mechanism of action study reveals new targets for {molecule}",
            f"Long-term safety profile of {molecule}: A retrospective analysis",
            f"Comparative efficacy of {molecule} vs standard of care",
            f"{molecule} in pediatric populations: A systematic review",
            f"Biomarker identification for {molecule} response prediction",
            f"Real-world evidence for {molecule} in clinical practice"
        ]
        
        journals = [
            "Nature Medicine", "NEJM", "The Lancet", "JAMA", 
            "Journal of Clinical Oncology", "Blood", "Cell",
            "Science Translational Medicine"
        ]
        
        recent_papers = []
        num_papers = web_data["num_recent_papers"]
        
        for i in range(num_papers):
            days_ago = random.randint(1, 30)
            recent_papers.append({
                "title": random.choice(paper_titles),
                "journal": random.choice(journals),
                "published_date": (datetime.now() - timedelta(days=days_ago)).strftime("%Y-%m-%d"),
                "pmid": f"{random.randint(30000000, 39999999)}",
                "impact_factor": round(random.uniform(10, 80), 1),
                "citation_count": random.randint(0, 50),
                "key_finding": random.choice([
                    "Positive efficacy signal in Phase 2",
                    "Novel mechanism identified",
                    "Safety concerns addressed",
                    "Biomarker for patient selection discovered",
                    "Synergistic combination identified"
                ])
            })
        
        return {
            "total_publications": web_data["total_publications"],
            "publications_last_year": web_data["publications_last_year"],
            "publications_last_30_days": web_data["publications_last_30_days"],
            "recent_papers": recent_papers,
            "trending_topics": [
                f"{molecule} + immunotherapy",
                f"{molecule} biomarkers",
                f"{molecule} resistance mechanisms",
                f"{molecule} combination strategies"
            ][:random.randint(2, 4)],
            "publication_trend": web_data["publication_trend"]
        }
    
    def _monitor_news(self, molecule: str, web_data: Dict[str, Any]) -> Dict[str, Any]:
        """Monitor news sources for industry signals."""
        news_items = []
        
        news_templates = [
            {"type": "Partnership", "headline": f"Major pharma announces partnership for {molecule} development"},
            {"type": "FDA Update", "headline": f"FDA grants Fast Track designation to {molecule}"},
            {"type": "Clinical Results", "headline": f"Positive Phase 3 results announced for {molecule}"},
            {"type": "Market Entry", "headline": f"Generic version of {molecule} approved in EU"},
            {"type": "Investment", "headline": f"VC firm invests $500M in {molecule} developer"},
            {"type": "Acquisition", "headline": f"Big Pharma acquires {molecule} rights for $2B"},
            {"type": "Safety Signal", "headline": f"FDA issues safety communication regarding {molecule}"},
            {"type": "Label Expansion", "headline": f"New indication approved for {molecule}"}
        ]
        
        num_news = min(web_data["num_news_items"], len(news_templates))
        selected = random.sample(news_templates, num_news)
        
        for item in selected:
            days_ago = random.randint(1, 14)
            news_items.append({
                "headline": item["headline"],
                "type": item["type"],
                "source": random.choice(["Reuters", "FiercePharma", "Endpoints", "STAT News", "Bloomberg"]),
                "date": (datetime.now() - timedelta(days=days_ago)).strftime("%Y-%m-%d"),
                "sentiment": random.choice(["Positive", "Neutral", "Negative"]),
                "impact_score": random.randint(1, 10),
                "url": f"https://news.example.com/pharma/{random.randint(10000, 99999)}"
            })
        
        # Calculate sentiment distribution
        sentiments = [n["sentiment"] for n in news_items]
        
        return {
            "news_items": news_items,
            "total_mentions_7d": random.randint(10, 100),
            "sentiment_distribution": {
                "positive": sentiments.count("Positive"),
                "neutral": sentiments.count("Neutral"),
                "negative": sentiments.count("Negative")
            },
            "trending_score": random.randint(1, 100),
            "key_themes": [
                "Clinical development progress",
                "Commercial potential",
                "Competitive dynamics"
            ]
        }
    
    def _check_regulatory(self, molecule: str, web_data: Dict[str, Any]) -> Dict[str, Any]:
        """Check regulatory updates and guidelines."""
        updates = []
        
        regulatory_events = [
            {"agency": "FDA", "event": "New Drug Application submitted", "status": "Under Review"},
            {"agency": "FDA", "event": "Complete Response Letter issued", "status": "Action Required"},
            {"agency": "EMA", "event": "CHMP positive opinion", "status": "Approved"},
            {"agency": "PMDA", "event": "Marketing authorization granted", "status": "Approved"},
            {"agency": "FDA", "event": "Breakthrough Therapy designation", "status": "Granted"},
            {"agency": "WHO", "event": "Essential Medicines List inclusion", "status": "Under Review"}
        ]
        
        num_updates = random.randint(1, 3)
        selected = random.sample(regulatory_events, num_updates)
        
        for update in selected:
            days_ago = random.randint(1, 60)
            updates.append({
                "agency": update["agency"],
                "event": update["event"],
                "status": update["status"],
                "date": (datetime.now() - timedelta(days=days_ago)).strftime("%Y-%m-%d"),
                "impact": random.choice(["High", "Medium", "Low"]),
                "next_action_date": (datetime.now() + timedelta(days=random.randint(30, 180))).strftime("%Y-%m-%d")
            })
        
        # Determine overall risk level
        negative_events = ["Complete Response Letter", "Warning Letter", "Clinical Hold"]
        has_negative = any(neg in u["event"] for u in updates for neg in negative_events)
        
        return {
            "updates": updates,
            "pending_decisions": random.randint(0, 3),
            "risk_level": "HIGH" if has_negative else random.choice(["LOW", "MEDIUM"]),
            "upcoming_pdufa_dates": [
                {
                    "indication": "Indication A",
                    "date": (datetime.now() + timedelta(days=random.randint(30, 365))).strftime("%Y-%m-%d"),
                    "agency": "FDA"
                }
            ] if random.random() > 0.5 else [],
            "guideline_changes": [
                "Updated dosing recommendations in NCCN guidelines",
                "New treatment algorithm includes molecule"
            ] if random.random() > 0.6 else []
        }
    
    def _analyze_charts(self, molecule: str) -> Dict[str, Any]:
        """
        Vision AI analysis of charts and graphs from papers.
        Simulates Gemini Vision analysis of scientific figures.
        """
        chart_insights = []
        
        chart_types = [
            {
                "type": "Kaplan-Meier Curve",
                "insight": "Survival benefit observed with HR=0.65 (p<0.001)",
                "source": "Phase 3 primary analysis"
            },
            {
                "type": "Waterfall Plot",
                "insight": "85% of patients showed tumor shrinkage; 35% achieved PR",
                "source": "Efficacy assessment figure"
            },
            {
                "type": "Forest Plot",
                "insight": "Consistent benefit across subgroups; no heterogeneity",
                "source": "Subgroup analysis"
            },
            {
                "type": "Swimmer Plot",
                "insight": "Durable responses observed; median DoR not reached",
                "source": "Duration of response analysis"
            },
            {
                "type": "Bar Chart",
                "insight": "ORR of 62% vs 35% for comparator (p<0.001)",
                "source": "Response rate comparison"
            }
        ]
        
        num_charts = random.randint(2, 4)
        selected = random.sample(chart_types, num_charts)
        
        for chart in selected:
            chart_insights.append({
                "figure_type": chart["type"],
                "extracted_insight": chart["insight"],
                "data_source": chart["source"],
                "confidence": round(random.uniform(0.85, 0.98), 2),
                "clinical_significance": random.choice(["High", "Medium", "High"])
            })
        
        return {
            "charts_analyzed": len(chart_insights),
            "insights": chart_insights,
            "vision_model": "Gemini Vision",
            "key_visual_findings": [
                insight["extracted_insight"] for insight in chart_insights[:2]
            ]
        }
    
    def _monitor_social(self, molecule: str) -> Dict[str, Any]:
        """Monitor social/community signals."""
        return {
            "twitter_mentions_7d": random.randint(50, 500),
            "linkedin_discussions": random.randint(10, 100),
            "reddit_threads": random.randint(5, 50),
            "key_influencers": [
                {
                    "name": f"Dr. Expert {i}",
                    "platform": random.choice(["Twitter/X", "LinkedIn"]),
                    "followers": random.randint(10000, 100000),
                    "sentiment": random.choice(["Positive", "Neutral", "Positive"])
                }
                for i in range(3)
            ],
            "community_sentiment": random.choice(["Bullish", "Neutral", "Mixed"]),
            "trending_hashtags": [
                f"#{molecule.replace(' ', '')}",
                "#DrugDiscovery",
                "#Pharma"
            ]
        }
    
    def _calculate_signal_strength(self, news_signals: Dict) -> str:
        """Calculate overall signal strength."""
        trending = news_signals.get("trending_score", 50)
        positive = news_signals.get("sentiment_distribution", {}).get("positive", 0)
        
        if trending > 70 and positive > 2:
            return "STRONG POSITIVE"
        elif trending > 50:
            return "MODERATE"
        else:
            return "WEAK"
    
    def _generate_summary(
        self, 
        pubmed: Dict, 
        news: Dict, 
        regulatory: Dict
    ) -> Dict[str, Any]:
        """Generate intelligence summary."""
        return {
            "overall_sentiment": random.choice(["Positive", "Neutral", "Mixed"]),
            "key_developments": [
                f"{pubmed['publications_last_30_days']} new publications in last 30 days",
                f"{len(news['news_items'])} significant news events",
                f"{len(regulatory['updates'])} regulatory updates"
            ],
            "watch_points": [
                "Monitor upcoming PDUFA date",
                "Track competitive pipeline developments",
                "Follow KOL commentary on recent data"
            ],
            "opportunity_score": round(random.uniform(6, 9.5), 1),
            "last_updated": datetime.now().isoformat()
        }
    
    def _generate_alerts(
        self, 
        molecule: str, 
        news: Dict, 
        regulatory: Dict
    ) -> List[Dict[str, Any]]:
        """Generate actionable alerts."""
        alerts = []
        
        # High-impact news alerts
        for item in news.get("news_items", []):
            if item.get("impact_score", 0) >= 7:
                alerts.append({
                    "type": "NEWS_ALERT",
                    "priority": "HIGH" if item["impact_score"] >= 9 else "MEDIUM",
                    "title": item["headline"],
                    "action": "Review and assess strategic implications"
                })
        
        # Regulatory alerts
        for update in regulatory.get("updates", []):
            if update.get("impact") == "High":
                alerts.append({
                    "type": "REGULATORY_ALERT",
                    "priority": "HIGH",
                    "title": f"{update['agency']}: {update['event']}",
                    "action": "Immediate review required"
                })
        
        return alerts

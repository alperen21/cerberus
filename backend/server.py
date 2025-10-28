"""
Cerberus Backend API Server
Handles phishing detection requests from the Chrome extension
"""
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import base64
import logging
from datetime import datetime
from pathlib import Path
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from agentic.agent import CerberusAgent

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Cerberus API",
    description="Phishing detection and brand verification API",
    version="1.0.0"
)

# Configure CORS for Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Cerberus agent (global instance)
logger.info("Initializing Cerberus agent...")
cerberus_agent: Optional[CerberusAgent] = None

@app.on_event("startup")
async def startup_event():
    """Initialize the Cerberus agent on startup"""
    global cerberus_agent
    try:
        cerberus_agent = CerberusAgent()
        logger.info("Cerberus agent initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Cerberus agent: {e}")
        raise


# Request/Response models
class ViewportSize(BaseModel):
    width: int = Field(default=1920, ge=100, le=7680)
    height: int = Field(default=1080, ge=100, le=4320)


class AnalysisRequest(BaseModel):
    url: str = Field(..., description="The URL being analyzed")
    domain: str = Field(..., description="The domain extracted from the URL")
    screenshot_base64: str = Field(..., description="Base64 encoded screenshot")
    css_selector: Optional[str] = Field(None, description="Optional CSS selector for targeted analysis")
    viewport_size: Optional[ViewportSize] = Field(default_factory=lambda: ViewportSize())
    user_event: Optional[str] = Field(None, description="User event that triggered analysis")


class CheckUrlRequest(BaseModel):
    url: str = Field(..., description="The URL to check")
    domain: str = Field(..., description="The domain extracted from the URL")


class CheckUrlResponse(BaseModel):
    status: str  # 'safe', 'dangerous', 'needs_analysis'
    reason: Optional[str] = None
    in_whitelist: bool = False
    in_blacklist: bool = False


class Reason(BaseModel):
    code: str
    label: str
    detail: str


class Highlight(BaseModel):
    id: str
    type: str
    selector: Optional[str] = None
    coords: Optional[Dict[str, float]] = None
    crop_base64: Optional[str] = None


class SuggestedAction(BaseModel):
    action: str  # 'leave', 'report', 'continue', 'block'
    label: str
    description: Optional[str] = None


class AnalysisResponse(BaseModel):
    verdict: str  # 'safe', 'suspicious', 'dangerous'
    confidence: float = Field(ge=0.0, le=1.0)
    reasons: List[Reason]
    highlights: List[Highlight]
    explanation: str
    explanation_html: Optional[str] = None
    suggested_actions: List[SuggestedAction]
    processing_time_ms: float
    timestamp: str


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "Cerberus API",
        "status": "running",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "agent_initialized": cerberus_agent is not None,
        "timestamp": datetime.now().isoformat()
    }


@app.post("/api/check-url", response_model=CheckUrlResponse)
async def check_url(
    request: CheckUrlRequest,
    x_client_id: Optional[str] = Header(None),
    x_extension_version: Optional[str] = Header(None)
):
    """
    Fast pre-check endpoint that only checks whitelist/blacklist

    Returns:
    - 'safe' if URL is in whitelist
    - 'dangerous' if URL is in blacklist
    - 'needs_analysis' if URL needs full LLM analysis
    """
    if cerberus_agent is None:
        logger.error("Cerberus agent not initialized")
        raise HTTPException(status_code=503, detail="Service unavailable - agent not initialized")

    try:
        logger.info(f"🔍 [CHECK-URL] Checking URL: {request.url}")
        logger.info(f"🌐 [CHECK-URL] Domain: {request.domain}")

        # Check global whitelist first
        is_in_whitelist = cerberus_agent.whitelist.check(request.url)
        if is_in_whitelist:
            logger.info(f"✅ [CHECK-URL] URL is in global whitelist - SAFE")
            return CheckUrlResponse(
                status='safe',
                reason='Domain found in global whitelist of trusted sites',
                in_whitelist=True,
                in_blacklist=False
            )

        # Check blacklist
        is_in_blacklist = cerberus_agent.blacklist.check(request.url)
        if is_in_blacklist:
            logger.info(f"🚨 [CHECK-URL] URL is in blacklist - DANGEROUS")
            return CheckUrlResponse(
                status='dangerous',
                reason='Domain found in blacklist of known malicious sites',
                in_whitelist=False,
                in_blacklist=True
            )

        # Check personal whitelist (cache)
        is_in_personal_whitelist = cerberus_agent.personalWhitelist.check(request.url)
        if is_in_personal_whitelist:
            logger.info(f"✅ [CHECK-URL] URL is in personal whitelist - SAFE")
            return CheckUrlResponse(
                status='safe',
                reason='Domain previously marked as safe by user',
                in_whitelist=True,
                in_blacklist=False
            )

        # URL needs full analysis
        logger.info(f"🔬 [CHECK-URL] URL needs full analysis")
        return CheckUrlResponse(
            status='needs_analysis',
            reason='URL not found in whitelist or blacklist, requires full analysis',
            in_whitelist=False,
            in_blacklist=False
        )

    except Exception as e:
        logger.error(f"❌ [CHECK-URL] Error checking URL: {str(e)}")
        raise HTTPException(status_code=500, detail=f"URL check failed: {str(e)}")


@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze_screenshot(
    request: AnalysisRequest,
    x_client_id: Optional[str] = Header(None),
    x_extension_version: Optional[str] = Header(None)
):
    """
    Analyze a screenshot for phishing detection

    This endpoint receives a screenshot and URL from the Chrome extension,
    and returns a verdict with confidence score, reasons, and suggested actions.
    """
    if cerberus_agent is None:
        logger.error("Cerberus agent not initialized")
        raise HTTPException(status_code=503, detail="Service unavailable - agent not initialized")

    start_time = datetime.now()

    try:
        # Log request receipt
        logger.info("=" * 80)
        logger.info(f"📸 [CERBERUS] Received screenshot analysis request")
        logger.info(f"🔗 URL: {request.url}")
        logger.info(f"🌐 Domain: {request.domain}")
        logger.info(f"👤 Client ID: {x_client_id}")
        logger.info(f"📦 Extension Version: {x_extension_version}")

        # Validate base64 screenshot
        try:
            # Test decode to ensure valid base64
            decoded = base64.b64decode(request.screenshot_base64)
            screenshot_size_kb = len(decoded) / 1024
            logger.info(f"📊 Screenshot size: {screenshot_size_kb:.2f} KB")
            if request.viewport_size:
                logger.info(f"📐 Viewport: {request.viewport_size.width}x{request.viewport_size.height}")
            else:
                logger.info("📐 Viewport: Not provided")
        except Exception as e:
            logger.error(f"❌ Invalid base64 screenshot: {e}")
            raise HTTPException(status_code=400, detail="Invalid base64 screenshot")

        # Invoke the Cerberus agent
        logger.info("🤖 [CERBERUS] Starting LLM analysis...")
        logger.info("   ↳ Running whitelist/blacklist checks...")
        logger.info("   ↳ Preparing to invoke vision models...")

        llm_start = datetime.now()
        result = cerberus_agent.invoke(
            screenshot=request.screenshot_base64,
            url=request.url
        )
        llm_time = (datetime.now() - llm_start).total_seconds() * 1000

        logger.info(f"✅ [CERBERUS] LLM analysis completed in {llm_time:.2f}ms")

        # Map agent result to API response
        verdict = map_label_to_verdict(result.get('label', 'unknown'))
        confidence = result.get('confidence', 0.0) or 0.0
        reasons_text = result.get('reasons', 'No specific reasons provided')

        # Build structured response
        reasons = [
            Reason(
                code="whitelist_check" if result.get('is_in_global_whitelist') else "analysis_result",
                label="Whitelist Check" if result.get('is_in_global_whitelist') else "Brand Analysis",
                detail=reasons_text if isinstance(reasons_text, str) else str(reasons_text)
            )
        ]

        # Add whitelist/blacklist info
        if result.get('is_in_global_whitelist'):
            reasons.append(Reason(
                code="global_whitelist",
                label="Trusted Domain",
                detail="Domain found in global whitelist of trusted sites"
            ))

        if result.get('is_in_personal_whitelist'):
            reasons.append(Reason(
                code="personal_whitelist",
                label="Personal Whitelist",
                detail="Domain previously marked as safe by user"
            ))

        if result.get('is_in_blacklist'):
            reasons.append(Reason(
                code="blacklist",
                label="Known Threat",
                detail="Domain found in blacklist of known malicious sites"
            ))

        # Generate highlights (placeholder for now)
        highlights = result.get('highlights', [])
        if not isinstance(highlights, list):
            highlights = []

        # Convert highlights to proper format
        formatted_highlights = [
            Highlight(
                id=f"highlight_{i}",
                type="suspicious_element",
                selector=h.get('selector') if isinstance(h, dict) else None,
                coords=h.get('coords') if isinstance(h, dict) else None,
                crop_base64=h.get('crop_base64') if isinstance(h, dict) else None
            )
            for i, h in enumerate(highlights)
        ]

        # Suggested actions based on verdict
        suggested_actions = generate_suggested_actions(verdict, confidence, result)

        # Explanation
        explanation = f"Analysis of {request.domain}: {reasons_text}"
        explanation_html = result.get('explanation_html', f"<p>{explanation}</p>")

        # Calculate processing time
        processing_time = (datetime.now() - start_time).total_seconds() * 1000

        response = AnalysisResponse(
            verdict=verdict,
            confidence=confidence,
            reasons=reasons,
            highlights=formatted_highlights,
            explanation=explanation,
            explanation_html=explanation_html,
            suggested_actions=suggested_actions,
            processing_time_ms=round(processing_time, 2),
            timestamp=datetime.now().isoformat()
        )

        # Log final results
        logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        logger.info(f"🎯 [RESULT] Verdict: {verdict.upper()}")
        logger.info(f"📊 [RESULT] Confidence: {confidence * 100:.1f}%")
        logger.info(f"💡 [RESULT] Explanation: {explanation}")
        logger.info(f"📋 [RESULT] Reasons count: {len(reasons)}")
        for i, reason in enumerate(reasons, 1):
            logger.info(f"   {i}. [{reason.code}] {reason.label}")
        logger.info(f"⏱️  [RESULT] Total processing time: {processing_time:.2f}ms")
        logger.info(f"   ↳ LLM time: {llm_time:.2f}ms")
        logger.info(f"   ↳ Other processing: {(processing_time - llm_time):.2f}ms")
        logger.info("=" * 80)

        return response

    except HTTPException:
        raise
    except Exception as e:
        error_time = (datetime.now() - start_time).total_seconds() * 1000
        logger.error("=" * 80)
        logger.error(f"❌ [ERROR] Analysis failed after {error_time:.2f}ms")
        logger.error(f"❌ [ERROR] URL: {request.url}")
        logger.error(f"❌ [ERROR] Exception: {str(e)}")
        logger.error("=" * 80, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


def map_label_to_verdict(label: str) -> str:
    """Map agent label to API verdict"""
    label = label.lower() if label else 'unknown'

    if label in ['benign', 'safe', 'legitimate']:
        return 'safe'
    elif label in ['phishing', 'malicious', 'dangerous']:
        return 'dangerous'
    else:
        return 'suspicious'


def generate_suggested_actions(verdict: str, confidence: float, result: Dict[str, Any]) -> List[SuggestedAction]:
    """Generate suggested actions based on verdict and confidence"""
    actions = []

    if verdict == 'dangerous':
        actions.append(SuggestedAction(
            action='leave',
            label='Leave Site',
            description='Close this page immediately to protect your information'
        ))
        actions.append(SuggestedAction(
            action='report',
            label='Report Phishing',
            description='Help others by reporting this suspicious site'
        ))
    elif verdict == 'suspicious':
        actions.append(SuggestedAction(
            action='leave',
            label='Leave Site (Recommended)',
            description='This site shows suspicious characteristics'
        ))
        actions.append(SuggestedAction(
            action='continue',
            label='Continue Anyway',
            description='Proceed with caution if you trust this site'
        ))
        actions.append(SuggestedAction(
            action='report',
            label='Report Issue',
            description='Report if you believe this is a false positive'
        ))
    else:  # safe
        actions.append(SuggestedAction(
            action='continue',
            label='Continue',
            description='This site appears to be legitimate'
        ))
        if not result.get('is_in_personal_whitelist'):
            actions.append(SuggestedAction(
                action='report',
                label='Report False Positive',
                description='Report if you believe this assessment is incorrect'
            ))

    return actions


@app.post("/api/feedback")
async def submit_feedback(
    url: str,
    verdict: str,
    user_feedback: str,
    correct_verdict: Optional[str] = None,
    x_client_id: Optional[str] = Header(None)
):
    """
    Submit user feedback on analysis results
    Used for improving the model over time
    """
    logger.info(f"Received feedback for {url}: {user_feedback}")

    # Store feedback (implement your storage logic here)
    feedback_entry = {
        "timestamp": datetime.now().isoformat(),
        "url": url,
        "verdict": verdict,
        "user_feedback": user_feedback,
        "correct_verdict": correct_verdict,
        "client_id": x_client_id
    }

    # TODO: Store to database or file for later analysis

    return {
        "success": True,
        "message": "Feedback received, thank you!"
    }


@app.get("/api/stats")
async def get_stats():
    """Get API statistics"""
    return {
        "agent_initialized": cerberus_agent is not None,
        "uptime": "TODO",
        "total_requests": "TODO",
        "average_processing_time": "TODO"
    }


if __name__ == "__main__":
    import uvicorn

    # Run the server
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )

import logging

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from ..schemas import ReviewRequest, ReviewResponse
from ..services.review import review_state_machine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/review", tags=["review"])


@router.post("/", response_model=ReviewResponse)
async def review(request: ReviewRequest):
    """Run design-review checks over a (generated or saved) state machine.

    Deterministic graph + coverage checks always run; AI augmentation is optional
    and best-effort when spec_text is provided and AI is configured.
    """
    if not request.states:
        raise HTTPException(status_code=400, detail="State machine has no states to review")

    # The AI augmentation may block on a network call, so offload to a threadpool.
    return await run_in_threadpool(review_state_machine, request)

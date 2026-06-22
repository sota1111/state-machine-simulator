import logging

from fastapi import APIRouter, HTTPException

from ..schemas import TestCaseRequest, TestCaseResponse
from ..services.testcase import generate_test_cases_for_request

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/testcases", tags=["testcases"])


@router.post("/", response_model=TestCaseResponse)
def generate(request: TestCaseRequest):
    """Generate normal / abnormal / cancel / timeout test cases for a state machine.

    Generation is deterministic (no AI required)."""
    if not request.states:
        raise HTTPException(status_code=400, detail="State machine has no states")
    return generate_test_cases_for_request(request)

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..services.nlp import parse_natural_language
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/parse", tags=["parse"])

class ParseRequest(BaseModel):
    text: str

class ParseResponse(BaseModel):
    name: str
    description: str = ""
    initial_state: str
    states: list[dict]
    transitions: list[dict]

@router.post("/", response_model=ParseResponse)
def parse_text(request: ParseRequest):
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Input text cannot be empty")
    
    if len(request.text) > 10000:
        raise HTTPException(status_code=400, detail="Input text too long (max 10000 characters)")
    
    try:
        result = parse_natural_language(request.text)
        return ParseResponse(**result)
    except ValueError as e:
        logger.error(f"Parse validation error: {e}")
        raise HTTPException(status_code=422, detail=f"Failed to parse state machine: {str(e)}")
    except RuntimeError as e:
        logger.error(f"Parse runtime error: {e}")
        raise HTTPException(status_code=503, detail=str(e))

import logging
import hashlib
from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from ..services.nlp import parse_natural_language, refine_state_machine, APIKeyNotConfiguredError, AIRateLimitError, AIServiceUnavailableError, AIParseError
from ..services.cache import parse_cache

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
    # Unique event names derived from the transitions (SOT-1095). Defaults to empty so
    # older cache entries without `events` still serialize safely.
    events: list[str] = []

class RefineRequest(BaseModel):
    instruction: str
    name: str
    description: str = ""
    initial_state: str
    states: list[dict]
    transitions: list[dict]

@router.post("/", response_model=ParseResponse)
async def parse_text(request: ParseRequest):
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Input text cannot be empty")
    
    normalized_text = request.text.strip()
    if len(normalized_text) > 10000:
        raise HTTPException(status_code=400, detail="Input text too long (max 10000 characters)")
    
    # 1. Check cache
    cache_key = hashlib.sha256(normalized_text.encode()).hexdigest()
    cached_result = parse_cache.get(cache_key)
    if cached_result:
        logger.info("Cache hit for parse request")
        return ParseResponse(**cached_result)
    
    # 2. Cache miss, call NLP service (offloaded to threadpool)
    try:
        result = await run_in_threadpool(parse_natural_language, normalized_text)
        
        # 3. Store in cache on success
        parse_cache.set(cache_key, result)
        
        return ParseResponse(**result)
    except AIRateLimitError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except AIServiceUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except AIParseError as e:
        # AI responded but the result could not be parsed even after retries.
        raise HTTPException(status_code=502, detail=str(e))
    except APIKeyNotConfiguredError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except ValueError as e:
        logger.error(f"Parse validation error: {e}")
        raise HTTPException(status_code=422, detail=f"Failed to parse state machine: {str(e)}")
    except RuntimeError as e:
        logger.error(f"Parse runtime error: {e}")
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/refine", response_model=ParseResponse)
async def refine_text(request: RefineRequest):
    if not request.instruction or not request.instruction.strip():
        raise HTTPException(status_code=400, detail="Instruction cannot be empty")

    if not request.states:
        raise HTTPException(status_code=400, detail="Current workflow has no states to refine")

    instruction = request.instruction.strip()
    if len(instruction) > 10000:
        raise HTTPException(status_code=400, detail="Instruction too long (max 10000 characters)")

    current = {
        "name": request.name,
        "description": request.description,
        "initial_state": request.initial_state,
        "states": request.states,
        "transitions": request.transitions,
    }

    # Refinement depends on both the current workflow and the instruction, so it is not
    # served from the parse cache.
    try:
        result = await run_in_threadpool(refine_state_machine, current, instruction)
        return ParseResponse(**result)
    except AIRateLimitError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except AIServiceUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except AIParseError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except APIKeyNotConfiguredError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except ValueError as e:
        logger.error(f"Refine validation error: {e}")
        raise HTTPException(status_code=422, detail=f"Failed to refine state machine: {str(e)}")
    except RuntimeError as e:
        logger.error(f"Refine runtime error: {e}")
        raise HTTPException(status_code=503, detail=str(e))

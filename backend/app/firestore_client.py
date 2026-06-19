import os
import logging

logger = logging.getLogger(__name__)

_firestore_client = None

def get_firestore_client():
    global _firestore_client
    if _firestore_client is not None:
        return _firestore_client

    project_id = os.getenv("GCP_PROJECT_ID")
    if not project_id:
        raise RuntimeError(
            "GCP_PROJECT_ID environment variable is not set. "
            "Set it to your GCP project ID to use Firestore in production."
        )

    try:
        from google.cloud import firestore
        _firestore_client = firestore.Client(project=project_id)
        logger.info(f"Firestore client initialized for project: {project_id}")
        return _firestore_client
    except Exception as e:
        logger.error(f"Failed to initialize Firestore client: {e}")
        raise RuntimeError(f"Firestore initialization failed: {e}")

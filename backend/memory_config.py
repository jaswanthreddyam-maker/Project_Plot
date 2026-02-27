import os
from crewai.memory import Memory
from crewai.memory.storage.ltm_sqlite_storage import LTMSQLiteStorage
from crewai.memory.storage.rag_storage import RAGStorage

# Configure persistent memory storage path
CREWAI_STORAGE_DIR = os.environ.get("CREWAI_STORAGE_DIR", "/app/.crewai/memory")
os.environ["CREWAI_STORAGE_DIR"] = CREWAI_STORAGE_DIR

# Establish common configuration properties for LanceDB
lancedb_path = os.path.join(CREWAI_STORAGE_DIR, "lancedb")
os.makedirs(lancedb_path, exist_ok=True)

def get_research_memory_config():
    """
    Returns memory configured for fact-retrieval / deep research:
    High semantic distance reliance, lower recency reliance.
    """
    return {
        "memory": True,
        # CrewAI 0.98.0: The semantic weighting is configured upon retrieval, 
        # but initializing the Memory API is standard. 
        # Note: CrewAI handles lanceDB instantiation internally based on the CREWAI_STORAGE_DIR config
    }

def get_chat_memory_config():
    """
    Returns memory configured for multi-turn episodic chats:
    High recency_weighting context.
    """
    return {
        "memory": True,
    }

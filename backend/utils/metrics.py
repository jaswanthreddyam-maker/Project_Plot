import uuid
import os
import stripe
from datetime import datetime
from db_config import UsageLog, GlobalConfig

# Current Model Pricing (per 1M tokens) - Estimates as of 2026
PRICING = {
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "anthropic/claude-3-5-sonnet-20241022": {"input": 3.00, "output": 15.00},
    "default": {"input": 1.00, "output": 2.00} # Default fallback
}

def calculate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """
    Calculates the USD cost of an LLM call.
    """
    model_pricing = PRICING.get(model, PRICING["default"])
    cost = (prompt_tokens / 1_000_000) * model_pricing["input"] + \
           (completion_tokens / 1_000_000) * model_pricing["output"]
    return round(cost, 6)

def log_usage(db_session, execution_id: str, user_id: str, model: str, prompt_tokens: int, completion_tokens: int, status: str = "success"):
    """
    Persists usage data to the SQLite database and optionally reports to Stripe.
    """
    cost = calculate_cost(model, prompt_tokens, completion_tokens)
    
    usage_entry = UsageLog(
        id=str(uuid.uuid4()),
        user_id=user_id,
        execution_id=execution_id,
        model=model,
        prompt_tokens=str(prompt_tokens),
        completion_tokens=str(completion_tokens),
        total_cost=str(cost),
        status=status,
        timestamp=datetime.utcnow()
    )
    
    db_session.add(usage_entry)
    
    # ── Stripe Metered Billing Reporting ──
    try:
        config = db_session.query(GlobalConfig).filter(GlobalConfig.user_id == user_id).first()
        if config and config.stripe_subscription_item_id and config.subscription_status == "active":
            stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
            # Report total tokens as the quantity for the metered price
            total_tokens = prompt_tokens + completion_tokens
            if total_tokens > 0:
                stripe.SubscriptionItem.create_usage_record(
                    config.stripe_subscription_item_id,
                    quantity=total_tokens,
                    timestamp=int(datetime.utcnow().timestamp()),
                    action='increment'
                )
    except Exception as e:
        print(f"Failed to report usage to Stripe: {e}")

    db_session.commit()
    return usage_entry

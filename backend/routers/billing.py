import os
import stripe
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from backend.auth import get_current_user
from backend.db_config import SessionLocal, GlobalConfig
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/billing", tags=["billing"])

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")

class CheckoutRequest(BaseModel):
    plan_id: str # e.g., 'price_123' (a metered usage price)

@router.get("/status")
async def get_billing_status(current_user: str = Depends(get_current_user)):
    db = SessionLocal()
    try:
        config = db.query(GlobalConfig).filter(GlobalConfig.user_id == current_user).first()
        if not config:
            return {"status": "none", "customer_id": None}
        return {
            "status": config.subscription_status,
            "customer_id": config.stripe_customer_id,
            "has_item": config.stripe_subscription_item_id is not None
        }
    finally:
        db.close()

@router.post("/create-checkout-session")
async def create_checkout_session(req: CheckoutRequest, current_user: str = Depends(get_current_user)):
    db = SessionLocal()
    try:
        config = db.query(GlobalConfig).filter(GlobalConfig.user_id == current_user).first()
        customer_id = config.stripe_customer_id if config else None
        
        # Determine email (mocked for now)
        user_email = f"{current_user}@plot.ai"
        
        if not customer_id:
            customer = stripe.Customer.create(
                email=user_email,
                metadata={"user_id": current_user}
            )
            customer_id = customer.id
            if config:
                config.stripe_customer_id = customer_id
            else:
                config = GlobalConfig(id=str(uuid.uuid4()), user_id=current_user, stripe_customer_id=customer_id)
                db.add(config)
            db.commit()

        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=['card'],
            line_items=[{
                'price': req.plan_id,
            }],
            mode='subscription',
            success_url=f"{frontend_url}/billing?success=true&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{frontend_url}/billing?canceled=true",
            subscription_data={
                "metadata": {"user_id": current_user}
            }
        )
        return {"url": session.url}
    except Exception as e:
        print(f"Stripe Error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        db.close()

@router.post("/create-portal-session")
async def create_portal_session(current_user: str = Depends(get_current_user)):
    db = SessionLocal()
    try:
        config = db.query(GlobalConfig).filter(GlobalConfig.user_id == current_user).first()
        if not config or not config.stripe_customer_id:
            raise HTTPException(status_code=400, detail="No Stripe customer found")
        
        session = stripe.billing_portal.Session.create(
            customer=config.stripe_customer_id,
            return_url=f"{frontend_url}/billing",
        )
        return {"url": session.url}
    finally:
        db.close()

@router.post("/webhook")
async def stripe_webhook(request: Request, stripe_signature: Optional[str] = Header(None)):
    if not stripe_signature or not webhook_secret:
        raise HTTPException(status_code=400, detail="Missing signature or secret")
        
    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(payload, stripe_signature, webhook_secret)
    except stripe.error.SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    db = SessionLocal()
    try:
        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            customer_id = session['customer']
            subscription_id = session['subscription']
            
            # Fetch subscription to get items
            subscription = stripe.Subscription.retrieve(subscription_id)
            subscription_item_id = subscription['items']['data'][0]['id']
            
            config = db.query(GlobalConfig).filter(GlobalConfig.stripe_customer_id == customer_id).first()
            if config:
                config.subscription_status = "active"
                config.stripe_subscription_item_id = subscription_item_id
                db.commit()

        elif event['type'] in ['customer.subscription.updated', 'customer.subscription.deleted']:
            subscription = event['data']['object']
            customer_id = subscription['customer']
            status = subscription['status']
            
            config = db.query(GlobalConfig).filter(GlobalConfig.stripe_customer_id == customer_id).first()
            if config:
                config.subscription_status = status
                # If deleted, clear item ID
                if status == 'canceled' or event['type'] == 'customer.subscription.deleted':
                    config.subscription_status = "none"
                    config.stripe_subscription_item_id = None
                db.commit()

        return {"status": "success"}
    finally:
        db.close()

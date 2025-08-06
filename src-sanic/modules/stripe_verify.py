from sanic import Blueprint, response, Request
import stripe
import os

stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')

stripe_verify_bp = Blueprint('stripe_verify', url_prefix='/api')

@stripe_verify_bp.post('/verify-stripe-session')
async def verify_stripe_session(request: Request):
    data = request.json
    session_id = data.get('session_id')
    uid = data.get('uid')
    if not session_id or not uid:
        return response.json({'success': False, 'error': 'Missing session_id or uid'}, status=400)
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        if session.payment_status == 'paid' and session.metadata.get('uid') == uid:
            return response.json({'success': True})
        else:
            return response.json({'success': False, 'error': 'Payment not verified'})
    except Exception as e:
        return response.json({'success': False, 'error': str(e)}, status=500)

from sqlalchemy.orm import Session
from .models import StateMachine, State, Transition

def seed_sample_data(db: Session):
    if db.query(StateMachine).count() > 0:
        return

    # 1. ログインフロー (Login Flow)
    login_flow = StateMachine(
        name="ログインフロー (Login Flow)",
        description="A simple authentication flow",
        initial_state="Logged Out"
    )
    db.add(login_flow)
    db.flush()

    login_states = [
        State(machine_id=login_flow.id, name="Logged Out"),
        State(machine_id=login_flow.id, name="Authenticating"),
        State(machine_id=login_flow.id, name="Logged In"),
        State(machine_id=login_flow.id, name="Login Failed")
    ]
    db.add_all(login_states)

    login_transitions = [
        Transition(machine_id=login_flow.id, from_state="Logged Out", to_state="Authenticating", event="submit_credentials"),
        Transition(machine_id=login_flow.id, from_state="Authenticating", to_state="Logged In", event="auth_success"),
        Transition(machine_id=login_flow.id, from_state="Authenticating", to_state="Login Failed", event="auth_failure"),
        Transition(machine_id=login_flow.id, from_state="Login Failed", to_state="Logged Out", event="retry"),
        Transition(machine_id=login_flow.id, from_state="Logged In", to_state="Logged Out", event="logout")
    ]
    db.add_all(login_transitions)

    # 2. 注文フロー (Order Flow)
    order_flow = StateMachine(
        name="注文フロー (Order Flow)",
        description="E-commerce order lifecycle",
        initial_state="Cart"
    )
    db.add(order_flow)
    db.flush()

    order_states = [
        State(machine_id=order_flow.id, name="Cart"),
        State(machine_id=order_flow.id, name="Checkout"),
        State(machine_id=order_flow.id, name="Payment Processing"),
        State(machine_id=order_flow.id, name="Confirmed"),
        State(machine_id=order_flow.id, name="Shipped"),
        State(machine_id=order_flow.id, name="Delivered", is_terminal=True),
        State(machine_id=order_flow.id, name="Cancelled", is_terminal=True)
    ]
    db.add_all(order_states)

    order_transitions = [
        Transition(machine_id=order_flow.id, from_state="Cart", to_state="Checkout", event="proceed_to_checkout"),
        Transition(machine_id=order_flow.id, from_state="Checkout", to_state="Payment Processing", event="submit_payment"),
        Transition(machine_id=order_flow.id, from_state="Payment Processing", to_state="Confirmed", event="payment_confirmed"),
        Transition(machine_id=order_flow.id, from_state="Confirmed", to_state="Shipped", event="ship_order"),
        Transition(machine_id=order_flow.id, from_state="Shipped", to_state="Delivered", event="deliver_order"),
        Transition(machine_id=order_flow.id, from_state="Checkout", to_state="Cancelled", event="cancel"),
        Transition(machine_id=order_flow.id, from_state="Payment Processing", to_state="Checkout", event="payment_failed")
    ]
    db.add_all(order_transitions)

    # 3. 信号機 (Traffic Light)
    traffic_light = StateMachine(
        name="信号機 (Traffic Light)",
        description="Cyclic traffic light simulation",
        initial_state="Red"
    )
    db.add(traffic_light)
    db.flush()

    traffic_states = [
        State(machine_id=traffic_light.id, name="Red"),
        State(machine_id=traffic_light.id, name="Green"),
        State(machine_id=traffic_light.id, name="Yellow")
    ]
    db.add_all(traffic_states)

    traffic_transitions = [
        Transition(machine_id=traffic_light.id, from_state="Red", to_state="Green", event="timer_expire"),
        Transition(machine_id=traffic_light.id, from_state="Green", to_state="Yellow", event="timer_expire"),
        Transition(machine_id=traffic_light.id, from_state="Yellow", to_state="Red", event="timer_expire")
    ]
    db.add_all(traffic_transitions)

    db.commit()

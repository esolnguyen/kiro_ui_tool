"""Tests for the Advisor Strategy feature."""
import pytest
from fastapi.testclient import TestClient
from app import create_app


@pytest.fixture
def client():
    app = create_app()
    return TestClient(app)


# ── Agent advisor config persistence ──────────────────────────────────────

def test_create_agent_with_advisor(client):
    resp = client.post("/api/agents", json={
        "name": "Advisor Test Agent",
        "model": "sonnet",
        "body": "test",
        "advisor": {
            "enabled": True,
            "advisorModel": "opus",
            "advisorAgentSlug": "",
            "triggerHint": "Escalate for complex decisions",
        },
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["advisor"]["enabled"] is True
    assert data["advisor"]["advisorModel"] == "opus"
    assert data["advisor"]["triggerHint"] == "Escalate for complex decisions"

    # Read back
    resp2 = client.get(f"/api/agents/{data['slug']}")
    assert resp2.status_code == 200
    assert resp2.json()["advisor"]["enabled"] is True

    # Cleanup
    client.delete(f"/api/agents/{data['slug']}")


def test_create_agent_without_advisor(client):
    resp = client.post("/api/agents", json={
        "name": "No Advisor Agent",
        "model": "sonnet",
        "body": "test",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["advisor"]["enabled"] is False

    client.delete(f"/api/agents/{data['slug']}")


def test_update_agent_advisor_toggle(client):
    # Create without advisor
    resp = client.post("/api/agents", json={
        "name": "Toggle Test",
        "model": "sonnet",
        "body": "test",
    })
    slug = resp.json()["slug"]

    # Enable advisor
    resp2 = client.put(f"/api/agents/{slug}", json={
        "name": "Toggle Test",
        "model": "sonnet",
        "body": "test",
        "advisor": {"enabled": True, "advisorModel": "opus", "advisorAgentSlug": "", "triggerHint": ""},
    })
    assert resp2.status_code == 200
    assert resp2.json()["advisor"]["enabled"] is True

    # Disable advisor
    resp3 = client.put(f"/api/agents/{slug}", json={
        "name": "Toggle Test",
        "model": "sonnet",
        "body": "test",
        "advisor": {"enabled": False, "advisorModel": "opus", "advisorAgentSlug": "", "triggerHint": ""},
    })
    assert resp3.status_code == 200
    assert resp3.json()["advisor"]["enabled"] is False

    client.delete(f"/api/agents/{slug}")


# ── Advisor session endpoints ─────────────────────────────────────────────

def test_advisor_sessions_list_empty(client):
    resp = client.get("/api/advisor/sessions")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_advisor_session_create(client):
    resp = client.post("/api/advisor/sessions", json={
        "executorSessionId": "test-exec-123",
        "advisorModel": "opus",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "id" in data
    assert data["advisorModel"] == "opus"

    # Cleanup
    client.delete(f"/api/advisor/sessions/{data['id']}")


def test_advisor_session_history_empty(client):
    resp = client.post("/api/advisor/sessions", json={
        "executorSessionId": "test-exec-456",
    })
    session_id = resp.json()["id"]

    resp2 = client.get(f"/api/advisor/sessions/{session_id}/history")
    assert resp2.status_code == 200
    assert resp2.json() == []

    client.delete(f"/api/advisor/sessions/{session_id}")


def test_advisor_session_not_found(client):
    resp = client.get("/api/advisor/sessions/nonexistent/history")
    assert resp.status_code == 404

//! OpenAI Responses API integration.
//!
//! The API key lives in the Windows Credential Manager (via the `keyring`
//! crate) and never reaches the frontend, preferences or SQLite. All HTTP
//! traffic happens here on the Rust side.

use serde::{Deserialize, Serialize};
use serde_json::json;

const KEYRING_SERVICE: &str = "com.cachewraith.desktoppet";
const KEYRING_ACCOUNT: &str = "openai-api-key";
const OPENAI_RESPONSES_URL: &str = "https://api.openai.com/v1/responses";
const REQUEST_TIMEOUT_SECS: u64 = 60;

#[derive(Debug, Clone, Serialize)]
pub struct AiError {
    pub kind: String,
    pub message: String,
}

impl AiError {
    fn new(kind: &str, message: impl Into<String>) -> Self {
        Self {
            kind: kind.to_string(),
            message: message.into(),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

fn keyring_entry() -> Result<keyring::Entry, AiError> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
        .map_err(|_| AiError::new("keystore", "Could not access the Windows credential store."))
}

fn load_api_key() -> Result<String, AiError> {
    match keyring_entry()?.get_password() {
        Ok(key) => Ok(key),
        Err(keyring::Error::NoEntry) => Err(AiError::new(
            "no_key",
            "No API key is configured. Add one in Settings → AI.",
        )),
        Err(_) => Err(AiError::new(
            "keystore",
            "Could not read the API key from the Windows credential store.",
        )),
    }
}

#[tauri::command]
pub fn ai_set_api_key(key: String) -> Result<(), AiError> {
    let trimmed = key.trim();
    if trimmed.is_empty() {
        return Err(AiError::new("invalid_input", "The API key is empty."));
    }
    keyring_entry()?
        .set_password(trimmed)
        .map_err(|_| AiError::new("keystore", "Could not save the API key securely."))
}

#[tauri::command]
pub fn ai_has_api_key() -> Result<bool, AiError> {
    match keyring_entry()?.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(_) => Err(AiError::new(
            "keystore",
            "Could not read the Windows credential store.",
        )),
    }
}

#[tauri::command]
pub fn ai_clear_api_key() -> Result<(), AiError> {
    match keyring_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err(AiError::new(
            "keystore",
            "Could not remove the API key from the credential store.",
        )),
    }
}

fn http_client() -> Result<reqwest::Client, AiError> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .build()
        .map_err(|_| AiError::new("network", "Could not create the HTTP client."))
}

/// Extract the assistant text from a Responses API reply.
fn extract_output_text(body: &serde_json::Value) -> Option<String> {
    let output = body.get("output")?.as_array()?;
    let mut text = String::new();
    for item in output {
        if item.get("type").and_then(|t| t.as_str()) != Some("message") {
            continue;
        }
        if let Some(contents) = item.get("content").and_then(|c| c.as_array()) {
            for part in contents {
                if part.get("type").and_then(|t| t.as_str()) == Some("output_text") {
                    if let Some(t) = part.get("text").and_then(|t| t.as_str()) {
                        text.push_str(t);
                    }
                }
            }
        }
    }
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

/// Map an OpenAI error response to a user-facing error without leaking the
/// API key (the key is never part of response bodies, but we still keep the
/// surfaced message short and typed).
fn map_api_error(status: reqwest::StatusCode, body: &str) -> AiError {
    let detail = serde_json::from_str::<serde_json::Value>(body)
        .ok()
        .and_then(|v| {
            v.get("error")
                .and_then(|e| e.get("message"))
                .and_then(|m| m.as_str())
                .map(|s| s.chars().take(200).collect::<String>())
        })
        .unwrap_or_default();

    match status.as_u16() {
        401 => AiError::new("invalid_key", "The API key was rejected by OpenAI."),
        429 => AiError::new(
            "rate_limit",
            "OpenAI rate limit reached. Please wait a moment and try again.",
        ),
        _ => AiError::new(
            "api",
            format!(
                "OpenAI returned an error (HTTP {}). {}",
                status.as_u16(),
                detail
            ),
        ),
    }
}

async fn send_responses_request(
    model: &str,
    instructions: &str,
    input: serde_json::Value,
    max_output_tokens: u32,
) -> Result<String, AiError> {
    let api_key = load_api_key()?;
    let client = http_client()?;

    let response = client
        .post(OPENAI_RESPONSES_URL)
        .bearer_auth(&api_key)
        .json(&json!({
            "model": model,
            "instructions": instructions,
            "input": input,
            "max_output_tokens": max_output_tokens,
        }))
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                AiError::new("network", "The request to OpenAI timed out.")
            } else {
                AiError::new("network", "Could not reach OpenAI. Check your connection.")
            }
        })?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|_| AiError::new("network", "Failed to read the OpenAI response."))?;

    if !status.is_success() {
        return Err(map_api_error(status, &body));
    }

    let parsed: serde_json::Value = serde_json::from_str(&body)
        .map_err(|_| AiError::new("api", "OpenAI returned an unreadable response."))?;
    extract_output_text(&parsed)
        .ok_or_else(|| AiError::new("api", "OpenAI returned an empty response."))
}

#[tauri::command]
pub async fn ai_chat(
    model: String,
    personality: String,
    messages: Vec<ChatMessage>,
) -> Result<String, AiError> {
    if messages.is_empty() {
        return Err(AiError::new(
            "invalid_input",
            "There is no message to send.",
        ));
    }
    let input: Vec<serde_json::Value> = messages
        .iter()
        .filter(|m| m.role == "user" || m.role == "assistant")
        .map(|m| json!({ "role": m.role, "content": m.content }))
        .collect();
    send_responses_request(&model, &personality, json!(input), 600).await
}

#[tauri::command]
pub async fn ai_test_connection(model: String) -> Result<String, AiError> {
    send_responses_request(
        &model,
        "You are a connection test. Reply with a single short friendly word.",
        json!([{ "role": "user", "content": "ping" }]),
        16,
    )
    .await
}

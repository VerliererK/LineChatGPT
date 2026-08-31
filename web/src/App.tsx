import { useState, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import "./App.css";

function AuthGate({ onAuth }: { onAuth: (key: string) => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) {
      setError("金鑰不可為空。");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/settings", {
        headers: { Authorization: `Bearer ${trimmed}` },
      });
      if (res.ok) {
        sessionStorage.setItem("authKey", trimmed);
        onAuth(trimmed);
      } else {
        setError(res.status === 401 ? "授權金鑰不正確。" : "伺服器錯誤。");
      }
    } catch {
      setError("無法連線至伺服器。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>請輸入授權金鑰</h2>
        <input
          type="password"
          placeholder="Authorization Key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoFocus
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "驗證中..." : "進入"}
        </button>
      </form>
    </div>
  );
}

function compressImage(file: File, maxSize = 1024, quality = 0.85): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) return resolve(file);
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          resolve(new File([blob!], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality,
      );
    };
    img.src = URL.createObjectURL(file);
  });
}

interface Settings {
  provider: string;
  model: string;
  api_key: string;
  base_url: string;
  system_role: string;
  temperature: string;
  top_p: string;
  max_tokens: string;
  timeout: string;
  stop_when: string;
  reasoning_effort: string;
}

const defaultSettings: Settings = {
  provider: "vercel",
  model: "openai/gpt-5",
  api_key: "",
  base_url: "",
  system_role: "",
  temperature: "",
  top_p: "",
  max_tokens: "4096",
  timeout: "290",
  stop_when: "10",
  reasoning_effort: "",
};

function ModelCombobox({
  value,
  onChange,
  models,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  models: string[];
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsTyping(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayModels = isTyping && filter.trim()
    ? models.filter((m) => m.toLowerCase().includes(filter.trim().toLowerCase()))
    : models;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setIsTyping(true);
    setFilter(val);
    onChange(val);
    if (!isOpen) setIsOpen(true);
  };

  const handleSelect = (model: string) => {
    onChange(model);
    setFilter("");
    setIsTyping(false);
    setIsOpen(false);
  };

  const handleInputFocus = () => {
    setIsTyping(false);
    setFilter("");
    setIsOpen(true);
  };

  const toggleDropdown = () => {
    if (isOpen) {
      setIsOpen(false);
      setIsTyping(false);
    } else {
      setIsTyping(false);
      setFilter("");
      setIsOpen(true);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="combobox-container" ref={containerRef}>
      <div className="combobox-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className="combobox-input"
        />
        {value && (
          <button
            type="button"
            className="combobox-clear-btn"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              setFilter("");
              setIsTyping(false);
              setIsOpen(true);
              inputRef.current?.focus();
            }}
            title="清除輸入"
          >
            &times;
          </button>
        )}
        <button
          type="button"
          className={`combobox-toggle-btn ${isOpen ? "open" : ""}`}
          onClick={toggleDropdown}
          title="選擇或切換模型"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="combobox-dropdown">
          <div className="combobox-header">
            <span>可用模型 ({displayModels.length})</span>
          </div>
          {models.length === 0 ? (
            <div className="combobox-empty">
              <span>尚未取得模型清單，請點擊「取得模型」或手動輸入</span>
            </div>
          ) : displayModels.length > 0 ? (
            <div className="combobox-list">
              {displayModels.map((m) => {
                const isSelected = m === value;
                return (
                  <div
                    key={m}
                    className={`combobox-item ${isSelected ? "selected" : ""}`}
                    onClick={() => handleSelect(m)}
                  >
                    <span className="combobox-item-text">{m}</span>
                    {isSelected && (
                      <svg className="combobox-check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="combobox-empty">
              <span>無匹配項目，將使用自訂模型：<strong>{value}</strong></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SettingsPanel({ authKey, onClose }: { authKey: string; onClose: () => void }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [availableModels, setAvailableModels] = useState<Record<string, string[]>>({});
  const [fetchingModels, setFetchingModels] = useState(false);
  const [modelStatus, setModelStatus] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings", {
      headers: { Authorization: `Bearer ${authKey}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setSettings({
          ...defaultSettings,
          ...Object.fromEntries(
            Object.entries(data).filter(([, v]) => v != null && v !== "")
          ),
        });
      })
      .catch(() => setMessage({ type: "error", text: "載入設定失敗。" }))
      .finally(() => setLoading(false));
  }, [authKey]);

  useEffect(() => {
    if (message?.type === "success") {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    if (modelStatus) {
      const timer = setTimeout(() => setModelStatus(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [modelStatus]);

  const update = (field: keyof Settings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleProviderChange = (newProvider: string) => {
    update("provider", newProvider);
    setModelStatus(null);
  };

  const fetchModels = async () => {
    setFetchingModels(true);
    setModelStatus(null);
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: settings.provider,
          api_key: settings.api_key,
          base_url: settings.base_url,
        }),
      });

      const data = await res.json();
      if (res.ok && Array.isArray(data.models)) {
        setAvailableModels((prev) => ({
          ...prev,
          [settings.provider]: data.models,
        }));
        if (data.models.length > 0) {
          setModelStatus({
            type: "success",
            text: `成功取得 ${data.models.length} 個模型`,
          });
        } else {
          setModelStatus({
            type: "info",
            text: data.message || "未取得任何模型",
          });
        }
      } else {
        setModelStatus({
          type: "error",
          text: data.error || "取得模型失敗",
        });
      }
    } catch {
      setModelStatus({ type: "error", text: "無法連線至模型查詢服務" });
    } finally {
      setFetchingModels(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "設定已儲存。" });
      } else {
        const text = await res.text();
        setMessage({ type: "error", text: text || "儲存失敗。" });
      }
    } catch {
      setMessage({ type: "error", text: "無法連線至伺服器。" });
    } finally {
      setSaving(false);
    }
  };

  const canSave = settings.provider.trim() !== "" && settings.model.trim() !== "";
  const currentModelList = availableModels[settings.provider] || [];

  return (
    <div className="modal-overlay">
      <div className="settings-panel">
        <div className="settings-header">
          <h2>模型設定</h2>
          <button className="settings-close-btn" onClick={onClose}>&times;</button>
        </div>
        {loading ? (
          <div className="settings-body"><p>載入中...</p></div>
        ) : (
          <div className="settings-body">
            <div className="settings-group">
              <div className="settings-field">
                <label className="required">Provider</label>
                <select value={settings.provider} onChange={(e) => handleProviderChange(e.target.value)}>
                  <option value="vercel">Vercel</option>
                  <option value="google">Google</option>
                  <option value="openai">OpenAI</option>
                </select>
              </div>

              <div className="settings-field">
                <label>API Key</label>
                <input type="password" value={settings.api_key} onChange={(e) => update("api_key", e.target.value)} placeholder="Enter your API key" />
              </div>

              <div className="settings-field">
                <label>Base URL (Optional)</label>
                <input value={settings.base_url} onChange={(e) => update("base_url", e.target.value)} placeholder="e.g., https://api.example.com/v1" />
              </div>

              <div className="settings-field">
                <div className="settings-field-header">
                  <label className="required">Model</label>
                  <button
                    type="button"
                    className="fetch-models-btn"
                    onClick={fetchModels}
                    disabled={fetchingModels}
                    title="從 Provider 取得最新可用模型"
                  >
                    <svg
                      className={fetchingModels ? "spin" : ""}
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                    </svg>
                    <span>{fetchingModels ? "取得中..." : "取得模型"}</span>
                  </button>
                </div>
                <ModelCombobox
                  value={settings.model}
                  onChange={(val) => update("model", val)}
                  models={currentModelList}
                  placeholder={
                    settings.provider === "vercel"
                      ? "e.g., openai/gpt-5"
                      : settings.provider === "google"
                        ? "e.g., gemini-2.5-pro"
                        : "e.g., gpt-5"
                  }
                />
                {modelStatus && (
                  <p className={`model-status-text ${modelStatus.type}`}>
                    {modelStatus.text}
                  </p>
                )}
              </div>
            </div>

            <div className="settings-group">
              <div className="settings-field">
                <label>System Role</label>
                <textarea rows={4} value={settings.system_role} onChange={(e) => update("system_role", e.target.value)} placeholder="Define the assistant's behavior..." />
              </div>
            </div>

            <div className="settings-group">
              <div className="settings-field-grid">
                <div className="settings-field">
                  <label>思考深度</label>
                  <select value={settings.reasoning_effort} onChange={(e) => update("reasoning_effort", e.target.value)}>
                    <option value="">預設</option>
                    <option value="none">none</option>
                    <option value="minimal">minimal</option>
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                    <option value="xhigh">xhigh</option>
                    <option value="max">max</option>
                  </select>
                </div>
                <div className="settings-field">
                  <label>Max Tokens</label>
                  <input type="number" min="1" value={settings.max_tokens} onChange={(e) => update("max_tokens", e.target.value)} placeholder="4096" />
                </div>
                <div className="settings-field">
                  <label>Temperature</label>
                  <input type="number" step="0.1" min="0" max="2" value={settings.temperature} onChange={(e) => update("temperature", e.target.value)} placeholder="e.g., 0.7" />
                </div>
                <div className="settings-field">
                  <label>Top P</label>
                  <input type="number" step="0.05" min="0" max="1" value={settings.top_p} onChange={(e) => update("top_p", e.target.value)} placeholder="e.g., 0.9" />
                </div>
                <div className="settings-field">
                  <label>Timeout (seconds)</label>
                  <input type="number" min="1" value={settings.timeout} onChange={(e) => update("timeout", e.target.value)} placeholder="290" />
                </div>
                <div className="settings-field">
                  <label>StopWhen</label>
                  <input type="number" min="1" max="20" value={settings.stop_when} onChange={(e) => update("stop_when", e.target.value)} placeholder="10" />
                </div>
              </div>
            </div>
          </div>
        )}
        {!loading && (
          <div className="settings-footer">
            {message && (
              <p className={`settings-message ${message.type}`}>{message.text}</p>
            )}
            <div className="settings-actions">
              <button type="button" className="settings-cancel-btn" onClick={onClose}>取消</button>
              <button className="settings-save-btn" onClick={save} disabled={!canSave || saving}>
                {saving ? "儲存中..." : "儲存"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const isTouchDevice =
  typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

function Chat({ authKey }: { authKey: string }) {
  const transportRef = useRef(
    new DefaultChatTransport({
      api: "/api/chat",
      headers: { Authorization: `Bearer ${authKey}` },
    })
  );

  const { messages, sendMessage, status, error, regenerate } = useChat({
    transport: transportRef.current,
  });

  const [input, setInput] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isLoading = status === "streaming" || status === "submitted";
  const lastMessage = messages.at(-1);
  const hasVisibleReply =
    lastMessage?.role === "assistant" &&
    lastMessage.parts.some(
      (p) => (p.type === "text" && p.text) || p.type === "file"
    );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }
  }, [input]);

  const send = async (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if ((!text && !files) || isLoading) return;
    setInput("");
    setFiles(null);
    let compressed: FileList | undefined;
    if (files) {
      const dt = new DataTransfer();
      const results = await Promise.all(Array.from(files).map((f) => compressImage(f)));
      results.forEach((f) => dt.items.add(f));
      compressed = dt.files;
    }
    sendMessage({ text, files: compressed });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (isTouchDevice) return;
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <span>LINE Agent</span>
        <button className="settings-btn" onClick={() => setShowSettings(true)} title="設定">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </header>

      {showSettings && <SettingsPanel authKey={authKey} onClose={() => setShowSettings(false)} />}

      <div className="message-area">
        {messages.map((m) => {
          const parts = m.parts.filter(
            (p) => (p.type === "text" && p.text) || p.type === "file"
          );
          if (parts.length === 0) return null;
          return (
            <div key={m.id} className={`bubble ${m.role}`}>
              {parts.map((p, i) =>
                p.type === "file" ? (
                  <img key={i} src={p.url} alt="uploaded" />
                ) : (
                  <span key={i}>{p.type === "text" ? p.text : null}</span>
                )
              )}
            </div>
          );
        })}

        {isLoading && !hasVisibleReply && (
          <div className="bubble assistant">
            <div className="typing-dots">
              <span /><span /><span />
            </div>
          </div>
        )}

        {error && (
          <div className="chat-error">
            <span>發生錯誤:{error.message || "請求失敗"}</span>
            <button type="button" onClick={() => regenerate()}>重試</button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form className="input-area" onSubmit={send}>
        {files && files.length > 0 && (
          <div className="image-preview">
            {Array.from(files).map((f, i) => (
              <div key={i} className="image-preview-item">
                <img src={URL.createObjectURL(f)} alt="preview" />
                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => {
                    const dt = new DataTransfer();
                    Array.from(files).forEach((file, idx) => {
                      if (idx !== i) dt.items.add(file);
                    });
                    setFiles(dt.files.length > 0 ? dt.files : null);
                  }}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              const dt = new DataTransfer();
              Array.from(e.target.files).forEach((f) => dt.items.add(f));
              setFiles(dt.files);
            }
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="attach-btn"
          onClick={() => fileInputRef.current?.click()}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
              stroke="#666"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="輸入訊息..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="submit" className="send-btn" disabled={isLoading || (!input.trim() && !files)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
    </div>
  );
}

export default function App() {
  const [authKey, setAuthKey] = useState<string | null>(() =>
    sessionStorage.getItem("authKey")
  );
  const [checked, setChecked] = useState(!authKey);

  useEffect(() => {
    if (!authKey) return;
    fetch("/api/settings", {
      headers: { Authorization: `Bearer ${authKey}` },
    }).then((res) => {
      if (!res.ok) {
        sessionStorage.removeItem("authKey");
        setAuthKey(null);
      }
      setChecked(true);
    }).catch(() => {
      setChecked(true);
    });
  }, []);

  if (!checked) return null;
  if (!authKey) return <AuthGate onAuth={setAuthKey} />;
  return <Chat authKey={authKey} />;
}

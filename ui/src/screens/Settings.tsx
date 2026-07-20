import { useState } from "react";
import { Icon } from "../app/icons";
import { useToast } from "../app/toast";
import { getConfig, search, setConfig } from "../crm/ai";
import { useCrm } from "../crm/CrmContext";

export function Settings() {
  const crm = useCrm();
  const { showToast } = useToast();
  const initial = getConfig();
  const [endpoint, setEndpoint] = useState(initial.endpoint);
  const [model, setModel] = useState(initial.model);
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [showKey, setShowKey] = useState(false);

  const configured = !!apiKey.trim();

  function save() {
    setConfig({ endpoint: endpoint.trim(), model: model.trim(), apiKey: apiKey.trim() });
    showToast("Settings saved", "green");
  }

  async function test() {
    if (!apiKey.trim()) return showToast("Enter an API key first", "amber");
    save();
    showToast("Testing connection…", "blue");
    try {
      await search("Reply with the single word: OK", {
        customers: crm.customers,
        contacts: crm.contacts,
        interactions: crm.interactions,
        engineerName: crm.engineerName,
        appStatusLabel: (k) => crm.appStatusMeta(k).label,
        hierarchy: (c) => {
          const h = crm.hierarchy(c);
          return { subdivision: h.subdivision, studio: h.studio };
        },
      });
      showToast("Connection successful", "green");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Connection failed", "red");
    }
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <div className="eyebrow">Admin</div>
          <h1 className="page-title">Settings</h1>
          <div className="page-sub">Configure the AI Search provider for this workspace.</div>
        </div>
        <span className={`kv-pill ${configured ? "ok" : "warn"}`}>
          <span className="dot" />
          {configured ? "Configured" : "Not configured"}
        </span>
      </div>

      <div className="card card-pad" style={{ maxWidth: 680 }}>
        <div className="card-h">
          <span className="ic">
            <Icon name="ai" />
          </span>
          AI Provider
        </div>
        <p className="muted-para">
          AI Search calls an OpenAI-compatible chat completions API directly from your browser. Works
          with OpenAI, Azure OpenAI, or any internal OpenAI-compatible gateway.
        </p>

        <div className="field">
          <label>API Endpoint</label>
          <input
            className="input"
            placeholder="https://api.openai.com/v1/chat/completions"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
          />
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label>Model</label>
          <input
            className="input"
            placeholder="gpt-4o-mini"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label>API Key</label>
          <div className="input-group">
            <span className="adorn">
              <Icon name="key" />
            </span>
            <input
              type={showKey ? "text" : "password"}
              autoComplete="off"
              placeholder="sk-…"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <button
              className="pw-toggle"
              type="button"
              title="Show / hide"
              onClick={() => setShowKey((s) => !s)}
            >
              <Icon name={showKey ? "eyeoff" : "eye"} />
            </button>
          </div>
        </div>

        <div className="note-strip">
          <Icon name="shield" />
          <div className="t">
            <b>Your key never leaves this browser.</b> It's stored only in this browser's
            localStorage and sent only to the endpoint above — never to any other server.
          </div>
        </div>

        <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
          <button className="btn btn-secondary" onClick={test}>
            Test Connection
          </button>
          <button className="btn btn-primary" onClick={save}>
            <Icon name="check" />
            Save Settings
          </button>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import "./styles.css";
import { Activity, ArrowDown, ArrowUpRight, Bot, Check, ChevronDown, CloudSun, Command, Droplets, Leaf, LoaderCircle, Menu, MessageSquare, Moon, Plus, Send, ShieldCheck, Sparkles, Sun, Trash2, Waves, X } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };
type ActivityItem = { agent: string; tool: string; status: string; result?: { available: boolean; source: string; observedAt: string; note?: string } };
type Health = { status: string; checks: Record<string, boolean>; checkedAt: string };
type Conversation = { id: string; title: string; updatedAt: string };

const suggestions = [
  { icon: CloudSun, title: "Check drought risk", prompt: "Check drought risk in Dhule" },
  { icon: Leaf, title: "Plan a crop", prompt: "Which crop should I grow this season in Dhule?" },
  { icon: Waves, title: "Review water use", prompt: "How can I reduce water and electricity consumption in Dhule?" },
];

export default function AIAgentPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState("");
  const [locale, setLocale] = useState("en");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadConversations = useCallback(async () => {
    try { const response = await fetch("/api/conversations"); const data = await response.json(); setConversations(data.conversations ?? []); } catch { /* history is optional until storage is configured */ }
  }, []);

  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => setHealth({ status: "offline", checks: {}, checkedAt: "" }));
    fetch("/api/auth").then((r) => r.json()).then((data) => { setAuthenticated(data.authenticated); setSetupRequired(data.setupRequired); }).catch(() => setAuthenticated(false));
    void loadConversations();
    const timer = window.setInterval(() => fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => undefined), 45000);
    return () => window.clearInterval(timer);
  }, [loadConversations]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, activities, busy]);

  async function sendMessage(value = input) {
    const text = value.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next); setInput(""); setError(""); setBusy(true); setActivities([]);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId, message: text, language: locale }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The request could not be completed.");
      setConversationId(data.conversationId); setMessages([...next, { role: "assistant", content: data.message }]); setActivities(data.activities ?? []); void loadConversations();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not connect to ResilioAI Core."); }
    finally { setBusy(false); }
  }

  function newChat() { setMessages([]); setActivities([]); setConversationId(undefined); setError(""); setShowHistory(false); inputRef.current?.focus(); }
  async function removeConversation(id: string) {
    const response = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (!response.ok) { const data = await response.json(); setError(data.error ?? "Could not delete conversation."); return; }
    setConversations((items) => items.filter((item) => item.id !== id));
    if (conversationId === id) newChat();
  }
  async function clearHistory() {
    if (!window.confirm("Delete all saved conversations? This cannot be undone.")) return;
    const response = await fetch("/api/conversations", { method: "DELETE" });
    if (!response.ok) { const data = await response.json(); setError(data.error ?? "Could not clear conversation history."); return; }
    setConversations([]); newChat();
  }
  async function openConversation(id: string) {
    setConversationId(id); setShowHistory(true);
    try { const response = await fetch(`/api/conversations/${id}`); const data = await response.json(); if (!response.ok) throw new Error(data.error); setMessages(data.conversation.messages); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load conversation."); }
  }
  async function signIn(event: React.FormEvent) {
    event.preventDefault(); setSigningIn(true); setAuthError("");
    try { const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setAuthenticated(true); setPassword(""); void loadConversations(); }
    catch (cause) { setAuthError(cause instanceof Error ? cause.message : "Sign in failed."); }
    finally { setSigningIn(false); }
  }

  const statusLabel = health?.status === "online" ? "All systems operational" : health?.status === "degraded" ? "Partially connected" : "Offline";

  if (authenticated === false && !setupRequired) return <main className="core-dashboard auth-screen"><form className="auth-card" onSubmit={signIn}><div className="brand-mark"><Command size={18} /></div><span className="rail-kicker">RESILIOAI CORE</span><h1>Welcome back</h1><p>Sign in to access your private workspace and conversations.</p><label htmlFor="password">Workspace password</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /><button disabled={signingIn}>{signingIn ? "Signing in…" : "Sign in securely"}</button>{authError && <div className="auth-error">{authError}</div>}<small>Workspace owner access · Secure session</small></form></main>;

  return <main className={`app-shell core-dashboard ${theme}`}>
    <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark"><Command size={18} strokeWidth={2.2} /></div><div><strong>resilio<span>ai</span></strong><small>CORE INTELLIGENCE</small></div><button className="icon-button mobile-close" aria-label="Close menu" onClick={() => setMobileMenu(false)}><X size={17} /></button></div>
      <div className="workspace-switch"><div className="workspace-avatar">R</div><div><span>Resilio workspace</span><small>Personal workspace</small></div><ChevronDown size={14} /></div>
      <button className="new-chat" onClick={newChat}><Plus size={16} /> New conversation <span>⌘ K</span></button>
      <div className="nav-label">WORKSPACE</div>
      <nav className="nav-list"><a className="nav-item active" href="/ai-agent"><Sparkles size={16} /> AI Agent <span className="nav-live" /></a><a className="nav-item muted" href="#agriculture"><Leaf size={16} /> Agriculture <span className="coming">MODULE</span></a><a className="nav-item muted" href="#climate"><CloudSun size={16} /> Climate intelligence</a><a className="nav-item muted" href="#resources"><Droplets size={16} /> Smart resources</a></nav>
      <div className="history-head"><span className="nav-label">RECENT CONVERSATIONS</span><div className="history-actions"><button className="icon-button" aria-label="Clear conversation history" title="Clear conversation history" onClick={() => void clearHistory()}><Trash2 size={13} /></button><button className="icon-button" aria-label="Refresh conversations" onClick={() => void loadConversations()}><Activity size={14} /></button></div></div>
      <div className="history-list">{conversations.length ? conversations.slice(0, 6).map((item) => <div className={`history-item ${conversationId === item.id ? "selected" : ""}`} key={item.id}><button onClick={() => void openConversation(item.id)} title={item.title}><MessageSquare size={14} /><span>{item.title}</span></button><button className="history-delete" aria-label={`Delete ${item.title}`} onClick={() => void removeConversation(item.id)}><Trash2 size={13} /></button></div>) : <p className="history-empty">Your conversations will appear here.</p>}</div>
      <div className="sidebar-bottom"><div className="privacy-note"><ShieldCheck size={15} /><span>Your data stays private<br /><small>Encrypted and access controlled</small></span></div><div className="profile"><div className="profile-avatar">S</div><div><strong>Workspace owner</strong><small>Free plan</small></div><ChevronDown size={15} /></div></div>
    </aside>

    <section className="main-area">
      <header className="topbar"><button className="icon-button mobile-menu-button" aria-label="Open menu" onClick={() => setMobileMenu(true)}><Menu size={19} /></button><div className="breadcrumb">Workspace <span>/</span> <strong>AI Agent</strong></div><div className="top-actions"><button className="status-pill" title={statusLabel}><i className={`status-dot ${health?.status ?? "loading"}`} />{statusLabel}</button><span className="top-divider" /><select className="locale-select" value={locale} onChange={(event) => setLocale(event.target.value)} aria-label="Response language"><option value="en">EN</option><option value="hi">हि</option><option value="mr">मर</option></select><button className="icon-button theme-toggle" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}>{theme === "light" ? <Moon size={15} /> : <Sun size={15} />}</button><div className="top-avatar">S</div></div></header>

      {authenticated === false && setupRequired && <div className="setup-banner"><ShieldCheck size={15} /><span>Production sign-in is not configured. Set <code>RESILIO_ADMIN_PASSWORD</code> and <code>RESILIO_SESSION_SECRET</code> to enable private AI access.</span></div>}

      <div className="dashboard-scroll"><div className="dashboard-content">
        <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR INTELLIGENCE, CONNECTED</div><h1>Good morning, <span>there.</span></h1><p>One place to make clearer decisions across your farm and resources.</p></div><button className="date-chip"><span className="date-dot" /> Core is {health?.status ?? "checking"}<ArrowUpRight size={14} /></button></section>

        <section className="metric-grid"><div className="metric-card"><div className="metric-top"><span>CORE STATUS</span><div className="metric-icon lilac"><Sparkles size={16} /></div></div><div className="metric-value">{health?.status === "online" ? "Ready" : health?.status === "degraded" ? "Degraded" : health?.status === "offline" ? "Offline" : "Checking"}</div><div className="metric-foot"><i className={`status-dot ${health?.status ?? "loading"}`} /> {statusLabel}</div></div><div className="metric-card"><div className="metric-top"><span>CONNECTED MODULES</span><div className="metric-icon mint"><Activity size={16} /></div></div><div className="metric-value">{Object.values(health?.checks ?? {}).filter(Boolean).length}<small> / {Object.keys(health?.checks ?? {}).length || 6}</small></div><div className="metric-foot">Live health checks</div></div><div className="metric-card"><div className="metric-top"><span>DATA SOURCES</span><div className="metric-icon blue"><CloudSun size={16} /></div></div><div className="metric-value">{health?.checks ? [health.checks.weather, health.checks.soil, health.checks.mandi].filter(Boolean).length : "—"}<small> active</small></div><div className="metric-foot">Weather · Soil · Market</div></div><div className="metric-card"><div className="metric-top"><span>YOUR ACTIVITY</span><div className="metric-icon amber"><MessageSquare size={16} /></div></div><div className="metric-value">{conversations.length}<small> chats</small></div><div className="metric-foot">Saved to your workspace</div></div></section>

        <section className="content-grid"><div className="chat-card"><div className="chat-header"><div className="chat-title"><div className="assistant-avatar"><Bot size={19} /></div><div><strong>ResilioAI Core</strong><span><i className={`status-dot ${health?.status ?? "loading"}`} /> {health?.status === "online" ? "Ready to help" : "Setup required for AI chat"}</span></div></div><button className="icon-button" aria-label="New chat" onClick={newChat}><Plus size={17} /></button></div>
          <div className="chat-body">{messages.length === 0 ? <div className="chat-empty"><div className="empty-orbit"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-core"><Sparkles size={25} /></div><span className="orbit-point point-one" /><span className="orbit-point point-two" /><span className="orbit-point point-three" /></div><div className="chat-greeting"><h2>What would you like to<br />understand today?</h2><p>Ask about crops, climate conditions, or resource use.<br />I’ll bring relevant data together for you.</p></div><div className="suggestion-list">{suggestions.map(({ icon: Icon, title, prompt }) => <button className="suggestion" key={title} onClick={() => void sendMessage(prompt)}><span className="suggestion-icon"><Icon size={16} /></span><span>{title}</span><ArrowUpRight size={14} /></button>)}</div></div> : <div className="message-list">{messages.map((message, index) => <div className={`message-row ${message.role}`} key={`${index}-${message.role}`}><div className="message-avatar">{message.role === "assistant" ? <Sparkles size={14} /> : "S"}</div><div className="message-content"><span className="message-author">{message.role === "assistant" ? "ResilioAI Core" : "You"}</span><div className="markdown"><ReactMarkdown>{message.content}</ReactMarkdown></div></div></div>)}{busy && <div className="thinking"><LoaderCircle size={15} className="spin" /><span>ResilioAI is thinking and checking relevant sources…</span></div>}{activities.map((activity, i) => <div className="activity-line" key={`${activity.tool}-${i}`}><span className={`activity-check ${activity.status}`}><Check size={11} /></span><span>{activity.agent}</span><code>{activity.tool}</code><span className="activity-result" title={`${activity.result?.source ?? ""} · ${activity.result?.observedAt ?? ""}`}>{activity.status}{activity.result?.source ? ` · ${activity.result.source}` : ""}</span></div>)}<div ref={endRef} /></div>}</div>
          {error && <div className="error-banner"><span>{error}</span><button onClick={() => void sendMessage(messages.filter((m) => m.role === "user").at(-1)?.content ?? "")} disabled={busy}>Retry <ArrowDown size={13} /></button><button className="icon-button" aria-label="Dismiss error" onClick={() => setError("")}><X size={14} /></button></div>}
          <div className="composer-wrap"><div className="composer"><textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Ask anything about your farm or resources…" rows={2} maxLength={2000} aria-label="Message ResilioAI Core" /><div className="composer-actions"><span><kbd>↵</kbd> to send <span className="composer-hint">· Shift + Enter for a new line</span></span><button className="send-button" onClick={() => void sendMessage()} disabled={!input.trim() || busy} aria-label="Send message">{busy ? <LoaderCircle size={16} className="spin" /> : <Send size={15} />}</button></div></div><div className="composer-caption">AI can make mistakes. Verify important decisions with local experts.</div></div></div>

        <aside className="right-rail"><section className="rail-card agents-card"><div className="rail-heading"><div><span className="rail-kicker">YOUR AI TEAM</span><h3>Specialized agents</h3></div><button className="icon-button" aria-label="View agent details"><ArrowUpRight size={15} /></button></div><AgentRow icon={<Leaf size={16} />} tone="green" name="Agriculture" subtitle="Soil, crops & markets" status="Available" /><AgentRow icon={<CloudSun size={16} />} tone="blue" name="Climate intelligence" subtitle="Weather & risk analysis" status="Available" /><AgentRow icon={<Droplets size={16} />} tone="cyan" name="Smart resources" subtitle="Water, solar & demand" status="Needs data" /></section>
          <section className="rail-card sources-card"><div className="rail-heading"><div><span className="rail-kicker">LIVE CONNECTIONS</span><h3>Data sources</h3></div><span className="source-count">{[health?.checks.weather, health?.checks.soil, health?.checks.mandi].filter(Boolean).length}/3</span></div><SourceRow name="Open-Meteo weather" state={health?.checks.weather ? "Connected" : "Offline"} /><SourceRow name="ISRIC SoilGrids" state={health?.checks.soil ? "Connected" : "Offline"} /><SourceRow name="Agmarknet prices" state={health?.checks.mandi ? "Connected" : "Credentials needed"} /><div className="source-note"><ShieldCheck size={14} /><span>Every answer includes its data source and freshness.</span></div></section>
          <section className="rail-card activity-card"><div className="rail-heading"><div><span className="rail-kicker">RECENT ANALYSIS</span><h3>From your workspace</h3></div><button className="text-link" onClick={() => setShowHistory(!showHistory)}>View all <ArrowUpRight size={12} /></button></div>{conversations.length ? conversations.slice(0, 3).map((item) => <button key={item.id} className="analysis-row" onClick={() => void openConversation(item.id)}><span className="analysis-icon"><MessageSquare size={14} /></span><span className="analysis-copy"><strong>{item.title}</strong><small>{new Date(item.updatedAt).toLocaleDateString()}</small></span><ArrowUpRight size={13} /></button>) : <div className="no-analysis"><div className="no-analysis-icon"><Sun size={18} /></div><strong>Your insights start here</strong><span>Run an analysis to see it in your history.</span></div>}</section>
          <div className="rail-footer"><span>RESILIOAI CORE · PREVIEW</span><span>Build 0.1.0</span></div>
        </aside></section>
        <footer className="page-footer"><span>© 2026 ResilioAI</span><span><i className={`status-dot ${health?.status ?? "loading"}`} /> {statusLabel}</span><a href="mailto:support@resilioai.com">Help & feedback <ArrowUpRight size={11} /></a></footer>
      </div></div>
    </section>
  </main>;
}

function AgentRow({ icon, tone, name, subtitle, status }: { icon: React.ReactNode; tone: string; name: string; subtitle: string; status: string }) {
  return <div className="agent-row"><div className={`agent-icon ${tone}`}>{icon}</div><div className="agent-copy"><strong>{name}</strong><small>{subtitle}</small></div><span className={`agent-status ${status === "Available" ? "ok" : "pending"}`}><i />{status}</span></div>;
}
function SourceRow({ name, state }: { name: string; state: string }) {
  return <div className="source-row"><span className={`source-indicator ${state === "Connected" ? "connected" : ""}`} /><span>{name}</span><small>{state}</small></div>;
}

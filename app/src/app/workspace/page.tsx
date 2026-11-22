"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, BarChart3, Bell, ChevronDown, CloudSun, Droplets, Leaf, Menu, MessageCircle, PanelLeft, Search, Send, Settings, Sprout, Sun, Trash2, TrafficCone, Zap } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string; time?: string };

const suggestions = [
  { icon: Leaf, text: "Which crop should I grow this season in Dhule?" },
  { icon: CloudSun, text: "Check drought risk in my area" },
  { icon: Droplets, text: "How can I reduce water and electricity consumption?" },
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello! I’m ResilioAI Core. I can analyze agriculture, climate, and smart resource data for you. What would you like to explore?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [location, setLocation] = useState("Dhule");
  const [route, setRoute] = useState<string[]>(["Agriculture", "Climate Intelligence", "Smart Resource"]);
  const [activeNav, setActiveNav] = useState("AI Agent");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => {
    fetch("/api/auth").then((response) => response.json()).then((session) => {
      if (!session.authenticated) window.location.replace("/ai-agent");
    }).catch(() => window.location.replace("/ai-agent"));
  }, []);

  async function send(text = input) {
    const clean = text.trim();
    if (!clean || loading) return;
    setInput("");
    setMessages((old) => [...old, { role: "user", content: clean, time: "Now" }]);
    setLoading(true);
    try {
      const response = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: clean, conversationId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setConversationId(data.conversationId);
      setLocation(data.location ?? location);
      setRoute(data.route ?? []);
      setMessages((old) => [...old, { role: "assistant", content: data.answer, time: "Now" }]);
    } catch (error) {
      setMessages((old) => [...old, { role: "assistant", content: "I couldn’t complete that analysis because the secure agent service is unavailable. Please try again.", time: "Now" }]);
    } finally { setLoading(false); }
  }

  async function clearHistory() {
    await fetch(conversationId ? `/api/agent?conversationId=${encodeURIComponent(conversationId)}` : "/api/agent", { method: "DELETE" });
    setConversationId(undefined);
    setMessages([{ role: "assistant", content: "Conversation history cleared. How can I help you?" }]);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Sprout size={20} /></div><div><strong>Resilio</strong><span>Platform</span></div></div>
        <nav>
          {[{name:"Overview",icon:BarChart3},{name:"AI Agent",icon:MessageCircle},{name:"Agriculture",icon:Leaf},{name:"Climate",icon:CloudSun},{name:"Resources",icon:Zap}].map((item) => {
            const Icon = item.icon;
            return <button key={item.name} className={activeNav === item.name ? "nav-item active" : "nav-item"} onClick={() => setActiveNav(item.name)}><Icon size={18}/><span>{item.name}</span>{item.name === "AI Agent" && <b>Core</b>}</button>
          })}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item"><Settings size={18}/><span>Settings</span></button>
          <div className="profile"><div className="avatar">RP</div><div><strong>Rohan Patil</strong><span>Dhule, Maharashtra</span></div><ChevronDown size={16}/></div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><h1>ResilioAI Core</h1><div className="status"><i/> Agent online</div></div>
          <div className="top-actions">
            <button className="location"><span>⌖</span>{location}<ChevronDown size={14}/></button>
            <button className="icon-button"><Search size={18}/></button>
            <button className="icon-button notification"><Bell size={18}/><i/></button>
          </div>
        </header>

        <div className="content-grid">
          <section className="chat-panel">
            <div className="chat-heading"><div><div className="core-icon"><Sprout size={19}/></div><div><h2>Ask ResilioAI</h2><p>Central intelligence · Multi-agent</p></div></div><button title="Clear history" onClick={clearHistory}><Trash2 size={17}/></button></div>

            <div className="messages">
              {messages.map((message, index) => (
                <div key={index} className={`message-row ${message.role}`}>
                  {message.role === "assistant" && <div className="mini-core"><Sprout size={15}/></div>}
                  <div className="bubble">{message.content}</div>
                </div>
              ))}
              {loading && <div className="message-row assistant"><div className="mini-core"><Sprout size={15}/></div><div className="typing"><i/><i/><i/></div></div>}
              <div ref={bottomRef}/>
            </div>

            {messages.length === 1 && <div className="suggestions">{suggestions.map((item) => { const Icon=item.icon; return <button key={item.text} onClick={() => send(item.text)}><Icon size={16}/><span>{item.text}</span></button>})}</div>}

            <div className="composer">
              <input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if(event.key === "Enter") send(); }} placeholder="Ask about crops, climate, water or electricity..." />
              <button className="send" onClick={() => send()} disabled={!input.trim() || loading}><Send size={18}/></button>
            </div>
            <div className="privacy">ResilioAI may make mistakes. Verify critical recommendations.</div>
          </section>

          <aside className="insights">
            <section className="card agent-status">
              <div className="card-title"><h3>Agent groups</h3><span>Routed on request</span></div>
              <div className="agent-list">
                <div><div className="agent-icon green"><Leaf size={16}/></div><span>Agriculture Agent</span><b>On request</b></div>
                <div><div className="agent-icon blue"><CloudSun size={16}/></div><span>Climate Agent</span><b>On request</b></div>
                <div><div className="agent-icon amber"><Zap size={16}/></div><span>Resource Agent</span><b>Needs data</b></div>
              </div>
              <div className="route"><span>Last routed to</span><strong>{route.length ? route.join(" + ") : "Awaiting request"}</strong></div>
            </section>

            <section className="card">
              <div className="card-title"><h3>Recommended actions</h3><button>View all</button></div>
              <div className="action-list">
                <button><div className="action-icon blue"><Droplets size={16}/></div><div><strong>Review irrigation timing</strong><span>Use local soil moisture and weather readings</span></div><ChevronDown size={15}/></button>
                <button><div className="action-icon orange"><Sun size={16}/></div><div><strong>Check heat conditions</strong><span>Ask the Climate Agent for a current forecast</span></div><ChevronDown size={15}/></button>
              </div>
            </section>

            <section className="card alert-card">
              <div className="card-title"><h3>Alerts</h3><span className="alert-count">0</span></div>
              <div className="alert"><AlertTriangle size={16}/><div><strong>No current risk alerts</strong><span>Run a location-specific climate analysis</span></div></div>
            </section>

            <section className="card sources">
              <div className="card-title"><h3>Data sources</h3><span>On demand</span></div>
              <div><i className="source live"/><span>Open-Meteo weather</span><b>Query live</b></div>
              <div><i className="source live"/><span>ISRIC SoilGrids</span><b>Query live</b></div>
              <div><i className="source"/><span>Water and solar meters</span><b>Not connected</b></div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}

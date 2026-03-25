import { useState, useRef, useCallback, useEffect } from "react";



// ── API helpers ───────────────────────────────────────────────────
const post = async (endpoint, body) => {
  const res = await fetch("/api/chat", {
    method : "POST",
    headers: { "Content-Type": "application/json" },
    body   : JSON.stringify({ route: endpoint.replace("/api/",""), ...body }),
  });
  let data;
  try { data = await res.json(); } catch (_) { throw new Error("Server error."); }
  if (data.error) throw new Error(data.error);
  return data.text || "";
};

const toB64 = (f) => new Promise((ok, no) => {
  const r = new FileReader();
  r.onload = () => ok(r.result.split(",")[1]);
  r.onerror = no;
  r.readAsDataURL(f);
});
const toTxt = (f) => new Promise((ok, no) => {
  const r = new FileReader();
  r.onload = (e) => ok(e.target.result);
  r.onerror = no;
  r.readAsText(f);
});

// ── styles ────────────────────────────────────────────────────────
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#04080f;--teal:#00e5b0;--blue:#00b8ff;--rose:#ff4d7e;
  --amber:#ffb340;--violet:#a855f7;--green:#22d37a;
  --text:#dff0ea;--muted:#4a7a6e;
  --glow:0 0 60px rgba(0,229,176,0.1),0 4px 32px rgba(0,0,0,0.6);
}
body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;overflow-x:hidden}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:rgba(0,229,176,0.2);border-radius:4px}
select option{background:#080f1a;color:#dff0ea}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-18px)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0.15}}
@keyframes gpulse{0%,100%{opacity:0.6;box-shadow:0 0 20px rgba(0,229,176,0.4)}50%{opacity:1;box-shadow:0 0 35px rgba(0,229,176,0.7)}}
@keyframes chatPop{from{opacity:0;transform:scale(0.9) translateY(14px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes onlinePulse{0%,100%{box-shadow:0 0 0 0 rgba(34,211,122,0.5)}70%{box-shadow:0 0 0 7px rgba(34,211,122,0)}}
.fu{animation:fadeUp 0.5s ease both}
.fu1{animation:fadeUp 0.5s 0.1s ease both}
.fu2{animation:fadeUp 0.5s 0.2s ease both}
.glass{background:rgba(8,15,26,0.72);border:1px solid rgba(0,229,176,0.11);border-radius:20px;backdrop-filter:blur(24px);box-shadow:var(--glow)}
.chip{display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:20px;font-size:11px;font-family:'JetBrains Mono',monospace;font-weight:500;letter-spacing:0.04em;text-transform:uppercase}
.tab{padding:10px 22px;border-radius:30px;border:1px solid transparent;font-family:'Inter',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.2s;background:rgba(255,255,255,0.03);color:var(--muted)}
.tab:hover{color:var(--teal);border-color:rgba(0,229,176,0.2)}
.tab.on{background:rgba(0,229,176,0.1);color:var(--teal);border-color:rgba(0,229,176,0.35)}
.xbtn{display:flex;align-items:center;gap:7px;padding:10px 20px;border-radius:12px;border:1px solid;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s}
.xbtn:hover{transform:translateY(-2px);filter:brightness(1.15)}
.card{transition:transform 0.2s,box-shadow 0.2s}
.card:hover{transform:translateY(-3px);box-shadow:0 12px 40px rgba(0,0,0,0.4)}
`;

// ── data ──────────────────────────────────────────────────────────
const LANGS = [
  {c:"en",l:"English"},{c:"hi",l:"Hindi"},{c:"bn",l:"Bengali"},
  {c:"te",l:"Telugu"},{c:"mr",l:"Marathi"},{c:"ta",l:"Tamil"},
  {c:"gu",l:"Gujarati"},{c:"kn",l:"Kannada"},{c:"ml",l:"Malayalam"},
  {c:"pa",l:"Punjabi"},{c:"or",l:"Odia"},{c:"ur",l:"Urdu"},
];
const AGES = [
  {v:"child",l:"Child (6-12 yrs)"},{v:"teen",l:"Teen (13-17 yrs)"},
  {v:"adult",l:"Adult (18-59 yrs)"},{v:"senior",l:"Senior (60+ yrs)"},
];
const SEV = {
  normal:   {c:"#22d37a",b:"rgba(34,211,122,0.07)",e:"rgba(34,211,122,0.2)"},
  mild:     {c:"#ffb340",b:"rgba(255,179,64,0.07)", e:"rgba(255,179,64,0.2)"},
  moderate: {c:"#ff7a40",b:"rgba(255,122,64,0.07)", e:"rgba(255,122,64,0.2)"},
  severe:   {c:"#ff4d7e",b:"rgba(255,77,126,0.07)", e:"rgba(255,77,126,0.2)"},
};
const gs = (s) => SEV[s] || {c:"#4a7a6e",b:"rgba(74,122,110,0.07)",e:"rgba(74,122,110,0.15)"};

const SAMPLE = `Patient: Priya Sharma, 42 years | Female
Date: 20/03/2026 | Dr. Arvind Mehta, Lifeline Clinic Jaipur

DIAGNOSIS: Hypothyroidism, Iron Deficiency Anaemia, Vitamin D Deficiency, Grade I Fatty Liver

LABS:
- TSH: 9.8 mIU/L [HIGH] | Free T4: 0.6 ng/dL [LOW]
- Haemoglobin: 9.2 g/dL [LOW] | Ferritin: 8 ng/mL [LOW]
- SGPT: 58 U/L [HIGH] | SGOT: 49 U/L [HIGH]
- Vitamin D: 11 ng/mL [DEFICIENT]
- LDL: 138 mg/dL [HIGH] | Triglycerides: 178 mg/dL [HIGH]

MEDICATIONS:
- Levothyroxine 50mcg OD (empty stomach)
- Ferrous Ascorbate 100mg + Folic Acid BD after meals
- Cholecalciferol 60,000 IU weekly x8 weeks
- Omega-3 1000mg OD with dinner

ADVICE: Avoid alcohol, oily food. Eat spinach, lentils, jaggery. 15-20 min sun daily.
FOLLOW-UP: Repeat TFT, CBC, LFT after 6 weeks.`;

// ── Health Gauge ──────────────────────────────────────────────────
function Gauge({ score }) {
  const pct = Math.min(score, 100) / 100;
  const C   = 2 * Math.PI * 70;
  const col = score >= 70 ? "#22d37a" : score >= 45 ? "#ffb340" : "#ff4d7e";
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
      <svg width={180} height={110} viewBox="0 0 180 110">
        <defs>
          <linearGradient id="gg">
            <stop offset="0%" stopColor={col} stopOpacity=".4"/>
            <stop offset="100%" stopColor={col}/>
          </linearGradient>
        </defs>
        <path d="M20 100 A70 70 0 0 1 160 100" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" strokeLinecap="round"/>
        <path d="M20 100 A70 70 0 0 1 160 100" fill="none" stroke="url(#gg)" strokeWidth="12" strokeLinecap="round"
          strokeDasharray={C/2} strokeDashoffset={(C/2)*(1-pct)}
          style={{transition:"stroke-dashoffset 1.5s cubic-bezier(0.34,1.56,0.64,1)",filter:`drop-shadow(0 0 8px ${col})`}}/>
        <text x="90" y="85" textAnchor="middle" fontFamily="'Syne',serif" fontWeight="800" fontSize="30" fill={col}>{score}</text>
        <text x="90" y="102" textAnchor="middle" fontFamily="'Inter',sans-serif" fontSize="11" fill="#4a7a6e">/100</text>
      </svg>
      <div style={{fontSize:12,fontWeight:600,color:col,textTransform:"uppercase",fontFamily:"'JetBrains Mono',monospace"}}>
        {score >= 70 ? "Good" : score >= 45 ? "Fair" : "Needs Attention"}
      </div>
      <div style={{fontSize:11,color:"#4a7a6e"}}>Overall Health Score</div>
    </div>
  );
}

// ── System Badge ──────────────────────────────────────────────────
function SysBadge({ name, icon, status }) {
  const c = gs(status).c;
  return (
    <div className="card" style={{background:"rgba(0,0,0,0.25)",border:`1px solid ${c}33`,borderRadius:12,padding:"12px 14px",display:"flex",flexDirection:"column",alignItems:"center",gap:5,minWidth:80}}>
      <span style={{fontSize:24}}>{icon}</span>
      <div style={{fontSize:11,fontWeight:600,color:c,textAlign:"center",lineHeight:1.3}}>{name}</div>
      <div style={{width:6,height:6,borderRadius:"50%",background:c,boxShadow:`0 0 8px ${c}`}}/>
    </div>
  );
}

// ── AI Chat ───────────────────────────────────────────────────────
function Chat({ reportText, patientName, onClose }) {
  const [msgs, setMsgs] = useState([
    {r:"ai", t:`Hi! I have read ${patientName ? patientName + "'s" : "the"} medical report. Ask me anything in any language — I am here to help!`}
  ]);
  const [inp,  setInp]  = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef();

  useEffect(() => { endRef.current?.scrollIntoView({behavior:"smooth"}); }, [msgs]);

  const send = async () => {
    if (!inp.trim() || busy) return;
    const q = inp.trim(); setInp(""); setBusy(true);
    setMsgs((m) => [...m, {r:"user", t:q}]);
    try {
      const history = msgs.map((m) => ({
        role   : m.r === "user" ? "user" : "assistant",
        content: m.t,
      }));
      const reply = await post("/api/chat", {
        messages: [
          { role:"system", content:`You are a compassionate medical AI assistant. The patient's medical report summary:\n${reportText.slice(0,3000)}\n\nRules:\n- Answer in the EXACT SAME LANGUAGE the user writes in\n- Keep answers under 120 words\n- Be warm, simple, and reassuring\n- NEVER give a diagnosis\n- NEVER tell them to stop medications\n- Only explain, clarify, and reassure` },
          ...history,
          { role:"user", content:q },
        ],
      });
      setMsgs((m) => [...m, {r:"ai", t:reply || "Sorry, I could not answer that. Please try again."}]);
    } catch {
      setMsgs((m) => [...m, {r:"ai", t:"Connection error. Please check that node server.js is running."}]);
    } finally { setBusy(false); }
  };

  return (
    <div style={{position:"fixed",bottom:90,right:24,width:360,background:"#080f1a",border:"1px solid rgba(0,229,176,0.25)",borderRadius:20,boxShadow:"0 20px 60px rgba(0,0,0,0.8)",zIndex:1000,display:"flex",flexDirection:"column",overflow:"hidden",animation:"chatPop 0.3s ease"}}>
      {/* header */}
      <div style={{padding:"13px 16px",background:"linear-gradient(135deg,rgba(0,229,176,0.12),rgba(0,184,255,0.07))",borderBottom:"1px solid rgba(0,229,176,0.15)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#00e5b0,#00b8ff)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",color:"#04080f",fontSize:12}}>AI</div>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:"#00e5b0",fontFamily:"'Syne',serif"}}>MediHelp Assistant</div>
            <div style={{fontSize:10,color:"#4a7a6e",fontFamily:"'JetBrains Mono',monospace"}}>Ask follow-up questions in any language</div>
          </div>
        </div>
        <button onClick={onClose} style={{background:"rgba(255,77,126,0.1)",border:"1px solid rgba(255,77,126,0.3)",color:"#ff4d7e",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:13,fontWeight:700}}>✕</button>
      </div>

      {/* messages */}
      <div style={{flex:1,overflowY:"auto",padding:"14px",display:"flex",flexDirection:"column",gap:10,maxHeight:340,minHeight:200}}>
        {msgs.map((m, i) => (
          <div key={i} style={{display:"flex",justifyContent:m.r==="user"?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"85%",padding:"10px 14px",borderRadius:m.r==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",background:m.r==="user"?"linear-gradient(135deg,#00e5b0,#00b8ff)":"rgba(255,255,255,0.06)",color:m.r==="user"?"#04080f":"#dff0ea",fontSize:13,lineHeight:1.6,border:m.r==="ai"?"1px solid rgba(255,255,255,0.08)":"none"}}>{m.t}</div>
          </div>
        ))}
        {busy && (
          <div style={{display:"flex",gap:5,padding:"10px 14px",background:"rgba(255,255,255,0.05)",borderRadius:"16px 16px 16px 4px",width:"fit-content"}}>
            {[0,1,2].map((i) => <div key={i} style={{width:7,height:7,borderRadius:"50%",background:"#00e5b0",animation:`blink 1.2s ${i*0.2}s ease-in-out infinite`}}/>)}
          </div>
        )}
        <div ref={endRef}/>
      </div>

      {/* input */}
      <div style={{padding:"12px 14px",borderTop:"1px solid rgba(0,229,176,0.12)",display:"flex",gap:8}}>
        <input
          value={inp}
          onChange={(e) => setInp(e.target.value)}
          onKeyDown={(e) => e.key==="Enter" && !e.shiftKey && send()}
          placeholder="Type your question..."
          style={{flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(0,229,176,0.2)",borderRadius:10,padding:"9px 13px",color:"#dff0ea",fontFamily:"'Inter',sans-serif",fontSize:13,outline:"none"}}
        />
        <button onClick={send} disabled={busy||!inp.trim()} style={{background:busy||!inp.trim()?"rgba(0,229,176,0.08)":"linear-gradient(135deg,#00e5b0,#00b8ff)",border:"none",borderRadius:10,padding:"9px 16px",color:busy||!inp.trim()?"#4a7a6e":"#04080f",cursor:busy||!inp.trim()?"not-allowed":"pointer",fontWeight:700,fontSize:15}}>↑</button>
      </div>
    </div>
  );
}

// ── Background ────────────────────────────────────────────────────
function Bg() {
  return (
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
      <div style={{position:"absolute",top:"-20%",left:"-15%",width:"60vw",height:"60vw",borderRadius:"50%",background:"radial-gradient(circle,rgba(0,229,176,0.06) 0%,transparent 65%)",animation:"float 20s ease-in-out infinite"}}/>
      <div style={{position:"absolute",bottom:"-10%",right:"-10%",width:"50vw",height:"50vw",borderRadius:"50%",background:"radial-gradient(circle,rgba(255,77,126,0.05) 0%,transparent 65%)",animation:"float 26s 3s ease-in-out infinite"}}/>
      <div style={{position:"absolute",top:"35%",right:"20%",width:"40vw",height:"40vw",borderRadius:"50%",background:"radial-gradient(circle,rgba(168,85,247,0.04) 0%,transparent 65%)",animation:"float 18s 6s ease-in-out infinite"}}/>
      <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(0,229,176,0.022) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,176,0.022) 1px,transparent 1px)",backgroundSize:"80px 80px"}}/>
    </div>
  );
}

// ── Server status dot ─────────────────────────────────────────────
function ServerDot() {
  const [status, setStatus] = useState("checking");
  useEffect(() => {
    fetch("/api/chat", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({route:"health"}) })
      .then((r) => r.json())
      .then((d) => setStatus(d.keySet ? "online" : "nokey"))
      .catch(() => setStatus("offline"));
  }, []);
  const info = {
    checking: {c:"#ffb340",l:"Checking..."},
    online  : {c:"#22d37a",l:"Ready"},
    nokey   : {c:"#ffb340",l:"Key Missing"},
    offline : {c:"#ff4d7e",l:"Server Offline"},
  }[status] || {c:"#4a7a6e",l:"Unknown"};
  return (
    <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(0,0,0,0.3)",border:`1px solid ${info.c}33`,borderRadius:20,padding:"5px 12px"}}>
      <div style={{width:7,height:7,borderRadius:"50%",background:info.c,boxShadow:`0 0 8px ${info.c}`,animation:status==="online"?"onlinePulse 2s ease infinite":"none"}}/>
      <span style={{fontSize:11,color:info.c,fontFamily:"'JetBrains Mono',monospace"}}>{info.l}</span>
    </div>
  );
}

// ── PDF Download ──────────────────────────────────────────────────
function downloadPDF(result, lang, concerns) {
  const lL = LANGS.find((l) => l.c === lang)?.l || "English";
  const sc = result.healthScore >= 70 ? "#16a34a" : result.healthScore >= 45 ? "#d97706" : "#dc2626";
  const badge = (s) => { const c={normal:"#059669",mild:"#d97706",moderate:"#ea580c",severe:"#dc2626"}[s]||"#64748b"; return `<span style="background:${c}22;color:${c};padding:2px 9px;border-radius:10px;font-size:10px;font-weight:700;text-transform:uppercase;border:1px solid ${c}44">${s||""}</span>`; };
  const sec = (t) => `<h2 style="font-size:12px;text-transform:uppercase;letter-spacing:.07em;border-left:3px solid #0d9488;padding-left:10px;margin:22px 0 8px;color:#0f766e;font-family:Arial">${t}</h2>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>MediHelp Report</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Georgia,serif;color:#1e293b;max-width:760px;margin:0 auto;padding:28px;line-height:1.65;font-size:14px}
  @media print{body{padding:14px}@page{margin:1cm}}
</style>
</head><body>

<div style="display:flex;align-items:center;gap:14px;border-bottom:3px solid #0d9488;padding-bottom:12px;margin-bottom:18px">
  <div style="width:44px;height:44px;background:linear-gradient(135deg,#0d9488,#0ea5e9);border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-size:20px;font-weight:bold;font-family:Arial">M</div>
  <div><h1 style="margin:0;font-size:20px;color:#0f766e;font-family:Arial">MediHelp — Simplified Medical Report</h1><div style="font-size:11px;color:#64748b;margin-top:2px">AI-powered patient report simplifier</div></div>
  <div style="margin-left:auto;text-align:center;background:#f0fdfa;border:2px solid #0d9488;border-radius:12px;padding:8px 14px">
    <div style="font-size:26px;font-weight:900;color:${sc};font-family:Arial">${result.healthScore}</div>
    <div style="font-size:9px;color:#64748b;text-transform:uppercase;font-family:Arial">Health Score</div>
  </div>
</div>

<div style="background:#f0fdfa;border:1px solid #99f6e4;padding:11px 15px;border-radius:8px;font-size:13px;color:#0f766e;margin-bottom:14px;font-family:Arial">
  <strong>Patient:</strong> ${result.patientName || ""}
  &nbsp;|&nbsp;<strong>Age:</strong> ${result.age || ""}
  &nbsp;|&nbsp;<strong>Language:</strong> ${lL}
  &nbsp;|&nbsp;<strong>Date:</strong> ${new Date().toLocaleDateString("en-IN")}
  ${result.urgencyLevel ? `&nbsp;|&nbsp;<strong>Priority:</strong> ${result.urgencyLevel}` : ""}
</div>

<div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:13px;font-size:14px;color:#134e4a;margin-bottom:16px">${result.overallSummary}</div>

${result.scoreSummary ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:11px;font-size:13px;color:#92400e;margin-bottom:16px">📊 ${result.scoreSummary}</div>` : ""}

${sec("🔬 Key Findings")}
${(result.keyFindings||[]).map((f) => `
<div style="border:1px solid #e2e8f0;border-left:3px solid ${gs(f.severity).c};border-radius:8px;padding:11px 15px;margin-bottom:9px;display:flex;gap:12px;align-items:flex-start">
  <span style="font-size:20px;flex-shrink:0">${f.emoji||"+"}</span>
  <div>
    <div style="font-weight:700;font-size:14px;margin-bottom:2px">${f.term||""} ${badge(f.severity)} ${f.trend ? `<span style="font-size:11px;color:${f.trend==="improving"?"#16a34a":f.trend==="worsening"?"#dc2626":"#d97706"};margin-left:6px">${f.trend==="improving"?"↑ improving":f.trend==="worsening"?"↓ worsening":"→ stable"}</span>` : ""}</div>
    ${f.value ? `<div style="font-size:11px;color:#64748b;font-family:monospace;margin-bottom:3px">${f.value}</div>` : ""}
    <div style="font-size:13px;color:#475569">${f.plainExplanation}</div>
  </div>
</div>`).join("")}

${sec("💊 Medicines")}
${(result.medications||[]).map((m) => `
<div style="border:1px solid #bfdbfe;background:#eff6ff;border-radius:8px;padding:11px 15px;margin-bottom:8px">
  <div style="font-weight:700;color:#1d4ed8;margin-bottom:3px">💊 ${m.name}</div>
  <div style="font-size:13px;color:#475569;margin-bottom:2px">📌 ${m.purpose}</div>
  <div style="font-size:12px;color:#64748b">⏰ ${m.tips}</div>
</div>`).join("")}

${sec("🌿 Lifestyle Advice")}
${(result.lifestyleAdvice||[]).map((x) => `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:7px 12px;margin-bottom:5px;font-size:13px;color:#166534">✓ ${x}</div>`).join("")}

${sec("🥗 Diet Tips")}
${(result.dietTips||[]).map((x) => `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:7px 12px;margin-bottom:5px;font-size:13px;color:#92400e">• ${x}</div>`).join("")}

${(result.warningSignsToWatch||[]).length > 0 ? sec("⚠️ Warning Signs") + (result.warningSignsToWatch||[]).map((x) => `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:7px 12px;margin-bottom:5px;font-size:13px;color:#9a3412">🔔 ${x}</div>`).join("") : ""}

${sec("📅 Next Steps")}
<div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:13px;font-size:14px;color:#6b21a8">${result.nextSteps}</div>

${concerns && result.concernsAddressed ? `
${sec("❓ Your Specific Concern — Addressed")}
<div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:15px;font-size:14px;color:#713f12;border-left:4px solid #f59e0b">
  <div style="font-weight:700;margin-bottom:6px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#92400e">Your concern: "${concerns}"</div>
  ${result.concernsAddressed}
</div>` : ""}

<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:13px;font-size:14px;color:#065f46;margin-top:16px">💚 ${result.encouragingNote}</div>

<div style="margin-top:22px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:11px;font-family:Arial">
  ⚕️ <strong>Disclaimer:</strong> This is an AI-generated simplified explanation for informational purposes only. Always consult your qualified doctor for medical advice. | Generated by MediHelp
</div>

</body></html>`;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.focus();
  // trigger print dialog which lets user save as PDF
  setTimeout(() => {
    w.print();
  }, 600);
}

// ── MAIN APP ──────────────────────────────────────────────────────
export default function App() {
  const [reportText, setReportText] = useState("");
  const [fileInfo,   setFileInfo]   = useState(null); // {type, name, b64, mime}
  const [lang,       setLang]       = useState("en");
  const [age,        setAge]        = useState("adult");
  const [concerns,   setConcerns]   = useState("");
  const [result,     setResult]     = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [step,       setStep]       = useState(0);
  const [error,      setError]      = useState(null);
  const [drag,       setDrag]       = useState(false);
  const [tab,        setTab]        = useState("findings");
  const [copied,     setCopied]     = useState(false);
  const [chatOpen,   setChatOpen]   = useState(false);
  const [scoreAnim,  setScoreAnim]  = useState(0);
  const fileRef = useRef();

  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = STYLES;
    document.head.appendChild(el);
    return () => { if (document.head.contains(el)) document.head.removeChild(el); };
  }, []);

  useEffect(() => {
    if (result?.healthScore) {
      const t = setTimeout(() => setScoreAnim(result.healthScore), 400);
      return () => clearTimeout(t);
    }
  }, [result]);

  const STEPS = ["Reading your report...","Identifying medical terms...","Translating findings...","Building your summary...","Almost done..."];

  // ── file ingest ──────────────────────────────────────────────────
  const ingest = useCallback(async (file) => {
    setError(null);
    const mime = file.type;
    const name = file.name;

    if (mime === "text/plain") {
      const txt = await toTxt(file);
      setReportText(txt);
      setFileInfo({type:"text", name});
    } else if (mime === "application/pdf") {
      const b64 = await toB64(file);
      setFileInfo({type:"pdf", name, b64, mime});
      setReportText("");
    } else if (mime.startsWith("image/")) {
      const b64 = await toB64(file);
      setFileInfo({type:"image", name, b64, mime});
      setReportText("");
    } else {
      setError("Please upload a PDF, image (JPG/PNG), or text (.txt) file.");
    }
  }, []);

  const clearFile = () => { setFileInfo(null); setReportText(""); };
  const hasInput  = reportText.trim() || (fileInfo && fileInfo.type !== "text");

  // ── prompt builder ───────────────────────────────────────────────
  const buildSystemPrompt = () => {
    const lL = LANGS.find((l) => l.c === lang)?.l || "English";
    const aL = AGES.find((a)  => a.v === age)?.l  || "Adult";
    return `You are a compassionate medical AI helping Indian patients understand their medical reports.

CRITICAL RULES:
1. Write ALL patient-facing text in ${lL} language. JSON keys stay in English. All values in ${lL}.
2. Respond with ONLY valid JSON. No markdown fences, no backticks, no text before or after.
3. For concernsAddressed: give a SPECIFIC, DETAILED, ACTIONABLE answer to the patient's concern.

PATIENT CONTEXT: Age Group: ${aL} | Language: ${lL} | Patient Concern: "${concerns || "None"}"

Return EXACTLY this JSON:
{
  "patientName":"extracted name or Patient",
  "age":"extracted age",
  "healthScore":65,
  "scoreSummary":"one sentence reason in ${lL}",
  "overallSummary":"2-3 clear sentences in ${lL}",
  "affectedSystems":[{"name":"in ${lL}","icon":"emoji","status":"normal|mild|moderate|severe"}],
  "keyFindings":[{"term":"medical term","value":"lab value if any","plainExplanation":"clear explanation in ${lL}","severity":"normal|mild|moderate|severe","emoji":"relevant emoji","trend":"stable|improving|worsening"}],
  "medications":[{"name":"medicine name","purpose":"what it does in ${lL}","tips":"when/how to take in ${lL}"}],
  "lifestyleAdvice":["advice in ${lL}"],
  "dietTips":["specific diet tip in ${lL}"],
  "nextSteps":"what to do next in ${lL}",
  "concernsAddressed":"${concerns ? "Give a detailed specific answer to: " + concerns + " in " + lL : "General reassurance in " + lL}",
  "warningSignsToWatch":["warning sign in ${lL}"],
  "encouragingNote":"warm encouraging closing message in ${lL}",
  "urgencyLevel":"routine|soon|urgent"
}`;
  };

  // ── analyze ──────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!hasInput) return;
    setLoading(true); setError(null); setResult(null); setStep(0);
    const iv = setInterval(() => setStep((s) => s < 4 ? s + 1 : 4), 900);
    try {
      let txt = "";
      const sp = buildSystemPrompt();

      if (fileInfo?.type === "image") {
        txt = await post("/api/analyze-image", { systemPrompt: sp, imageBase64: fileInfo.b64, mimeType: fileInfo.mime });
      } else if (fileInfo?.type === "pdf") {
        txt = await post("/api/analyze-pdf", { systemPrompt: sp, pdfBase64: fileInfo.b64 });
      } else {
        txt = await post("/api/analyze", { systemPrompt: sp, userMessage: "MEDICAL REPORT:\n" + reportText });
      }

      const clean = txt.replace(/```json/g,"").replace(/```/g,"").trim();
      const start = clean.indexOf("{");
      const end   = clean.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("Could not parse AI response. Please try again.");
      setResult(JSON.parse(clean.slice(start, end + 1)));
      setTab("findings");
    } catch (err) {
      const m = err.message || "";
      if (m.includes("fetch") || m.includes("Failed") || m.includes("Network"))
        setError("Cannot reach server. Run: node server.js in a terminal.");
      else setError("Error: " + m);
    } finally { clearInterval(iv); setLoading(false); }
  };

  // ── copy as text ─────────────────────────────────────────────────
  const buildPlainText = () => {
    const r = result; if (!r) return "";
    const lL = LANGS.find((l) => l.c === lang)?.l || "English";
    let t = "MEDIHELP - SIMPLIFIED MEDICAL REPORT\n" + "=".repeat(52) + "\n";
    t += `Patient: ${r.patientName} | ${r.age}\nLanguage: ${lL} | Date: ${new Date().toLocaleDateString("en-IN")}\nHealth Score: ${r.healthScore}/100\n\n`;
    t += "SUMMARY\n" + "-".repeat(42) + "\n" + r.overallSummary + "\n\n";
    t += "KEY FINDINGS\n" + "-".repeat(42) + "\n";
    (r.keyFindings||[]).forEach((f) => { t += `${f.emoji||""} ${f.term}${f.value?` (${f.value})`:""} [${(f.severity||"").toUpperCase()}]\n  ${f.plainExplanation}\n\n`; });
    t += "MEDICINES\n" + "-".repeat(42) + "\n";
    (r.medications||[]).forEach((m) => { t += `* ${m.name}\n  ${m.purpose}\n  ${m.tips}\n\n`; });
    t += "LIFESTYLE\n" + "-".repeat(42) + "\n"; (r.lifestyleAdvice||[]).forEach((x) => { t += `- ${x}\n`; });
    t += "\nDIET\n" + "-".repeat(42) + "\n"; (r.dietTips||[]).forEach((x) => { t += `- ${x}\n`; });
    t += "\nWARNING SIGNS\n" + "-".repeat(42) + "\n"; (r.warningSignsToWatch||[]).forEach((x) => { t += `! ${x}\n`; });
    t += `\nNEXT STEPS\n` + "-".repeat(42) + "\n" + r.nextSteps + "\n";
    if (concerns && r.concernsAddressed) t += `\nYOUR CONCERN ANSWERED\n` + "-".repeat(42) + "\n" + r.concernsAddressed + "\n";
    t += `\n${r.encouragingNote}\n\n` + "=".repeat(52) + "\nDisclaimer: For informational purposes only. Always consult your doctor.\nGenerated by MediHelp\n";
    return t;
  };

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(buildPlainText()); setCopied(true); setTimeout(() => setCopied(false), 2200); } catch (_) {}
  };

  const urgC = (u) => ({routine:"#22d37a",soon:"#ffb340",urgent:"#ff4d7e"})[u] || "#22d37a";

  // ── render ────────────────────────────────────────────────────────
  return (
    <div style={{position:"relative",zIndex:1,minHeight:"100vh"}}>
      <Bg/>

      {chatOpen && (
        <Chat
          reportText={reportText || (result ? JSON.stringify(result) : "")}
          patientName={result?.patientName}
          onClose={() => setChatOpen(false)}
        />
      )}

      {result && !chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          title="Ask follow-up questions"
          style={{position:"fixed",bottom:24,right:24,width:58,height:58,borderRadius:"50%",background:"linear-gradient(135deg,#00e5b0,#00b8ff)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",color:"#04080f",fontSize:11,zIndex:999,boxShadow:"0 4px 28px rgba(0,229,176,0.5)",animation:"gpulse 2s ease-in-out infinite",flexDirection:"column",gap:1}}
        >
          <span style={{fontSize:18}}>💬</span>
          <span style={{fontSize:8,letterSpacing:"0.05em"}}>ASK AI</span>
        </button>
      )}

      {/* HEADER */}
      <header style={{position:"sticky",top:0,zIndex:100,background:"rgba(4,8,15,0.92)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(0,229,176,0.08)"}}>
        <div style={{maxWidth:1040,margin:"0 auto",padding:"0 24px",display:"flex",alignItems:"center",height:64,gap:14}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:38,height:38,borderRadius:10,background:"linear-gradient(135deg,#00e5b0,#00b8ff)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",color:"#04080f",fontSize:18,boxShadow:"0 0 18px rgba(0,229,176,0.45)"}}>M</div>
            <div>
              <div style={{fontFamily:"'Syne',serif",fontSize:20,fontWeight:900,background:"linear-gradient(90deg,#00e5b0,#00b8ff)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>MediHelp</div>
              <div style={{fontSize:9,color:"#4a7a6e",fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.1em",textTransform:"uppercase"}}>AI Medical Report Simplifier</div>
            </div>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <span className="chip" style={{background:"rgba(0,229,176,0.07)",color:"#00e5b0",border:"1px solid rgba(0,229,176,0.18)"}}>12 Languages</span>
            <span className="chip" style={{background:"rgba(0,184,255,0.07)",color:"#00b8ff",border:"1px solid rgba(0,184,255,0.18)"}}>PDF + Image + Text</span>
            <span className="chip" style={{background:"rgba(168,85,247,0.07)",color:"#a855f7",border:"1px solid rgba(168,85,247,0.18)"}}>AI Chat</span>
          </div>
          <div style={{marginLeft:"auto"}}><ServerDot/></div>
        </div>
      </header>

      <main style={{maxWidth:1040,margin:"0 auto",padding:"36px 24px 80px"}}>

        {!result && (
          <div className="fu" style={{textAlign:"center",marginBottom:40}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:7,background:"rgba(0,229,176,0.06)",border:"1px solid rgba(0,229,176,0.15)",borderRadius:30,padding:"5px 16px",marginBottom:18,fontSize:11,color:"#00e5b0",fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.05em"}}>
              BRIDGING INDIA'S HEALTH COMMUNICATION GAP
            </div>
            <h1 style={{fontFamily:"'Syne',serif",fontSize:"clamp(32px,5vw,56px)",fontWeight:900,lineHeight:1.07,letterSpacing:"-0.02em",marginBottom:14}}>
              <span style={{color:"var(--text)"}}>Understand your </span>
              <span style={{background:"linear-gradient(135deg,#00e5b0 0%,#00b8ff 50%,#a855f7 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>medical report</span>
              <span style={{color:"var(--text)"}}> instantly.</span>
            </h1>
            <p style={{fontSize:16,color:"#4a7a6e",maxWidth:500,margin:"0 auto",lineHeight:1.7,fontWeight:300}}>
              Upload a PDF, photo, or paste text. Get a clear explanation in your language.
            </p>
          </div>
        )}

        {/* INPUT CARD */}
        {!result && (
          <div className="glass fu1" style={{padding:"28px 30px",marginBottom:18}}>

            {/* upload zone */}
            <div
              onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) ingest(f); }}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              style={{border:`2px dashed ${drag?"#00e5b0":"rgba(0,229,176,0.18)"}`,borderRadius:14,marginBottom:18,background:drag?"rgba(0,229,176,0.04)":"rgba(0,0,0,0.18)",transition:"all 0.22s",overflow:"hidden"}}
            >
              {/* file preview */}
              {fileInfo && fileInfo.type !== "text" ? (
                <div style={{padding:"18px 22px",display:"flex",alignItems:"center",gap:14}}>
                  <div style={{width:50,height:50,borderRadius:12,background:fileInfo.type==="pdf"?"rgba(255,77,126,0.13)":"rgba(0,184,255,0.13)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",color:fileInfo.type==="pdf"?"#ff4d7e":"#00b8ff",fontSize:13,flexShrink:0,border:`1px solid ${fileInfo.type==="pdf"?"rgba(255,77,126,0.3)":"rgba(0,184,255,0.3)"}`}}>
                    {fileInfo.type==="pdf" ? "PDF" : "IMG"}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600,color:"#dff0ea"}}>{fileInfo.name}</div>
                    <div style={{fontSize:12,color:"#4a7a6e",marginTop:3}}>
                      {fileInfo.type==="pdf" ? "📄 PDF — text will be extracted automatically" : "🖼️ Image — AI will read the text from the photo"}
                    </div>
                  </div>
                  <button onClick={clearFile} style={{background:"rgba(255,77,126,0.1)",border:"1px solid rgba(255,77,126,0.3)",color:"#ff4d7e",padding:"6px 14px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600}}>Remove</button>
                </div>
              ) : (
                <div>
                  <textarea
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                    placeholder="Paste your medical report text here..."
                    rows={8}
                    style={{width:"100%",background:"transparent",border:"none",color:"#dff0ea",fontFamily:"'JetBrains Mono',monospace",fontSize:13,lineHeight:1.65,resize:"vertical",padding:"18px 20px",outline:"none"}}
                  />
                  <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:"12px 20px",borderTop:"1px dashed rgba(0,229,176,0.12)",flexWrap:"wrap"}}>
                    {[{icon:"📄",l:"PDF"},{icon:"🖼️",l:"JPG / PNG"},{icon:"📝",l:"Text File"}].map((f) => (
                      <div key={f.l} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#4a7a6e",background:"rgba(255,255,255,0.03)",padding:"4px 10px",borderRadius:18,border:"1px solid rgba(255,255,255,0.06)"}}>{f.icon} {f.l}</div>
                    ))}
                    <button onClick={() => fileRef.current?.click()} style={{background:"rgba(0,229,176,0.08)",border:"1px solid rgba(0,229,176,0.2)",color:"#00e5b0",padding:"4px 12px",borderRadius:18,cursor:"pointer",fontSize:12}}>Browse File</button>
                  </div>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.txt,.jpg,.jpeg,.png,.webp" style={{display:"none"}} onChange={(e) => { const f = e.target.files[0]; if (f) ingest(f); e.target.value=""; }}/>

            {/* settings */}
            <div style={{display:"flex",gap:9,alignItems:"center",flexWrap:"wrap",marginBottom:18}}>
              <button onClick={() => { clearFile(); setReportText(SAMPLE); }} style={{background:"none",border:"1px solid rgba(0,229,176,0.2)",color:"#00e5b0",padding:"7px 14px",borderRadius:20,cursor:"pointer",fontSize:12}}>Load Sample</button>
              <div style={{flex:1}}/>
              <div style={{position:"relative"}}>
                <select value={lang} onChange={(e) => setLang(e.target.value)} style={{appearance:"none",background:"rgba(0,0,0,0.38)",border:"1px solid rgba(0,229,176,0.16)",borderRadius:10,padding:"8px 30px 8px 13px",color:"#dff0ea",fontFamily:"'Inter',sans-serif",fontSize:13,cursor:"pointer",outline:"none"}}>
                  {LANGS.map((l) => <option key={l.c} value={l.c}>{l.l}</option>)}
                </select>
                <span style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:"#4a7a6e",fontSize:10}}>▾</span>
              </div>
              <div style={{position:"relative"}}>
                <select value={age} onChange={(e) => setAge(e.target.value)} style={{appearance:"none",background:"rgba(0,0,0,0.38)",border:"1px solid rgba(0,229,176,0.16)",borderRadius:10,padding:"8px 30px 8px 13px",color:"#dff0ea",fontFamily:"'Inter',sans-serif",fontSize:13,cursor:"pointer",outline:"none"}}>
                  {AGES.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}
                </select>
                <span style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:"#4a7a6e",fontSize:10}}>▾</span>
              </div>
              <input
                value={concerns}
                onChange={(e) => setConcerns(e.target.value)}
                placeholder="Your concern? e.g. side effects"
                style={{background:"rgba(0,0,0,0.38)",border:"1px solid rgba(0,229,176,0.16)",borderRadius:10,padding:"8px 13px",color:"#dff0ea",fontFamily:"'Inter',sans-serif",fontSize:13,width:220,outline:"none"}}
              />
            </div>

            <button
              onClick={handleAnalyze}
              disabled={loading || !hasInput}
              style={{width:"100%",padding:"16px",background:loading||!hasInput?"rgba(0,229,176,0.07)":"linear-gradient(135deg,#00e5b0 0%,#00b8ff 55%,#a855f7 100%)",border:"none",borderRadius:14,color:loading||!hasInput?"#4a7a6e":"#04080f",fontFamily:"'Syne',serif",fontSize:17,fontWeight:800,cursor:loading||!hasInput?"not-allowed":"pointer",transition:"all 0.2s",boxShadow:loading||!hasInput?"none":"0 0 36px rgba(0,229,176,0.28)",display:"flex",alignItems:"center",justifyContent:"center",gap:11}}
            >
              {loading ? (
                <span style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{width:18,height:18,border:"2px solid rgba(0,229,176,0.2)",borderTopColor:"#00e5b0",borderRadius:"50%",display:"inline-block",animation:"spin 0.7s linear infinite"}}/>
                  <span style={{color:"#00e5b0",fontFamily:"'Inter',sans-serif",fontWeight:500}}>{STEPS[step]}</span>
                </span>
              ) : "✦ Simplify My Medical Report"}
            </button>
          </div>
        )}

        {error && (
          <div style={{background:"rgba(255,77,126,0.06)",border:"1px solid rgba(255,77,126,0.28)",borderRadius:13,padding:"14px 18px",marginBottom:18,fontSize:13,color:"#ff8fa8",lineHeight:1.7}}>
            {error}
            {error.includes("server") && <div style={{marginTop:6,fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:"#ffb340"}}>Run in terminal: <strong>node server.js</strong></div>}
          </div>
        )}

        {/* ── RESULTS ── */}
        {result && (
          <div style={{animation:"fadeUp 0.5s ease both"}}>

            {/* action bar */}
            <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:18,flexWrap:"wrap"}}>
              <button onClick={() => { setResult(null); setScoreAnim(0); setChatOpen(false); }} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:"#4a7a6e",borderRadius:10,padding:"8px 16px",cursor:"pointer",fontSize:13}}>← New Report</button>
              <div style={{flex:1}}/>
              <button className="xbtn" onClick={handleCopy} style={{borderColor:copied?"rgba(34,211,122,0.45)":"rgba(255,255,255,0.1)",background:copied?"rgba(34,211,122,0.1)":"rgba(255,255,255,0.04)",color:copied?"#22d37a":"#4a7a6e"}}>{copied?"✓ Copied":"📋 Copy"}</button>
              <button className="xbtn" onClick={() => downloadPDF(result, lang, concerns)} style={{borderColor:"rgba(255,77,126,0.33)",background:"rgba(255,77,126,0.07)",color:"#ff4d7e"}}>📥 Download PDF</button>
              <button className="xbtn" onClick={() => setChatOpen(true)} style={{borderColor:"rgba(0,229,176,0.35)",background:"rgba(0,229,176,0.08)",color:"#00e5b0"}}>💬 Ask Follow-up</button>
            </div>

            {/* patient + score row */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:14}}>
              <div className="glass card" style={{padding:"20px 22px",gridColumn:"span 2"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
                  <div style={{width:52,height:52,borderRadius:14,background:"linear-gradient(135deg,rgba(0,229,176,0.18),rgba(0,184,255,0.18))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0,border:"1px solid rgba(0,229,176,0.18)"}}>👤</div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:5,flexWrap:"wrap"}}>
                      <div style={{fontFamily:"'Syne',serif",fontSize:21,fontWeight:800,color:"#00e5b0"}}>{result.patientName}</div>
                      {result.age && <span className="chip" style={{background:"rgba(0,229,176,0.07)",color:"#4a7a6e",border:"1px solid rgba(0,229,176,0.12)"}}>{result.age}</span>}
                      {result.urgencyLevel && (
                        <span className="chip" style={{background:urgC(result.urgencyLevel)+"18",color:urgC(result.urgencyLevel),border:`1px solid ${urgC(result.urgencyLevel)}33`}}>
                          {{routine:"✅ Routine",soon:"⚠️ Follow up soon",urgent:"🚨 Urgent"}[result.urgencyLevel]||result.urgencyLevel}
                        </span>
                      )}
                    </div>
                    <div style={{fontSize:14,color:"#6a9a90",lineHeight:1.65,fontWeight:300}}>{result.overallSummary}</div>
                    {result.encouragingNote && <div style={{marginTop:10,fontSize:12,color:"#00e5b0",fontStyle:"italic"}}>💚 {result.encouragingNote}</div>}
                  </div>
                </div>
              </div>
              <div className="glass card" style={{padding:"18px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                <Gauge score={scoreAnim}/>
                {result.scoreSummary && <div style={{fontSize:11,color:"#4a7a6e",textAlign:"center",marginTop:5,lineHeight:1.5,padding:"0 6px"}}>{result.scoreSummary}</div>}
              </div>
            </div>

            {/* body systems */}
            {result.affectedSystems?.length > 0 && (
              <div className="glass" style={{padding:"16px 20px",marginBottom:14}}>
                <div style={{fontSize:11,color:"#4a7a6e",fontFamily:"'JetBrains Mono',monospace",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>🫀 Body Systems Affected</div>
                <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
                  {result.affectedSystems.map((s,i) => <SysBadge key={i} name={s.name} icon={s.icon} status={s.status}/>)}
                </div>
              </div>
            )}

            {/* ── CONCERNS BOX — shown prominently if user entered a concern ── */}
            {concerns && result.concernsAddressed && (
              <div style={{background:"linear-gradient(135deg,rgba(255,179,64,0.08),rgba(255,179,64,0.04))",border:"2px solid rgba(255,179,64,0.35)",borderRadius:16,padding:"20px 24px",marginBottom:16,position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:0,left:0,width:4,height:"100%",background:"linear-gradient(180deg,#ffb340,#ff7a40)"}}/>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <span style={{fontSize:20}}>❓</span>
                  <div style={{fontSize:11,fontWeight:700,color:"#ffb340",fontFamily:"'JetBrains Mono',monospace",textTransform:"uppercase",letterSpacing:"0.08em"}}>Your Concern — Answered</div>
                </div>
                <div style={{background:"rgba(255,179,64,0.1)",border:"1px solid rgba(255,179,64,0.2)",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:12,color:"#ffb340",fontFamily:"'JetBrains Mono',monospace"}}>
                  "{concerns}"
                </div>
                <div style={{fontSize:14,color:"#fde68a",lineHeight:1.7,fontWeight:300}}>{result.concernsAddressed}</div>
              </div>
            )}

            {/* tabs */}
            <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
              {[{id:"findings",l:"🔬 Findings"},{id:"meds",l:"💊 Medicines"},{id:"lifestyle",l:"🌿 Diet & Lifestyle"},{id:"next",l:"📅 Next Steps"}].map((t) => (
                <button key={t.id} className={`tab${tab===t.id?" on":""}`} onClick={() => setTab(t.id)}>{t.l}</button>
              ))}
            </div>

            {/* findings */}
            {tab==="findings" && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
                {(result.keyFindings||[]).map((f,i) => {
                  const s = gs(f.severity);
                  return (
                    <div key={i} className="card" style={{background:s.b,border:`1px solid ${s.e}`,borderLeft:`3px solid ${s.c}`,borderRadius:13,padding:"15px 17px"}}>
                      <div style={{display:"flex",alignItems:"flex-start",gap:9,marginBottom:7}}>
                        <span style={{fontSize:22,lineHeight:1,flexShrink:0}}>{f.emoji||"+"}</span>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700,fontSize:14,color:"#dff0ea",marginBottom:2}}>{f.term}</div>
                          {f.value && <div style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:"#4a7a6e"}}>{f.value}</div>}
                        </div>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3,flexShrink:0}}>
                          <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",padding:"2px 8px",borderRadius:18,background:s.c+"18",color:s.c,border:`1px solid ${s.e}`,fontFamily:"'JetBrains Mono',monospace"}}>{f.severity}</span>
                          {f.trend && <span style={{fontSize:10,color:f.trend==="improving"?"#22d37a":f.trend==="worsening"?"#ff4d7e":"#ffb340",fontFamily:"'JetBrains Mono',monospace"}}>{f.trend==="improving"?"↑ better":f.trend==="worsening"?"↓ worse":"→ stable"}</span>}
                        </div>
                      </div>
                      <p style={{margin:0,fontSize:13,color:"#6a9a90",lineHeight:1.6}}>{f.plainExplanation}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* medicines */}
            {tab==="meds" && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
                {(result.medications||[]).length > 0 ? (result.medications||[]).map((m,i) => {
                  const cols = ["#00e5b0","#00b8ff","#a855f7","#ffb340","#ff4d7e"];
                  const c = cols[i%cols.length];
                  return (
                    <div key={i} className="card glass" style={{padding:"16px 18px",display:"flex",gap:12,alignItems:"flex-start"}}>
                      <div style={{width:42,height:42,borderRadius:11,background:c+"18",border:`1px solid ${c}33`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",color:c,fontSize:12,flexShrink:0}}>Rx</div>
                      <div>
                        <div style={{fontWeight:700,fontSize:15,color:c,marginBottom:4}}>{m.name}</div>
                        <div style={{fontSize:13,color:"#8ab8b0",marginBottom:4,lineHeight:1.55}}>📌 {m.purpose}</div>
                        <div style={{fontSize:12,color:"#4a7a6e"}}>⏰ {m.tips}</div>
                      </div>
                    </div>
                  );
                }) : <p style={{color:"#4a7a6e"}}>No medications listed.</p>}
              </div>
            )}

            {/* lifestyle */}
            {tab==="lifestyle" && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
                <div>
                  <div style={{fontSize:11,color:"#4a7a6e",fontFamily:"'JetBrains Mono',monospace",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:9}}>Lifestyle Advice</div>
                  {(result.lifestyleAdvice||[]).map((t,i) => (
                    <div key={i} className="card" style={{background:"rgba(34,211,122,0.05)",border:"1px solid rgba(34,211,122,0.14)",borderRadius:11,padding:"11px 14px",display:"flex",gap:8,alignItems:"flex-start",marginBottom:8}}>
                      <span style={{color:"#22d37a",flexShrink:0,fontSize:14}}>✓</span>
                      <span style={{fontSize:13,color:"#6a9a90",lineHeight:1.55}}>{t}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{fontSize:11,color:"#4a7a6e",fontFamily:"'JetBrains Mono',monospace",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:9}}>Diet Tips</div>
                  {(result.dietTips||[]).map((t,i) => (
                    <div key={i} className="card" style={{background:"rgba(255,179,64,0.05)",border:"1px solid rgba(255,179,64,0.14)",borderRadius:11,padding:"11px 14px",display:"flex",gap:8,alignItems:"flex-start",marginBottom:8}}>
                      <span style={{color:"#ffb340",flexShrink:0,fontSize:14}}>🥗</span>
                      <span style={{fontSize:13,color:"#6a9a90",lineHeight:1.55}}>{t}</span>
                    </div>
                  ))}
                  {(result.warningSignsToWatch||[]).length > 0 && (
                    <div style={{marginTop:14}}>
                      <div style={{fontSize:11,color:"#ff4d7e",fontFamily:"'JetBrains Mono',monospace",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:9}}>⚠️ Warning Signs</div>
                      {(result.warningSignsToWatch||[]).map((w,i) => (
                        <div key={i} style={{background:"rgba(255,77,126,0.05)",border:"1px solid rgba(255,77,126,0.16)",borderRadius:10,padding:"10px 13px",display:"flex",gap:8,marginBottom:7}}>
                          <span style={{color:"#ff4d7e",flexShrink:0}}>🔔</span>
                          <span style={{fontSize:13,color:"#ff8fa8",lineHeight:1.55}}>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* next steps */}
            {tab==="next" && (
              <div style={{display:"flex",flexDirection:"column",gap:13}}>
                <div className="glass" style={{padding:"20px 22px"}}>
                  <div style={{fontSize:11,color:"#ffb340",fontFamily:"'JetBrains Mono',monospace",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:9}}>📅 What to Do Next</div>
                  <p style={{margin:0,fontSize:15,color:"#dff0ea",lineHeight:1.7,fontWeight:300}}>{result.nextSteps}</p>
                </div>

                {/* prompt to use chat */}
                <div style={{background:"rgba(0,229,176,0.06)",border:"1px solid rgba(0,229,176,0.2)",borderRadius:14,padding:"18px 22px",display:"flex",alignItems:"center",gap:14}}>
                  <span style={{fontSize:28}}>💬</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:14,color:"#00e5b0",marginBottom:4}}>Have more questions?</div>
                    <div style={{fontSize:13,color:"#4a7a6e",lineHeight:1.6}}>Click the chat button below to ask anything about this report in any language. Our AI will answer in the same language you write in.</div>
                  </div>
                  <button onClick={() => setChatOpen(true)} style={{background:"linear-gradient(135deg,#00e5b0,#00b8ff)",border:"none",borderRadius:10,padding:"10px 18px",color:"#04080f",fontWeight:700,fontSize:13,cursor:"pointer",flexShrink:0}}>Open Chat</button>
                </div>

                <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:11,padding:"13px 16px",fontSize:11,color:"#2a5a50",lineHeight:1.7}}>
                  ⚕️ <strong style={{color:"#4a7a6e"}}>Disclaimer:</strong> MediHelp is an AI-powered informational tool. Always consult a qualified doctor for medical advice.
                </div>
              </div>
            )}
          </div>
        )}

        {!result && !loading && (
          <div className="fu2" style={{textAlign:"center",padding:"36px 20px"}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,maxWidth:580,margin:"0 auto"}}>
              {[{icon:"📄",t:"Any Format",d:"PDF, photo, or text"},{icon:"🌍",t:"12 Languages",d:"All Indian languages"},{icon:"💬",t:"AI Chat",d:"Ask follow-up questions"}].map((c,i) => (
                <div key={i} className="glass" style={{padding:"20px 14px",textAlign:"center"}}>
                  <div style={{fontSize:28,marginBottom:9}}>{c.icon}</div>
                  <div style={{fontSize:13,fontWeight:600,color:"#dff0ea",marginBottom:3}}>{c.t}</div>
                  <div style={{fontSize:11,color:"#4a7a6e",lineHeight:1.5}}>{c.d}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer style={{borderTop:"1px solid rgba(0,229,176,0.06)",padding:"16px 24px",textAlign:"center",color:"#2a5a50",fontFamily:"'JetBrains Mono',monospace",fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase"}}>
        MediHelp — AI Medical Report Simplifier — Bridging India's Health Communication Gap
      </footer>
    </div>
  );
}
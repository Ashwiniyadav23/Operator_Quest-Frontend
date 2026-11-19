import { useEffect, useMemo, useState } from "react";

const API = `${(import.meta.env.VITE_API_URL || "").replace(/\/$/, "")}/api`;
const CATEGORIES = [
  { id:"arithmetic", name:"Arithmetic", icon:"➗", tint:"#eeeaff", desc:"Work out totals, groups and remainders in a flowchart.", operators:["+","-","*","/","//","%","**"] },
  { id:"comparison", name:"Comparisons", icon:"⚖️", tint:"#e7f7f2", desc:"Compare values in a decision diamond and choose a path.", operators:[">","<",">=","<=","==","!="] },
  { id:"logical", name:"Logic", icon:"🧩", tint:"#fff3df", desc:"Combine yes or no conditions with AND, OR and NOT.", operators:["AND","OR","NOT"] },
  { id:"assignment", name:"Flowchart actions", icon:"📝", tint:"#eaf1ff", desc:"Show how a process block stores or changes a value.", operators:["=","+=","-=","*=","/=","//=","%=","**="] },
  { id:"ternary", name:"Decisions & paths", icon:"🔀", tint:"#ffeaf1", desc:"Follow the yes or no branch from a decision diamond.", operators:["if/else"] }
];
const OPERATOR_NAMES = {
  "+": "Addition", "-": "Subtraction", "*": "Multiplication", "/": "Division",
  "//": "Floor division", "%": "Modulo / remainder", "**": "Exponentiation / power",
  ">": "Greater than", "<": "Less than", ">=": "Greater than or equal", "<=": "Less than or equal",
  "==": "Equality", "!=": "Inequality", AND: "Logical AND", OR: "Logical OR", NOT: "Logical NOT",
  "=": "Assignment", "+=": "Addition assignment", "-=": "Subtraction assignment", "*=": "Multiplication assignment",
  "/=": "Division assignment", "//=": "Floor division assignment", "%=": "Modulo assignment", "**=": "Exponentiation assignment",
  "if/else": "Conditional branch"
};
const OPERATOR_COUNT = CATEGORIES.reduce((count, category) => count + category.operators.length, 0);
const getStudentId = () => {
  let id = localStorage.getItem("oq_student_id");
  if (!id) { id = `student-${crypto.randomUUID()}`; localStorage.setItem("oq_student_id", id); }
  return id;
};
const sessionKey = (studentId, category, operator) => `oq_session_${studentId}_${category}_${encodeURIComponent(operator)}`;
const getSavedSession = (studentId, category, operator) => {
  try { return JSON.parse(localStorage.getItem(sessionKey(studentId, category, operator)) || "null"); }
  catch { return null; }
};

export default function App() {
  const studentId = useMemo(getStudentId, []);
  const [progress, setProgress] = useState({ totalXp: 0, categories: {} });
  const [active, setActive] = useState(null);
  const [activeOperator, setActiveOperator] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [correct, setCorrect] = useState(0);
  const [earned, setEarned] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [screen, setScreen] = useState("home");
  const [tutorQuestion, setTutorQuestion] = useState("");
  const [tutorAnswer, setTutorAnswer] = useState(null);
  const [tutorError, setTutorError] = useState("");
  const [tutorLoading, setTutorLoading] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);

  useEffect(() => { loadProgress(); }, []);
  async function loadProgress() {
    try {
      const res = await fetch(`${API}/progress/${studentId}`);
      if (!res.ok) throw new Error("Progress request failed");
      setProgress(await res.json());
    } catch { setError("Cannot connect to the backend. Start the server and check MongoDB."); }
  }
  const completedCount = CATEGORIES.filter(c => progress.categories?.[c.id]?.completed).length;
  const current = questions[index];

  async function askTutor(event) {
    event.preventDefault();
    setTutorLoading(true); setTutorAnswer(null); setTutorError("");
    try {
      const res = await fetch(`${API}/tutor/ask`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ studentId, question: tutorQuestion })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Tutor request failed.");
      setTutorAnswer(data);
    } catch (e) {
      setTutorError(e.message || "Unable to answer your question.");
    } finally { setTutorLoading(false); }
  }

  async function startCategory(category, operator, reset = false) {
    setError(""); setLoading(true); setActive(category); setScreen("quiz");
    setActiveOperator(operator);
    setQuestions([]); setIndex(0); setSelected(null); setCorrect(0); setEarned(0);
    try {
      const key = sessionKey(studentId, category, operator);
      if (!reset) {
        const session = getSavedSession(studentId, category, operator);
        if (session) {
          if (Array.isArray(session.questions) && session.questions.length === 10 && session.index < 10) {
            setQuestions(session.questions); setIndex(session.index); setSelected(session.selected ?? null);
            setCorrect(session.correct || 0); setEarned(session.earned || 0);
            setLoading(false);
            return;
          }
        }
      }
      if (reset) localStorage.removeItem(key);
      const resetRequest = reset ? fetch(`${API}/progress/reset-category`, {
          method:"POST", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({ studentId, category })
        }) : Promise.resolve();
      const questionsRequest = fetch(`${API}/questions/generate`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ category, operator })
      });
      const [, res] = await Promise.all([resetRequest, questionsRequest]);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Question generation failed.");
      setQuestions(data.questions);
      localStorage.setItem(key, JSON.stringify({ questions: data.questions, index: 0, selected: null, correct: 0, earned: 0 }));
    } catch (e) {
      setError(e.message || "Unable to generate questions.");
      setScreen("home");
    } finally { setLoading(false); }
  }

  async function chooseAnswer(optionIndex) {
    if (selected !== null || !current) return;
    setSelected(optionIndex);
    const isCorrect = optionIndex === current.answerIndex;
    const nextCorrect = correct + (isCorrect ? 1 : 0);
    const nextEarned = earned + (isCorrect ? 10 : 0);
    if (isCorrect) { setCorrect(nextCorrect); setEarned(nextEarned); }
    localStorage.setItem(sessionKey(studentId, active, activeOperator), JSON.stringify({ questions, index, selected: optionIndex, correct: nextCorrect, earned: nextEarned }));
    try {
      const res = await fetch(`${API}/progress/answer`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ studentId, category:active, isCorrect })
      });
      if (res.ok) {
        const data = await res.json();
        setProgress(p => ({ ...p, totalXp: data.totalXp, categories: {
          ...p.categories, [active]: data.categoryProgress
        }}));
      }
    } catch { setError("Answer saved locally for this session only; database connection failed."); }
  }

  async function nextQuestion() {
    if (index < 9) {
      const nextIndex = index + 1;
      setIndex(nextIndex); setSelected(null);
      localStorage.setItem(sessionKey(studentId, active, activeOperator), JSON.stringify({ questions, index: nextIndex, selected: null, correct, earned }));
    }
    else {
      try {
        await fetch(`${API}/progress/complete-category`, {
          method:"POST", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({ studentId, category:active })
        });
      } catch {}
      await loadProgress();
      localStorage.removeItem(sessionKey(studentId, active, activeOperator));
      setScreen("complete");
    }
  }

  function backHome() { setScreen("home"); setError(""); }
  const scoreNow = correct + (selected !== null && selected === current?.answerIndex ? 0 : 0);

  return <div className="shell">
    <header className="topbar">
      <button className="brand" onClick={backHome}><span className="brandIcon">⚡</span><span><b>Operator Quest</b><small>Flowchart learning arena</small></span></button>
      <div className="stats"><span>⭐ <b>{progress.totalXp || 0}</b> XP</span><span>🏆 <b>{completedCount}/5</b> categories</span></div>
    </header>

    {screen === "home" && <>
      <section className="hero">
        <div className="heroContent">
          <p className="eyebrow"><span className="liveDot"/> YOUR PERSONAL OPERATOR ARENA</p>
          <h1>Build clear logic.<br/><em>One flow at a time.</em></h1>
          <p>Learn how flowcharts make decisions and process information. Practise with familiar situations, follow each path, and build confidence step by step.</p>
          <div className="heroActions">
            <button className="heroCta" onClick={()=>document.getElementById("training")?.scrollIntoView({behavior:"smooth",block:"start"})}>Choose a challenge <span>↓</span></button>
          <button className="heroTutor" onClick={()=>setTutorOpen(true)}><span>✦</span> Ask the flowchart guide</button>
          </div>
          <div className="heroFacts"><span>✦ {CATEGORIES.length} learning tracks</span><i/><span>⌘ {OPERATOR_COUNT} flowchart symbols</span><i/><span>◷ 10 questions per run</span></div>
        </div>
        <aside className="heroSnapshot" aria-label="Your learning summary">
          <div className="snapshotTop"><span>YOUR QUEST</span><span className="snapshotSpark">✦</span></div>
          <div className="levelRing" style={{"--level-progress":`${completedCount * 20}%`}}><div><b>{completedCount * 20}%</b><small>mastered</small></div></div>
          <p>Every expert starts<br/>with one small step.</p>
          <div className="snapshotStats"><span><b>{progress.totalXp || 0}</b><small>total XP</small></span><i/><span><b>{completedCount}<small> / 5</small></b><small>tracks cleared</small></span></div>
        </aside>
      </section>
      <section className="journey"><div className="journeyHead"><div><b>Your learning journey</b><small>{completedCount} of 5 tracks completed <span className="journeyDetail">· Keep going at your own pace</span></small></div><strong>{completedCount * 20}%</strong></div><div className="track" role="progressbar" aria-label="Learning journey progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={completedCount * 20}><i style={{width:`${completedCount * 20}%`}}/></div></section>
      {error && <div className="error">{error}</div>}
      <div className="sectionTitle trainingTitle" id="training"><div><p className="eyebrow">PICK YOUR NEXT CHALLENGE</p><h2>Explore flowchart concepts</h2><p className="sectionSub">Choose a concept, pick a symbol, and trace what happens next.</p></div><span className="trackCount">{CATEGORIES.length} TRACKS <i/> {OPERATOR_COUNT} SYMBOLS</span></div>
      <section className="grid">{CATEGORIES.map((cat, categoryIndex) => {
        const p = progress.categories?.[cat.id] || {};
        return <article className="category" key={cat.id}>
          <div className="catHead"><span className="catIcon" style={{background:cat.tint}}>{cat.icon}</span><span className="catIndex">TRACK 0{categoryIndex + 1}</span></div>
          <h3>{cat.name}</h3><p>{cat.desc}</p>
          <div className="operatorCaption"><span>CHOOSE A SYMBOL</span><span>{cat.operators.length} {cat.operators.length === 1 ? "OPTION" : "OPTIONS"}</span></div>
          <div className="operatorList">
            {cat.operators.map(operator => {
              const session = getSavedSession(studentId, cat.id, operator);
              return <button key={operator} disabled={loading} title={`${operator}: ${OPERATOR_NAMES[operator]}`} onClick={()=>startCategory(cat.id, operator, !!p.completed && !session)}>
                <span className="operatorSymbol">{operator}</span><span className="operatorLabels"><span className="operatorName">{OPERATOR_NAMES[operator]}</span>{session && <small>Resume {session.index + 1}/10</small>}</span>
              </button>;
            })}
          </div>
          <div className="catFoot"><span className={p.completed?"trackComplete":"trackProgress"}>{p.completed?"✓ TRACK CLEARED":"↗ KEEP BUILDING"}</span><span>{p.correct || 0} correct <i/> {p.xp || 0} XP</span></div>
        </article>;
      })}</section>
    </>}

    {screen === "quiz" && <section className="quiz">
      <div className="quizNav"><button onClick={backHome}>← All categories</button><span>{CATEGORIES.find(c=>c.id===active)?.name?.toUpperCase()} · {activeOperator} · {OPERATOR_NAMES[activeOperator]}</span></div>
      {loading ? <div className="loading"><div className="spinner"/><h2>Gemini is creating your questions…</h2><p>Building 10 fresh challenges for this category.</p></div> :
      questions.length > 0 && current && <>
        <div className="quizMeta"><span>Question {index+1} of 10</span><span>⭐ {earned} XP this round</span></div>
        <div className="track thin"><i style={{width:`${index*10}%`}}/></div>
        <article className="questionCard"><div className="questionIcon">🧩</div><p className="eyebrow">CHALLENGE · {current.difficulty}</p><h2>{current.question}</h2>
          <div className="answers">{current.options.map((option,i)=><button key={i} disabled={selected!==null} className={`answer ${selected!==null && i===current.answerIndex?"correct":""} ${selected===i && i!==current.answerIndex?"wrong":""}`} onClick={()=>chooseAnswer(i)}><span>{String.fromCharCode(65+i)}</span>{option}</button>)}</div>
          {selected!==null && <div className={`feedback ${selected===current.answerIndex?"good":"bad"}`}><b>{selected===current.answerIndex?"Correct! +10 XP 🎉":"Not quite — keep learning!"}</b><p>{current.explanation}</p><small>Correct answer: {current.options[current.answerIndex]}</small></div>}
          {selected!==null && <button className="primary" onClick={nextQuestion}>{index===9?"See your results →":"Next question →"}</button>}
        </article>
      </>}
    </section>}

    {screen === "complete" && <section className="complete"><div className="trophy">🏆</div><p className="eyebrow">CATEGORY CLEARED</p><h2>{correct>=8?"Excellent work!":"Challenge completed!"}</h2>    <p>You finished all 10 {activeOperator} questions.</p><div className="resultStats"><div><b>{correct}/10</b><small>Correct answers</small></div><div><b>{earned}</b><small>XP earned</small></div></div><button className="primary" onClick={()=>startCategory(active,activeOperator,true)}>Generate a new question set ↻</button><button className="secondary" onClick={backHome}>Back to categories</button></section>}
    <button className={`chatLauncher ${tutorOpen ? "open" : ""}`} onClick={()=>setTutorOpen(open=>!open)} aria-label={tutorOpen ? "Close AI tutor" : "Ask your AI tutor"} title="Ask your AI tutor">💬</button>
    {tutorOpen && <aside className="chatPanel">
      <div className="chatHeader"><div><b>Flowchart Guide</b><small>Understand symbols, choices and paths</small></div><button onClick={()=>setTutorOpen(false)} aria-label="Close flowchart guide">×</button></div>
      <form onSubmit={askTutor} className="chatForm">
        <textarea value={tutorQuestion} onChange={e=>setTutorQuestion(e.target.value)} maxLength={1000} placeholder="Ask what a symbol means or why we use it in a flowchart..." required />
        <button className="primary" disabled={tutorLoading}>{tutorLoading ? "Thinking…" : "Send question"}</button>
      </form>
      {tutorError && <div className="chatError" role="alert">{tutorError}</div>}
      {tutorAnswer && <div className="chatResponse" role="status"><p>{tutorAnswer.explanation}</p></div>}
    </aside>}
    <footer><span>Operator Quest · Learn to think in flowcharts</span><span>Fresh practice questions ✨</span></footer>
  </div>;
}

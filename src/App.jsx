import { useEffect, useMemo, useState } from "react";

const API = "/api";
const CATEGORIES = [
  { id:"arithmetic", name:"Arithmetic", icon:"➗", tint:"#eeeaff", desc:"Calculate, divide and find remainders.", operators:["+","-","*","/","//","%","**"] },
  { id:"comparison", name:"Comparison", icon:"⚖️", tint:"#e7f7f2", desc:"Compare values and evaluate conditions.", operators:[">","<",">=","<=","==","!="] },
  { id:"logical", name:"Logical", icon:"🧩", tint:"#fff3df", desc:"Combine conditions with AND, OR and NOT.", operators:["AND","OR","NOT"] },
  { id:"assignment", name:"Assignment", icon:"📝", tint:"#eaf1ff", desc:"Store and update variable values.", operators:["=","+=","-=","*=","/=","//=","%=","**="] },
  { id:"ternary", name:"Ternary", icon:"🔀", tint:"#ffeaf1", desc:"Choose a value using a one-line condition.", operators:["if/else"] }
];
const getStudentId = () => {
  let id = localStorage.getItem("oq_student_id");
  if (!id) { id = `student-${crypto.randomUUID()}`; localStorage.setItem("oq_student_id", id); }
  return id;
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
    setTutorLoading(true); setTutorAnswer(null); setError("");
    try {
      const res = await fetch(`${API}/tutor/ask`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ studentId, question: tutorQuestion })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Tutor request failed.");
      setTutorAnswer(data);
    } catch (e) {
      setError(e.message || "Unable to answer your question.");
    } finally { setTutorLoading(false); }
  }

  async function startCategory(category, operator, reset = false) {
    setError(""); setLoading(true); setActive(category); setScreen("quiz");
    setActiveOperator(operator);
    setQuestions([]); setIndex(0); setSelected(null); setCorrect(0); setEarned(0);
    try {
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
    } catch (e) {
      setError(e.message || "Unable to generate questions.");
      setScreen("home");
    } finally { setLoading(false); }
  }

  async function chooseAnswer(optionIndex) {
    if (selected !== null || !current) return;
    setSelected(optionIndex);
    const isCorrect = optionIndex === current.answerIndex;
    if (isCorrect) { setCorrect(v => v + 1); setEarned(v => v + 10); }
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
    if (index < 9) { setIndex(v => v + 1); setSelected(null); }
    else {
      try {
        await fetch(`${API}/progress/complete-category`, {
          method:"POST", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({ studentId, category:active })
        });
      } catch {}
      await loadProgress();
      setScreen("complete");
    }
  }

  function backHome() { setScreen("home"); setActive(null); setActiveOperator(null); setQuestions([]); setError(""); }
  const scoreNow = correct + (selected !== null && selected === current?.answerIndex ? 0 : 0);

  return <div className="shell">
    <header className="topbar">
      <button className="brand" onClick={backHome}><span className="brandIcon">⚡</span><span><b>Operator Quest</b><small>AI-powered operator arena</small></span></button>
      <div className="stats"><span>⭐ <b>{progress.totalXp || 0}</b> XP</span><span>🏆 <b>{completedCount}/5</b> categories</span></div>
    </header>

    {screen === "home" && <>
      <section className="hero"><div><p className="eyebrow">THE OPERATOR ARENA · POWERED BY GEMINI</p><h1>Master every operator.<br/><em>One challenge at a time.</em></h1><p>Fresh AI-generated questions every time you play. Practise without writing code and learn from every answer.</p></div><div className="heroEmoji">🧠<span>✦</span>⚡</div></section>
      <section className="journey"><div className="journeyHead"><div><b>Your learning journey</b><small>{completedCount * 10} of 50 category questions completed</small></div><strong>{completedCount * 20}%</strong></div><div className="track"><i style={{width:`${completedCount * 20}%`}}/></div></section>
      {error && <div className="error">{error}</div>}
      <div className="sectionTitle"><div><p className="eyebrow">CHOOSE YOUR TRAINING</p><h2>Operator categories</h2></div><small>10 fresh questions per category</small></div>
      <section className="grid">{CATEGORIES.map(cat => {
        const p = progress.categories?.[cat.id] || {};
        return <article className="category" key={cat.id}>
          <div className="catHead"><span className="catIcon" style={{background:cat.tint}}>{cat.icon}</span><span className={p.completed?"done":"count"}>{p.completed?"✓ COMPLETED":"10 QUESTIONS"}</span></div>
          <h3>{cat.name}</h3><p>{cat.desc}</p>
          <div className="operatorList">
            {cat.operators.map(operator => <button key={operator} onClick={()=>startCategory(cat.id, operator, !!p.completed)}>{operator}</button>)}
          </div>
          <div className="catFoot"><span>{p.correct || 0} correct · {p.xp || 0} XP</span><small>10 questions per operator</small></div>
        </article>;
      })}</section>
    </>}

    {screen === "quiz" && <section className="quiz">
      <div className="quizNav"><button onClick={backHome}>← All categories</button><span>{CATEGORIES.find(c=>c.id===active)?.name?.toUpperCase()} · {activeOperator}</span></div>
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
      <div className="chatHeader"><div><b>AI Tutor</b><small>Ask a programming question</small></div><button onClick={()=>setTutorOpen(false)} aria-label="Close AI tutor">×</button></div>
      <form onSubmit={askTutor} className="chatForm">
        <textarea value={tutorQuestion} onChange={e=>setTutorQuestion(e.target.value)} maxLength={1000} placeholder="Ask me to explain an operator..." required />
        <button className="primary" disabled={tutorLoading}>{tutorLoading ? "Thinking…" : "Send question"}</button>
      </form>
      {tutorAnswer && <div className="chatResponse"><p>{tutorAnswer.explanation}</p><div className="tutorQuestions">{tutorAnswer.questions.map((item, i)=><div key={i}><b>{i + 1}. {item.question}</b><small>Answer: {item.answer}</small></div>)}</div></div>}
    </aside>}
    <footer><span>Operator Quest · Learn by playing</span><span>Fresh questions generated with Gemini ✨</span></footer>
  </div>;
}

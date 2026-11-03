import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowDownRight, ArrowLeft, ArrowRight, Check, ChevronRight, Crown, Heart, Medal, Sparkles, Trophy, Users } from 'lucide-react'
import { puzzles, type Puzzle } from './data/puzzles'
import { getAttempts, getSessionUid, getSolved, isCloudMode, loadPlayer, savePlayer, subscribePlayers, submitAnswer, type Player, type Team } from './lib/gameStore'
import TeamScene from './features/TeamScene'
import AdminPage from './features/AdminPage'
import FormattedText from './components/FormattedText'
import TreasureLetterPage from './features/TreasureLetterPage'
import { treasureClues } from './data/treasureClues'

function App() {
  const location = useLocation()
  const isTreasurePage = location.pathname.startsWith('/indice/')
  const treasureClue = treasureClues.find((entry) => entry.path === location.pathname)
  const [player, setPlayer] = useState<Player>()
  const [solved, setSolved] = useState<string[]>([])
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({})
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isTreasurePage) return
    let active = true
    let unsubscribePlayers: (() => void) | undefined
    getSessionUid().then(async (uid) => {
      if (!active) return
      unsubscribePlayers = subscribePlayers(setPlayers, (error) => {
        console.error('Impossible de synchroniser les joueurs avec Firestore :', error)
      })
      const [savedPlayer, solvedIds, savedAttempts] = await Promise.all([loadPlayer(uid), getSolved(uid), getAttempts(uid)])
      if (active) {
        setPlayer(savedPlayer)
        setSolved(solvedIds)
        setAttemptCounts(savedAttempts)
        setLoading(false)
      }
    }).catch(() => setLoading(false))
    return () => {
      active = false
      unsubscribePlayers?.()
    }
  }, [isTreasurePage])

  async function register(name: string, team: Team) {
    const uid = await getSessionUid()
    const next = { uid, name: name.trim(), team, score: 0 }
    await savePlayer(next)
    setPlayer(next)
    if (!isCloudMode) setPlayers((current) => [...current.filter((entry) => entry.uid !== next.uid), next])
  }

  async function solve(puzzle: Puzzle, answer: string) {
    if (!player) return { result: 'incorrect' as const }
    const result = await submitAnswer(player, puzzle, answer)
    if ('attempts' in result) {
      setAttemptCounts((current) => ({ ...current, [puzzle.id]: result.attempts }))
    }
    if (result.result === 'correct') {
      const updated = { ...player, score: player.score + result.points }
      setPlayer(updated)
      setSolved((current) => [...current, puzzle.id])
      if (!isCloudMode) setPlayers((current) => [...current.filter((entry) => entry.uid !== updated.uid), updated])
    }
    return result
  }

  if (isTreasurePage) return <TreasureLetterPage clue={treasureClue} />
  if (loading) return <div className="loading-screen"><span className="loading-mark"><Heart size={20} /></span><span>On prépare le jeu…</span></div>

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="wordmark" to={player ? '/' : '/'} aria-label="Accueil du jeu">
          <span className="wordmark-icon"><Heart size={16} fill="currentColor" /></span>
          <span>LES MARIÉS<span className="wordmark-sub">LE JEU</span></span>
        </Link>
        {player && <nav className="main-nav" aria-label="Navigation principale">
          <Link to="/">Le jeu</Link>
          <Link to="/classement">Classement</Link>
        </nav>}
        {player && <div className="player-chip"><span className={`team-dot team-${player.team}`} />{player.name}<span className="chip-score">{player.score} pts</span></div>}
      </header>
      <main>
        <Routes>
          <Route path="/" element={player ? <GameHome player={player} solved={solved} /> : <Registration onRegister={register} />} />
          <Route path="/enigme/:id" element={player ? <PuzzlePage solved={solved} attemptCounts={attemptCounts} onSolve={solve} /> : <Navigate to="/" replace />} />
          <Route path="/classement" element={player ? <Leaderboard players={players} player={player} /> : <Navigate to="/" replace />} />
          <Route path="/admin-2027" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="site-footer"><span>UNE HISTOIRE À RÉSOUDRE, À DEUX ÉQUIPES</span><span>FAIT AVEC <Heart size={11} fill="currentColor" /> POUR LE GRAND JOUR</span></footer>
    </div>
  )
}

function Registration({ onRegister }: { onRegister: (name: string, team: Team) => Promise<void> }) {
  const [name, setName] = useState('')
  const [team, setTeam] = useState<Team>()
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!team || !name.trim()) return
    setBusy(true)
    setSubmitError('')
    try {
      await onRegister(name, team)
      navigate('/')
    } catch {
      setSubmitError('Impossible de rejoindre le jeu. Vérifie ta connexion et la configuration Firestore, puis réessaie.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="register-layout page-enter">
    <div className="register-copy">
      <div className="eyebrow"><span className="eyebrow-line" /> LE GRAND JOUR, VERSION MYSTÈRE</div>
      <h1>Une histoire<br />à <em>résoudre.</em></h1>
      <p className="intro-copy">Des indices, des souvenirs et un peu d’esprit d’équipe. À vous de jouer.</p>
      <div className="count-note"><strong>{String(puzzles.length).padStart(2, '0')}</strong><span>énigmes<br />vous attendent</span><ArrowDownRight size={18} /></div>
    </div>
    <form className="join-panel" onSubmit={handleSubmit}>
      <div className="panel-topline"><span>VOTRE AVENTURE COMMENCE ICI</span><Sparkles size={16} /></div>
      <label className="field-label" htmlFor="guest-name">Votre prénom</label>
      <input id="guest-name" className="text-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex. Camille" maxLength={28} autoComplete="given-name" required />
      <div className="field-label team-label">Choisissez votre équipe</div>
      <TeamScene team={team} />
      <div className="team-choices">
        <button type="button" className={`team-choice groom ${team === 'marie' ? 'selected' : ''}`} onClick={() => setTeam('marie')} aria-pressed={team === 'marie'}>
          <span className="team-emblem"><Crown size={24} strokeWidth={1.5} /></span><span className="team-name">Team marié</span><span className="team-description">Soutenez Rémy !</span><span className="choice-check"><Check size={14} /></span>
        </button>
        <button type="button" className={`team-choice bride ${team === 'mariee' ? 'selected' : ''}`} onClick={() => setTeam('mariee')} aria-pressed={team === 'mariee'}>
          <span className="team-emblem"><Heart size={24} strokeWidth={1.5} /></span><span className="team-name">Team mariée</span><span className="team-description">Soutenez Karen !</span><span className="choice-check"><Check size={14} /></span>
        </button>
      </div>
      <button className="primary-button join-button" type="submit" disabled={!name.trim() || !team || busy}>{busy ? 'Un instant…' : <>Rejoindre le jeu <ArrowRight size={17} /></>}</button>
      {submitError && <p className="submit-error" role="alert">{submitError}</p>}
      <p className="form-footnote">Pas de mot de passe, juste votre prénom et votre flair.</p>
    </form>
    <div className="side-stamp" aria-hidden="true">N°<br /><strong>01</strong><span>ENQUÊTE</span></div>
  </section>
}

function GameHome({ player, solved }: { player: Player; solved: string[] }) {
  const completed = solved.length
  return <div className="content-wrap page-enter">
    <section className="welcome-row">
      <div><div className="eyebrow"><span className="eyebrow-line" /> BONJOUR {player.name.toLocaleUpperCase('fr')}</div><h1>À vous de <em>jouer.</em></h1><p className="intro-copy">Chaque énigme résolue rapproche votre équipe de la première place.</p></div>
      <div className="progress-seal"><span>VOTRE<br />AVANCÉE</span><strong>{String(completed).padStart(2, '0')}<i>/{String(puzzles.length).padStart(2, '0')}</i></strong><div className="seal-track"><span style={{ width: `${Math.min(100, completed / puzzles.length * 100)}%` }} /></div></div>
    </section>
    <section className="puzzle-section">
      <div className="section-heading"><div><span className="eyebrow">LE PARCOURS</span><h2>Les énigmes</h2></div><Link className="text-link" to="/classement">Voir le classement <ArrowRight size={15} /></Link></div>
      <div className="puzzle-grid">{puzzles.map((puzzle, index) => <PuzzleCard key={puzzle.id} puzzle={puzzle} index={index} solved={solved.includes(puzzle.id)} />)}</div>
    </section>
  </div>
}

function PuzzleCard({ puzzle, index, solved }: { puzzle: Puzzle; index: number; solved: boolean }) {
  return <Link to={`/enigme/${puzzle.id}`} className={`puzzle-card ${solved ? 'is-solved' : ''}`}>
    <div className="puzzle-card-top"><span className="puzzle-number">{String(index + 1).padStart(2, '0')}</span><span className={`puzzle-status ${solved ? 'done' : ''}`}>{solved ? <><Check size={12} /> RÉSOLUE</> : 'À DÉCOUVRIR'}</span></div>
    <div className="puzzle-card-art"><span className={`art-orbit orbit-${index % 3}`}><span className="art-core">{index === 0 ? <Heart size={29} /> : index === 1 ? <Sparkles size={29} /> : <span className="art-glyph">{['✳', '✦', '◇', '✧', '♡'][index]}</span>}</span></span><span className="art-caption">{puzzle.category}</span></div>
    <div className="puzzle-card-bottom"><div><span className="card-kicker">{puzzle.category}</span><h3>{puzzle.title}</h3></div><span className="circle-arrow"><ArrowRight size={17} /></span></div>
  </Link>
}

function PuzzlePage({ solved, attemptCounts, onSolve }: { solved: string[]; attemptCounts: Record<string, number>; onSolve: (puzzle: Puzzle, answer: string) => Promise<{ result: 'incorrect' | 'already' | 'exhausted' | 'correct'; points?: number; attempts?: number; remaining?: number }> }) {
  const { id } = useParams()
  const puzzle = puzzles.find((entry) => entry.id === id)
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'wrong' | 'correct' | 'already' | 'exhausted' | 'error'; text: string }>()
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    setAnswer('')
    setFeedback(undefined)
    setBusy(false)
  }, [id])

  if (!puzzle) return <Navigate to="/" replace />
  const activePuzzle = puzzle
  const wasSolved = solved.includes(activePuzzle.id)
  const attemptsUsed = attemptCounts[activePuzzle.id] ?? 0
  const maxAttempts = activePuzzle.maxAttempts ?? 3
  const attemptsExhausted = attemptsUsed >= maxAttempts && !wasSolved

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (wasSolved || attemptsExhausted || !answer.trim()) return
    setBusy(true)
    setFeedback(undefined)
    try {
      const result = await onSolve(activePuzzle, answer)
      if (result.result === 'correct') setFeedback({ type: 'correct', text: `Exact ! Votre équipe marque ${result.points} points.` })
      else if (result.result === 'already') setFeedback({ type: 'already', text: 'Cette énigme a déjà été validée sur votre compte.' })
      else if (result.result === 'exhausted') setFeedback({ type: 'exhausted', text: `Vous avez utilisé vos ${maxAttempts} ${maxAttempts > 1 ? 'tentatives' : 'tentative'} pour cette énigme.` })
      else setFeedback({ type: 'wrong', text: result.remaining === 0 ? 'Mauvaise réponse : vous avez utilisé votre dernière tentative.' : `Ce n’est pas encore ça. Il vous reste ${result.remaining} ${result.remaining === 1 ? 'tentative' : 'tentatives'}.` })
    } catch (error) {
      console.error('Erreur lors de l’enregistrement de la réponse :', error)
      setFeedback({ type: 'error', text: 'Le classement est indisponible. Vérifie que Firestore est activé dans le projet Firebase, puis réessaie.' })
    } finally {
      setBusy(false)
    }
  }

  return <div className="content-wrap page-enter puzzle-view">
    <Link className="back-link" to="/"><ArrowLeft size={15} /> Retour aux énigmes</Link>
    <div className="puzzle-detail-grid">
      <section className="puzzle-detail-main">
        <div className="eyebrow"><span className="eyebrow-line" /> {puzzle.category.toLocaleUpperCase('fr')}</div>
        <h1>{puzzle.title}<em>.</em></h1>
        {activePuzzle.image && <img className="puzzle-image" src={activePuzzle.image} alt="Illustration de l’énigme" />}
        {activePuzzle.images && <div className="puzzle-image-pair">{activePuzzle.images.map((image) => <figure className="puzzle-image-item" key={image.src}><img className="puzzle-image" src={image.src} alt={image.alt} /><figcaption>{image.caption}</figcaption></figure>)}</div>}
        <div className="riddle-paper"><span className="quote-mark">“</span><FormattedText text={activePuzzle.prompt} /><div className="paper-rule"><span /><Heart size={13} /><span /></div></div>
        <form className="answer-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="puzzle-answer">Votre réponse</label>
          <p className="attempts-note">{wasSolved ? 'Réponse validée' : `${attemptsUsed} / ${maxAttempts} ${maxAttempts > 1 ? 'tentatives utilisées' : 'tentative utilisée'}`}</p>
          <div className="answer-input-row"><input id="puzzle-answer" className="text-input" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={attemptsExhausted ? 'Tentatives épuisées' : 'Écrivez votre réponse…'} autoComplete="off" disabled={wasSolved || attemptsExhausted} /><button className="primary-button answer-submit" type="submit" disabled={wasSolved || attemptsExhausted || !answer.trim() || busy} aria-label="Valider la réponse">{busy ? '…' : <ArrowRight size={18} />}</button></div>
          {feedback && <div className={`feedback feedback-${feedback.type}`} role={feedback.type === 'error' || feedback.type === 'exhausted' ? 'alert' : 'status'}>{feedback.type === 'correct' ? <Check size={16} /> : <Sparkles size={16} />}{feedback.text}</div>}
          {wasSolved && !feedback && <div className="feedback feedback-already"><Check size={16} /> Énigme résolue, bravo !</div>}
          {attemptsExhausted && !feedback && <div className="feedback feedback-error" role="status">Vous avez utilisé toutes vos tentatives pour cette énigme.</div>}
        </form>
      </section>
      <aside className="puzzle-side">
        <div className="side-card side-card-highlight"><span className="side-index">{puzzle.id}</span><span className="side-label">UNE QUESTION<br />DE CŒUR</span><div className="side-heart"><Heart size={28} /></div></div>
        <div className="side-card score-card"><span className="card-kicker">VOTRE ÉQUIPE</span><h3>{solved.length} <small>/ {puzzles.length}</small></h3><span className="score-caption">énigmes résolues</span><Link to="/classement" className="text-link">Classement <ChevronRight size={14} /></Link></div>
      </aside>
    </div>
    <div className="puzzle-pagination"><span>{puzzles.findIndex((entry) => entry.id === puzzle.id) + 1} / {puzzles.length}</span><div>{puzzles.map((entry) => <span key={entry.id} className={entry.id === puzzle.id ? 'current' : solved.includes(entry.id) ? 'complete' : ''} />)}</div><button className="next-button" onClick={() => { const next = puzzles[puzzles.findIndex((entry) => entry.id === puzzle.id) + 1]; if (next) navigate(`/enigme/${next.id}`); else navigate('/') }} aria-label="Énigme suivante"><ArrowRight size={17} /></button></div>
  </div>
}

function Leaderboard({ players, player }: { players: Player[]; player: Player }) {
  const sortedPlayers = useMemo(() => [...players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr')), [players])
  const teams = useMemo(() => ([
    { key: 'marie' as Team, name: 'Team marié', score: players.filter((entry) => entry.team === 'marie').reduce((total, entry) => total + entry.score, 0), members: players.filter((entry) => entry.team === 'marie').length },
    { key: 'mariee' as Team, name: 'Team mariée', score: players.filter((entry) => entry.team === 'mariee').reduce((total, entry) => total + entry.score, 0), members: players.filter((entry) => entry.team === 'mariee').length },
  ].sort((a, b) => b.score - a.score)), [players])
  const rank = sortedPlayers.findIndex((entry) => entry.uid === player.uid) + 1
  const leadingTeam = teams[0].score > teams[1].score ? teams[0].key : undefined
  return <div className="content-wrap page-enter leaderboard-page">
    <div className="eyebrow"><span className="eyebrow-line" /> LES COMPTES SONT FAITS</div><h1>Le <em>classement.</em></h1><p className="intro-copy">Chaque bonne réponse fait grimper votre équipe.</p>
    <div className="leaderboard-couple"><TeamScene team={leadingTeam} /></div>
    <section className="team-scoreboard">
      <div className="scoreboard-heading"><div><span className="card-kicker">LA BATAILLE DES ÉQUIPES</span><h2>Qui mène la danse ?</h2></div><Users size={20} /></div>
      <div className="team-score-grid">{teams.map((team, index) => <div key={team.key} className={`team-score team-score-${team.key} ${index === 0 ? 'leading' : ''}`}><div className="team-score-head"><span className="team-dot" />{team.name}{index === 0 && <Crown size={15} />}</div><strong>{team.score}<small> pts</small></strong><div className="team-meter"><span style={{ width: `${Math.max(4, teams[0].score ? team.score / teams[0].score * 100 : 4)}%` }} /></div><span className="team-member-count">{team.members} {team.members === 1 ? 'joueur' : 'joueurs'}</span></div>)}</div>
    </section>
    <section className="individual-board">
      <div className="section-heading"><div><span className="card-kicker">LES JOUEURS</span><h2>Classement individuel</h2></div><span className="live-tag"><span /> EN DIRECT</span></div>
      {sortedPlayers.length === 0 ? <div className="empty-board"><Trophy size={22} /><span>Les premiers points ne vont pas tarder.</span></div> : <div className="ranking-list">{sortedPlayers.map((entry, index) => <div className={`ranking-row ${entry.uid === player.uid ? 'is-self' : ''}`} key={entry.uid}><span className={`rank-number ${index < 3 ? 'top-rank' : ''}`}>{index === 0 ? <Crown size={15} /> : String(index + 1).padStart(2, '0')}</span><span className={`rank-team-marker team-${entry.team}`} /><span className="rank-name">{entry.name}{entry.uid === player.uid && <small>VOUS</small>}</span><span className="rank-team-name">{entry.team === 'marie' ? 'Team marié' : 'Team mariée'}</span><strong className="rank-points">{entry.score}<small> pts</small></strong></div>)}</div>}
      {rank > 0 && <div className="your-rank"><Medal size={16} /> Votre place <strong>{String(rank).padStart(2, '0')}</strong></div>}
    </section>
  </div>
}

export default App
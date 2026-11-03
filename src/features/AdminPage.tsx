import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, Copy, KeyRound, RotateCcw, Trash2, Users } from 'lucide-react'
import { deletePlayer, isCloudMode, resetAllAttempts, resetEntireGame, resetPlayerAttempts, subscribePlayers, type Player } from '../lib/gameStore'
import { treasureClues } from '../data/treasureClues'

const ADMIN_PASSWORD = 'mariage-admin-2027'

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [urlBase, setUrlBase] = useState(window.location.origin)
  const [copiedPath, setCopiedPath] = useState('')
  const sortedPlayers = useMemo(() => [...players].sort((a, b) => a.name.localeCompare(b.name, 'fr')), [players])
  const normalizedUrlBase = urlBase.trim().replace(/\/+$/, '')

  useEffect(() => {
    if (!unlocked) return
    return subscribePlayers(setPlayers)
  }, [unlocked])

  function unlock(event: FormEvent) {
    event.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setUnlocked(true)
      setFeedback('')
    } else {
      setFeedback('Mot de passe incorrect.')
    }
  }

  async function handleDelete(player: Player) {
    if (!window.confirm(`Supprimer ${player.name} et toute sa progression ?`)) return
    setBusy(true)
    setFeedback('')
    try {
      await deletePlayer(player.uid)
      if (!isCloudMode) setPlayers((current) => current.filter((entry) => entry.uid !== player.uid))
      setFeedback(`${player.name} et sa progression ont été supprimés.`)
    } catch (error) {
      console.error('Erreur lors de la suppression du joueur :', error)
      setFeedback('La suppression a échoué. Vérifie les règles Firestore et réessaie.')
    } finally {
      setBusy(false)
    }
  }

  async function handleResetPlayerAttempts(player: Player) {
    if (!window.confirm(`Remettre à zéro toutes les tentatives de ${player.name} ? Ses scores et réponses déjà validées resteront inchangés.`)) return
    setBusy(true)
    setFeedback('')
    try {
      const resetCount = await resetPlayerAttempts(player.uid)
      setFeedback(`Tentatives de ${player.name} remises à zéro pour ${resetCount} progression(s).`)
    } catch (error) {
      console.error('Erreur lors de la remise à zéro des tentatives du joueur :', error)
      setFeedback(`La remise à zéro des tentatives de ${player.name} a échoué.`)
    } finally {
      setBusy(false)
    }
  }

  async function handleResetAttempts() {
    if (!window.confirm('Remettre à zéro les tentatives de tous les joueurs pour toutes les énigmes ? Les scores et réponses déjà validées resteront inchangés.')) return
    setBusy(true)
    setFeedback('')
    try {
      const resetCount = await resetAllAttempts()
      setFeedback(`Tentatives remises à zéro pour ${resetCount} progression(s).`)
    } catch (error) {
      console.error('Erreur lors de la remise à zéro des tentatives :', error)
      setFeedback('La remise à zéro a échoué. Vérifie les règles Firestore et réessaie.')
    } finally {
      setBusy(false)
    }
  }

  async function handleResetEntireGame() {
    const confirmed = window.prompt('Cette action supprimera les profils de jeu, scores, réponses et compteurs de rang. Les identifiants Firebase anonymes resteront. Tape REPARTIR pour confirmer.')
    if (confirmed !== 'REPARTIR') return
    setBusy(true)
    setFeedback('')
    try {
      const deletedPlayers = await resetEntireGame()
      if (!isCloudMode) setPlayers([])
      setFeedback(`Jeu réinitialisé : ${deletedPlayers} joueur(s) supprimé(s). Chaque énigme repartira à 100 points pour son premier gagnant.`)
    } catch (error) {
      console.error('Erreur lors de la réinitialisation complète du jeu :', error)
      setFeedback('La réinitialisation complète a échoué. Vérifie les règles Firestore et réessaie.')
    } finally {
      setBusy(false)
    }
  }

  async function copyTreasureUrl(path: string) {
    const url = `${normalizedUrlBase}${path}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedPath(path)
      window.setTimeout(() => setCopiedPath(''), 1800)
    } catch (error) {
      console.error('Impossible de copier l’URL :', error)
      window.prompt('Copie cette URL pour créer le QR code :', url)
    }
  }

  if (!unlocked) {
    return <section className="admin-gate page-enter">
      <form className="admin-login" onSubmit={unlock}>
        <span className="admin-icon"><KeyRound size={20} /></span>
        <span className="card-kicker">ACCÈS ORGANISATEUR</span>
        <h1>Administration</h1>
        <label className="field-label" htmlFor="admin-password">Mot de passe</label>
        <input id="admin-password" className="text-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
        <button className="primary-button admin-unlock" type="submit">Ouvrir l’administration</button>
        {feedback && <p className="submit-error" role="alert">{feedback}</p>}
      </form>
    </section>
  }

  return <section className="admin-page page-enter">
    <div className="admin-heading">
      <div><div className="eyebrow"><span className="eyebrow-line" /> ESPACE ORGANISATEUR</div><h1>Administration<em>.</em></h1></div>
      <span className="admin-count"><Users size={16} /> {players.length} joueurs</span>
    </div>
    <div className="admin-toolbar">
      <p>Les réponses validées et les scores ne seront pas modifiés par le reset des tentatives.</p>
      <button className="admin-reset-button" type="button" onClick={handleResetAttempts} disabled={busy}><RotateCcw size={15} /> Remettre toutes les tentatives à zéro</button>
    </div>
    <div className="admin-full-reset">
      <div><strong>Repartir d’une base propre</strong><p>Supprime tous les joueurs, leurs scores et leur progression. Les compteurs de rang seront aussi remis à zéro.</p></div>
      <button className="admin-full-reset-button" type="button" onClick={handleResetEntireGame} disabled={busy}><Trash2 size={15} /> Réinitialiser toute la partie</button>
    </div>
    <section className="admin-treasure-section">
      <div className="admin-treasure-heading">
        <div><span className="card-kicker">ÉNIGME 05</span><h2>QR codes de la chasse au trésor</h2></div>
        <span className="admin-treasure-count">5 lettres · BAGUE</span>
      </div>
      <label className="field-label" htmlFor="treasure-url-base">Domaine à utiliser pour les QR codes</label>
      <input id="treasure-url-base" className="text-input admin-url-base" value={urlBase} onChange={(event) => setUrlBase(event.target.value)} placeholder="https://votre-jeu.netlify.app" />
      <div className="admin-treasure-list">
        {treasureClues.map((clue) => {
          const url = `${normalizedUrlBase}${clue.path}`
          return <div className="admin-treasure-row" key={clue.path}>
            <span className="admin-treasure-index">0{clue.number}</span>
            <strong className="admin-treasure-letter">{clue.letter}</strong>
            <a className="admin-treasure-url" href={url} target="_blank" rel="noreferrer">{url}</a>
            <button className="admin-copy-button" type="button" onClick={() => copyTreasureUrl(clue.path)} aria-label={`Copier l'URL de la lettre ${clue.letter}`} title="Copier l’URL">
              {copiedPath === clue.path ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        })}
      </div>
      <p className="admin-treasure-note">Chaque lien affiche uniquement sa lettre et un retour au jeu. Génère un QR code par URL et place-les dans les cachettes.</p>
    </section>
    {feedback && <p className="admin-feedback" role="status">{feedback}</p>}
    <div className="admin-player-list">
      <div className="admin-list-header"><span>JOUEUR</span><span>ÉQUIPE</span><span>SCORE</span><span>ACTIONS</span></div>
      {sortedPlayers.length === 0 ? <p className="admin-empty">Aucun joueur inscrit pour le moment.</p> : sortedPlayers.map((player) => <div className="admin-player-row" key={player.uid}>
        <div className="admin-player-name"><strong>{player.name}</strong><small>{player.uid}</small></div>
        <span className={`admin-team admin-team-${player.team}`}>{player.team === 'marie' ? 'Team marié' : 'Team mariée'}</span>
        <strong className="admin-score">{player.score} pts</strong>
        <div className="admin-actions">
          <button className="admin-reset-player-button" type="button" onClick={() => handleResetPlayerAttempts(player)} disabled={busy} aria-label={`Réinitialiser les tentatives de ${player.name}`} title={`Réinitialiser les tentatives de ${player.name}`}><RotateCcw size={15} /></button>
          <button className="admin-delete-button" type="button" onClick={() => handleDelete(player)} disabled={busy} aria-label={`Supprimer ${player.name}`} title={`Supprimer ${player.name}`}><Trash2 size={16} /></button>
        </div>
      </div>)}
    </div>
</section>
}
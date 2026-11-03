import { Link } from 'react-router-dom'
import type { TreasureClue } from '../data/treasureClues'

export default function TreasureLetterPage({ clue }: { clue?: TreasureClue }) {
  return <main className="treasure-letter-page">
    {clue ? <>
      <strong className="treasure-letter">{clue.letter}</strong>
    </> : <>
      <span className="treasure-letter-kicker">INDICE INTROUVABLE</span>
      <strong className="treasure-letter treasure-letter-error">?</strong>
    </>}
    <Link to="/" className="treasure-back-link">Retour au jeu</Link>
  </main>
}
export const SYMBOLS = ['up', 'down', 'left', 'right', 'star', 'circle'] as const
export type DanceSymbol = typeof SYMBOLS[number]
export type Dancer = 'marie' | 'mariee'
export type DancePhase = 'ready' | 'showing' | 'input' | 'dancing' | 'mistake' | 'over'

export const GAME_DURATION = 180_000
export const SHOW_DURATION = 5_000
export const MISTAKE_DURATION = 1_000
export const MIN_LENGTH = 3
export const WINS_PER_LEVEL = 3

export type DanceGame = {
  phase: DancePhase
  sequence: DanceSymbol[]
  inputCount: number
  score: number
  length: number
  levelWins: number
  deadline: number
  phaseDeadline: number
  dancer: Dancer | null
  defeated: Dancer | null
  nextDancer: Dancer
  danceIndex: number
}

export function newGame(): DanceGame {
  return { phase: 'ready', sequence: [], inputCount: 0, score: 0, length: MIN_LENGTH, levelWins: 0, deadline: 0, phaseDeadline: 0, dancer: null, defeated: null, nextDancer: 'marie', danceIndex: 0 }
}

export function scoreMultiplier(length: number): number {
  return Math.max(1, length - MIN_LENGTH + 1)
}

export function randomSequence(length: number): DanceSymbol[] {
  return Array.from({ length }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)])
}

function beginRound(game: DanceGame, now: number): DanceGame {
  const levelComplete = game.phase === 'dancing' && game.levelWins >= WINS_PER_LEVEL
  const length = game.length + (levelComplete ? 1 : 0)
  return { ...game, phase: 'showing', length, levelWins: levelComplete ? 0 : game.levelWins, sequence: randomSequence(length), inputCount: 0, phaseDeadline: now + SHOW_DURATION, dancer: null }
}

export function startGame(now: number): DanceGame {
  return beginRound({ ...newGame(), deadline: now + GAME_DURATION }, now)
}

export function advanceGame(game: DanceGame, now: number): DanceGame {
  if (game.phase === 'ready' || game.phase === 'over') return game
  if (now >= game.deadline) return { ...game, phase: 'over', dancer: null, defeated: null }
  if (game.phase === 'showing' && now >= game.phaseDeadline) return { ...game, phase: 'input' }
  if (game.phase === 'mistake' && now >= game.phaseDeadline) return beginRound(game, now)
  return game
}

export function finishDance(current: DanceGame, dancer: Dancer, now: number): DanceGame {
  const game = advanceGame(current, now)
  return game.phase === 'dancing' && !game.defeated && game.dancer === dancer ? beginRound(game, now) : game
}

export function finishMistake(current: DanceGame, dancer: Dancer, now: number): DanceGame {
  const game = advanceGame(current, now)
  return game.defeated === dancer ? { ...game, defeated: null } : game
}

export function enterSymbol(current: DanceGame, symbol: DanceSymbol, now: number): DanceGame {
  const game = advanceGame(current, now)
  if (game.phase !== 'input') return game
  if (game.sequence[game.inputCount] !== symbol) {
    return { ...game, phase: 'mistake', length: Math.max(MIN_LENGTH, game.length - 1), levelWins: 0, phaseDeadline: now + MISTAKE_DURATION, defeated: game.nextDancer }
  }
  const inputCount = game.inputCount + 1
  if (inputCount < game.sequence.length) return { ...game, inputCount }
  return {
    ...game,
    phase: 'dancing',
    inputCount,
    score: game.score + game.sequence.length * scoreMultiplier(game.sequence.length),
    levelWins: game.levelWins + 1,
    phaseDeadline: 0,
    dancer: game.nextDancer,
    nextDancer: game.nextDancer === 'marie' ? 'mariee' : 'marie',
    danceIndex: Math.floor(Math.random() * 7),
  }
}
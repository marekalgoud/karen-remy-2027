import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { auth, db, firebaseEnabled } from './firebase'
import type { Puzzle } from '../data/puzzles'

export type Team = 'marie' | 'mariee'

export type Player = {
  uid: string
  name: string
  team: Team
  score: number
}

type LocalState = {
  player?: Player
  players: Player[]
  solved: string[]
  ranks: Record<string, number>
  attempts: Record<string, number>
}

const localKey = 'wedding-game-state-v1'

function readLocal(): LocalState {
  try {
    const stored = JSON.parse(localStorage.getItem(localKey) ?? '{}') as Partial<LocalState>
    return {
      player: stored.player,
      players: stored.players ?? [],
      solved: stored.solved ?? [],
      ranks: stored.ranks ?? {},
      attempts: stored.attempts ?? {},
    }
  } catch {
    return { players: [], solved: [], ranks: {}, attempts: {} }
  }
}

function writeLocal(state: LocalState) {
  localStorage.setItem(localKey, JSON.stringify(state))
}

export async function getSessionUid(): Promise<string> {
  if (auth) return waitForAuth()
  let uid = localStorage.getItem('wedding-game-uid')
  if (!uid) {
    uid = crypto.randomUUID()
    localStorage.setItem('wedding-game-uid', uid)
  }
  return uid
}

export async function waitForAuth(): Promise<string> {
  const currentAuth = auth
  if (!currentAuth) return getSessionUid()
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(currentAuth, async (user) => {
      unsubscribe()
      if (user) resolve(user.uid)
      else {
        try {
          resolve((await signInAnonymously(currentAuth)).user.uid)
        } catch (error) {
          reject(error)
        }
      }
    }, reject)
  })
}

export async function loadPlayer(uid: string): Promise<Player | undefined> {
  const firestore = db
  if (firestore) {
    const snapshot = await getDoc(doc(firestore, 'players', uid))
    return snapshot.exists() ? (snapshot.data() as Player) : undefined
  }
  const state = readLocal()
  return state.player?.uid === uid ? state.player : undefined
}

export async function savePlayer(player: Player): Promise<void> {
  const firestore = db
  if (firestore) {
    await setDoc(doc(firestore, 'players', player.uid), player, { merge: true })
    return
  }
  const state = readLocal()
  state.player = player
  state.players = [...state.players.filter((entry) => entry.uid !== player.uid), player]
  writeLocal(state)
}

export async function getSolved(uid: string): Promise<string[]> {
  const firestore = db
  if (firestore) {
    const snapshot = await getDocs(collection(firestore, 'players', uid, 'solved'))
    return snapshot.docs
      .filter((entry) => entry.data().solved === true || typeof entry.data().rank === 'number')
      .map((entry) => entry.id)
  }
  return readLocal().solved
}

export async function getAttempts(uid: string): Promise<Record<string, number>> {
  const firestore = db
  if (firestore) {
    const snapshot = await getDocs(collection(firestore, 'players', uid, 'solved'))
    return Object.fromEntries(snapshot.docs.map((entry) => [entry.id, entry.data().attempts ?? 0]))
  }
  return readLocal().attempts
}

export async function submitAnswer(player: Player, puzzle: Puzzle, answer: string) {
  const normalize = (value: string) => value.trim().toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const isCorrect = normalize(answer) === normalize(puzzle.answer)
  const maxAttempts = puzzle.maxAttempts ?? 3

  const firestore = db
  if (firestore) {
    return runTransaction(firestore, async (transaction) => {
      const playerRef = doc(firestore, 'players', player.uid)
      const solveRef = doc(firestore, 'players', player.uid, 'solved', puzzle.id)
      const counterRef = doc(firestore, 'puzzleCounters', puzzle.id)
      const solveSnapshot = await transaction.get(solveRef)
      const solveData = solveSnapshot.data()
      if (solveData?.solved === true || typeof solveData?.rank === 'number') return { result: 'already' as const }

      const attempts = solveData?.attempts ?? 0
      if (attempts >= maxAttempts) return { result: 'exhausted' as const, attempts }
      const nextAttempts = attempts + 1

      if (!isCorrect) {
        transaction.set(solveRef, { attempts: nextAttempts, solved: false, lastAttemptAt: Date.now() }, { merge: true })
        return { result: 'incorrect' as const, attempts: nextAttempts, remaining: maxAttempts - nextAttempts }
      }

      const [playerSnapshot, counterSnapshot] = await Promise.all([
        transaction.get(playerRef),
        transaction.get(counterRef),
      ])
      const rank = (counterSnapshot.data()?.count ?? 0) + 1
      const points = Math.max(0, 100 - (rank - 1) * 10)
      const current = playerSnapshot.exists() ? (playerSnapshot.data() as Player) : player
      transaction.set(counterRef, { count: rank }, { merge: true })
      transaction.set(solveRef, { rank, points, attempts: nextAttempts, solved: true, answeredAt: Date.now() }, { merge: true })
      transaction.set(playerRef, { ...current, score: (current.score ?? 0) + points }, { merge: true })
      return { result: 'correct' as const, points, attempts: nextAttempts }
    })
  }

  const state = readLocal()
  if (state.solved.includes(puzzle.id)) return { result: 'already' as const }
  const attempts = state.attempts[puzzle.id] ?? 0
  if (attempts >= maxAttempts) return { result: 'exhausted' as const, attempts }
  const nextAttempts = attempts + 1
  state.attempts[puzzle.id] = nextAttempts

  if (!isCorrect) {
    writeLocal(state)
    return { result: 'incorrect' as const, attempts: nextAttempts, remaining: maxAttempts - nextAttempts }
  }

  const rank = (state.ranks[puzzle.id] ?? 0) + 1
  const points = Math.max(0, 100 - (rank - 1) * 10)
  state.ranks[puzzle.id] = rank
  state.solved.push(puzzle.id)
  const updatedPlayer = { ...player, score: player.score + points }
  state.player = updatedPlayer
  state.players = [...state.players.filter((entry) => entry.uid !== player.uid), updatedPlayer]
  writeLocal(state)
  return { result: 'correct' as const, points, attempts: nextAttempts }
}

export function subscribePlayers(onUpdate: (players: Player[]) => void, onError?: (error: Error) => void): Unsubscribe {
  const firestore = db
  if (firestore) {
    return onSnapshot(
      collection(firestore, 'players'),
      (snapshot) => onUpdate(snapshot.docs.map((entry) => entry.data() as Player)),
      onError,
    )
  }
  onUpdate(readLocal().players)
  return () => undefined
}

export async function deletePlayer(playerId: string): Promise<void> {
  const firestore = db
  if (firestore) {
    const solvedSnapshot = await getDocs(collection(firestore, 'players', playerId, 'solved'))
    const batch = writeBatch(firestore)
    solvedSnapshot.docs.forEach((entry) => batch.delete(entry.ref))
    batch.delete(doc(firestore, 'players', playerId))
    await batch.commit()
    return
  }

  const state = readLocal()
  state.players = state.players.filter((entry) => entry.uid !== playerId)
  if (state.player?.uid === playerId) {
    state.player = undefined
    state.solved = []
    state.attempts = {}
  }
  writeLocal(state)
}

export async function resetPlayerAttempts(playerId: string): Promise<number> {
  const firestore = db
  if (firestore) {
    const progressSnapshot = await getDocs(collection(firestore, 'players', playerId, 'solved'))
    for (let index = 0; index < progressSnapshot.docs.length; index += 450) {
      const batch = writeBatch(firestore)
      progressSnapshot.docs.slice(index, index + 450).forEach((progressDoc) => batch.update(progressDoc.ref, { attempts: 0 }))
      await batch.commit()
    }
    return progressSnapshot.size
  }

  const state = readLocal()
  if (state.player?.uid !== playerId) return 0
  const resetCount = Object.keys(state.attempts).length
  state.attempts = {}
  writeLocal(state)
  return resetCount
}

export async function resetAllAttempts(): Promise<number> {
  const firestore = db
  if (firestore) {
    const playersSnapshot = await getDocs(collection(firestore, 'players'))
    const progressSnapshots = await Promise.all(playersSnapshot.docs.map((playerDoc) =>
      getDocs(collection(firestore, 'players', playerDoc.id, 'solved')),
    ))
    const progressDocs = progressSnapshots.flatMap((snapshot) => snapshot.docs)

    for (let index = 0; index < progressDocs.length; index += 450) {
      const batch = writeBatch(firestore)
      progressDocs.slice(index, index + 450).forEach((progressDoc) => batch.update(progressDoc.ref, { attempts: 0 }))
      await batch.commit()
    }
    return progressDocs.length
  }

  const state = readLocal()
  const resetCount = Object.keys(state.attempts).length
  state.attempts = {}
  writeLocal(state)
  return resetCount
}

export async function resetEntireGame(): Promise<number> {
  const firestore = db
  if (firestore) {
    const [playersSnapshot, countersSnapshot] = await Promise.all([
      getDocs(collection(firestore, 'players')),
      getDocs(collection(firestore, 'puzzleCounters')),
    ])
    const progressSnapshots = await Promise.all(playersSnapshot.docs.map((playerDoc) =>
      getDocs(collection(firestore, 'players', playerDoc.id, 'solved')),
    ))
    const refs = [
      ...progressSnapshots.flatMap((snapshot) => snapshot.docs.map((entry) => entry.ref)),
      ...playersSnapshot.docs.map((entry) => entry.ref),
      ...countersSnapshot.docs.map((entry) => entry.ref),
    ]

    for (let index = 0; index < refs.length; index += 450) {
      const batch = writeBatch(firestore)
      refs.slice(index, index + 450).forEach((reference) => batch.delete(reference))
      await batch.commit()
    }
    return playersSnapshot.size
  }

  const state = readLocal()
  const deletedPlayers = state.players.length
  state.player = undefined
  state.players = []
  state.solved = []
  state.ranks = {}
  state.attempts = {}
  writeLocal(state)
  return deletedPlayers
}

export const isCloudMode = firebaseEnabled
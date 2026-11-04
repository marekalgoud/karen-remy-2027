import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Clone, useAnimations, useFBX, useGLTF } from '@react-three/drei'
import { ArrowDown, ArrowLeft, ArrowUp, Crown, Heart, Play, RotateCcw } from 'lucide-react'
import { Box3, CanvasTexture, LoopOnce, LoopRepeat, RepeatWrapping, SRGBColorSpace, Vector3, type AnimationAction, type AnimationClip, type Group, type Mesh } from 'three'
import type { Team } from '../lib/gameStore'

type RunnerAction = 'run' | 'jump' | 'roll' | 'falling'
type GameStatus = 'ready' | 'running' | 'over'
type ObstacleKind = 'ground' | 'air'
type AnimatedGroup = Group & { animations: AnimationClip[] }
type ObstacleData = { id: number; kind: ObstacleKind }
type SceneryData = { id: number; x: number; variant: number }

const PLAYER_X = -2.4
const FLOOR_Y = -1.4
const MODEL_SCALE = 0.016

const runnerAssets: Record<Team, { run: string; jump: string; roll: string; fall: string }> = {
  marie: {
    run: '/models/game/groom-run.fbx',
    jump: '/models/game/groom-jump.fbx',
    roll: '/models/game/groom-roll.fbx',
    fall: '/models/game/groom-fall.fbx',
  },
  mariee: {
    run: '/models/game/bride-run.fbx',
    jump: '/models/game/bride-jump.fbx',
    roll: '/models/game/bride-roll.fbx',
    fall: '/models/game/bride-falling.fbx',
  },
}

function RunnerCharacter({ team, action, onActionFinished }: { team: Team; action: RunnerAction; onActionFinished: (action: RunnerAction) => void }) {
  const assets = runnerAssets[team]
  const model = useFBX(assets.run) as AnimatedGroup
  const jumpAnimation = useFBX(assets.jump) as AnimatedGroup
  const rollAnimation = useFBX(assets.roll) as AnimatedGroup
  const fallAnimation = useFBX(assets.fall) as AnimatedGroup
  const modelBottom = useMemo(() => new Box3().setFromObject(model).min.y, [model])
  const characterRef = useRef<Group>(null)
  const jumpElapsed = useRef(0)
  const clips = useMemo(() => {
    const runClip = model.animations[0]?.clone()
    const jumpClip = jumpAnimation.animations[0]?.clone()
    const rollClip = rollAnimation.animations[0]?.clone()
    const fallClip = fallAnimation.animations[0]?.clone()
    if (runClip) runClip.name = 'run'
    if (jumpClip) jumpClip.name = 'jump'
    if (rollClip) rollClip.name = 'roll'
    if (fallClip) fallClip.name = 'falling'
    return [runClip, jumpClip, rollClip, fallClip].filter((clip): clip is AnimationClip => Boolean(clip))
  }, [fallAnimation, jumpAnimation, model, rollAnimation])
  const { actions, mixer } = useAnimations(clips, model)
  const currentAction = useRef<AnimationAction | null>(null)

  useEffect(() => {
    const nextAction = actions[action]
    if (!nextAction) return

    const previousAction = currentAction.current
    nextAction.reset()
    nextAction.setLoop(action === 'run' ? LoopRepeat : LoopOnce, action === 'run' ? Infinity : 1)
    nextAction.clampWhenFinished = action !== 'run'
    nextAction.play()
    if (previousAction && previousAction !== nextAction) {
      previousAction.crossFadeTo(nextAction, 0.18, false)
    } else {
      nextAction.fadeIn(0.18)
    }
    currentAction.current = nextAction
  }, [action, actions])

  useEffect(() => {
    const handleFinished = (event: { action: AnimationAction }) => {
      const finishedAction = Object.entries(actions).find(([, candidate]) => candidate === event.action)?.[0]
      if (finishedAction === 'jump' || finishedAction === 'roll') onActionFinished(finishedAction)
    }
    mixer.addEventListener('finished', handleFinished)
    return () => mixer.removeEventListener('finished', handleFinished)
  }, [actions, mixer, onActionFinished])

  useEffect(() => {
    model.traverse((object) => {
      const mesh = object as Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
  }, [model])

  const footOffset = FLOOR_Y - MODEL_SCALE * modelBottom

  useEffect(() => {
    if (action === 'jump') jumpElapsed.current = 0
  }, [action])

  useFrame((_, delta) => {
    const character = characterRef.current
    if (!character) return
    if (action === 'jump') {
      jumpElapsed.current += delta
      const duration = Math.max(actions.jump?.getClip().duration ?? 0.9, 0.1)
      const progress = Math.min(jumpElapsed.current / duration, 1)
      character.position.y = footOffset + Math.sin(progress * Math.PI) * 1.25
    } else {
      character.position.y = footOffset
    }
  })

  return <group ref={characterRef} position={[PLAYER_X, footOffset, 0]} rotation={[0, Math.PI / 2, 0]} scale={MODEL_SCALE}>
    <primitive object={model} />
  </group>
}

function Obstacle({ obstacle, running, speed, action, onAvoided, onExit, onCollision }: {
  obstacle: ObstacleData
  running: boolean
  speed: number
  action: RunnerAction
  onAvoided: () => void
  onExit: (id: number) => void
  onCollision: () => void
}) {
  const obstacleRef = useRef<Group>(null)
  const scored = useRef(false)
  const obstacleY = obstacle.kind === 'ground' ? FLOOR_Y : FLOOR_Y + 1.65

  useFrame((_, delta) => {
    const mesh = obstacleRef.current
    if (!mesh || !running) return

    mesh.rotation.set(0, 0, 0)
    mesh.position.x -= speed * delta
    const distance = mesh.position.x - PLAYER_X
    if (!scored.current && Math.abs(distance) < 0.55) {
      scored.current = true
      const avoided = obstacle.kind === 'ground' ? action === 'jump' : action === 'roll'
      if (avoided) onAvoided()
      else onCollision()
    }
    if (mesh.position.x < -10) {
      onExit(obstacle.id)
    }
  })

  return <group ref={obstacleRef} position={[9, obstacleY, 0]}>
    <ObstacleModel kind={obstacle.kind} />
  </group>
}

function ObstacleModel({ kind }: { kind: ObstacleKind }) {
  const isPlane = kind === 'air'
  const { scene } = useGLTF(isPlane ? '/models/game/paper-plane.glb' : '/models/game/cake.glb')
  const modelBounds = useMemo(() => new Box3().setFromObject(scene), [scene])
  const modelSize = useMemo(() => modelBounds.getSize(new Vector3()), [modelBounds])
  const modelCenter = useMemo(() => modelBounds.getCenter(new Vector3()), [modelBounds])
  const modelOffset = useRef<Group>(null)
  const maxDimension = Math.max(modelSize.x, modelSize.y, modelSize.z, 0.001)
  const targetSize = isPlane ? 1.6 : 1.7
  const modelScale = targetSize / maxDimension

  useEffect(() => {
    scene.traverse((object) => {
      const mesh = object as Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
  }, [scene])

  useFrame((state) => {
    if (isPlane && modelOffset.current) {
      modelOffset.current.traverse((object) => {
        if (object !== modelOffset.current) object.rotation.set(0, 0, 0)
      })
      modelOffset.current.position.y = Math.sin(state.clock.elapsedTime * 4) * 0.12
      modelOffset.current.rotation.z = Math.sin(state.clock.elapsedTime * 2.6) * 0.075
    }
  })

  return <group ref={modelOffset}>
    <Clone object={scene} scale={modelScale} rotation={[0, 0, 0]} position={[-modelCenter.x * modelScale, -modelBounds.min.y * modelScale, -modelCenter.z * modelScale]} />
  </group>
}

function ParallaxLayer({ asset, count, y, z, spacing, speed, size, tint, running = true }: {
  asset: string
  count: number
  y: number
  z: number
  spacing: number
  speed: number
  size: number
  tint?: string
  running?: boolean
}) {
  const { scene } = useGLTF(asset)
  const modelBounds = useMemo(() => new Box3().setFromObject(scene), [scene])
  const modelSize = useMemo(() => modelBounds.getSize(new Vector3()), [modelBounds])
  const modelCenter = useMemo(() => modelBounds.getCenter(new Vector3()), [modelBounds])
  const maxDimension = Math.max(modelSize.x, modelSize.y, modelSize.z, 0.001)
  const modelScale = size / maxDimension
  const refs = useRef<(Group | null)[]>([])
  const scenery = useMemo<SceneryData[]>(() => Array.from({ length: count }, (_, index) => ({
    id: index,
    x: -((count - 1) * spacing) / 2 + index * spacing,
    variant: index,
  })), [count, spacing])

  useEffect(() => {
    scene.traverse((object) => {
      const mesh = object as Mesh
      if (mesh.isMesh) {
        mesh.castShadow = false
        mesh.receiveShadow = false
      }
    })
  }, [scene])

  useFrame((_, delta) => {
    if (!running) return
    for (const group of refs.current) {
      if (!group) continue
      group.position.x -= speed * delta
      const rightEdge = ((count - 1) * spacing) / 2 + spacing
      if (group.position.x < -rightEdge) group.position.x += count * spacing
    }
  })

  return <>
    {scenery.map((item) => <group
      key={item.id}
      ref={(group) => { refs.current[item.id] = group }}
      position={[item.x, y + (asset.includes('cloud') ? (item.variant % 2) * 0.42 : 0), z]}
      scale={modelScale * (asset.includes('cloud') && item.variant % 2 === 1 ? 0.78 : 1)}
      rotation={[0, asset.includes('cloud') ? 0 : (item.variant % 3 - 1) * 0.045, 0]}
    >
      <Clone object={scene} position={[-modelCenter.x, -modelBounds.min.y, -modelCenter.z]} tint={tint} />
    </group>)}
  </>
}

function GrassMaterial() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const context = canvas.getContext('2d')
    if (!context) return null

    context.fillStyle = '#72a85a'
    context.fillRect(0, 0, canvas.width, canvas.height)
    for (let index = 0; index < 1500; index += 1) {
      const x = Math.random() * canvas.width
      const y = Math.random() * canvas.height
      const height = 3 + Math.random() * 9
      const hue = 83 + Math.random() * 25
      const lightness = 28 + Math.random() * 20
      context.strokeStyle = `hsla(${hue}, 38%, ${lightness}%, ${0.22 + Math.random() * 0.4})`
      context.lineWidth = 0.6 + Math.random() * 1.2
      context.beginPath()
      context.moveTo(x, y)
      context.lineTo(x + (Math.random() - 0.5) * 3, y - height)
      context.stroke()
    }

    const grassTexture = new CanvasTexture(canvas)
    grassTexture.wrapS = RepeatWrapping
    grassTexture.wrapT = RepeatWrapping
    grassTexture.repeat.set(32, 7)
    grassTexture.colorSpace = SRGBColorSpace
    grassTexture.needsUpdate = true
    return grassTexture
  }, [])

  useEffect(() => () => texture?.dispose(), [texture])

  if (!texture) return <meshStandardMaterial color="#72a85a" roughness={0.96} />
  return <meshStandardMaterial map={texture} color="#e0edc9" roughness={0.96} />
}

function RunnerWorld({ team, status, action, score, onAvoided, onCollision, onReady, onActionFinished }: {
  team: Team
  status: GameStatus
  action: RunnerAction
  score: number
  onAvoided: () => void
  onCollision: () => void
  onReady: () => void
  onActionFinished: (action: RunnerAction) => void
}) {
  const [obstacles, setObstacles] = useState<ObstacleData[]>([])
  const spawnTimer = useRef(0)
  const nextId = useRef(0)
  const speed = 5 + Math.min(score * 0.16, 7)

  useEffect(() => {
    setObstacles([])
    spawnTimer.current = 0
  }, [status === 'running'])

  useFrame((_, delta) => {
    if (status !== 'running') return
    spawnTimer.current -= delta
    if (spawnTimer.current <= 0) {
      const id = nextId.current++
      const kind = Math.random() > 0.5 ? 'ground' : 'air'
      setObstacles((current) => [...current, { id, kind }])
      spawnTimer.current = Math.max(0.78, 1.7 - score * 0.012) + Math.random() * 0.45
    }
  })

  const removeObstacle = useCallback((id: number) => {
    setObstacles((current) => current.filter((obstacle) => obstacle.id !== id))
  }, [])

  const handleExit = useCallback((id: number) => {
    removeObstacle(id)
  }, [removeObstacle])

  const handleCollision = useCallback(() => {
    setObstacles([])
    onCollision()
  }, [onCollision])

  return <>
    <ambientLight intensity={0.7} />
    <hemisphereLight args={['#d9f0ff', '#456d3e', 1.1]} />
    <directionalLight position={[-3, 7, 5]} intensity={2.2} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
    <ParallaxLayer asset="/models/game/cloud-1.glb" count={5} y={2.8} z={-4.2} spacing={5.5} speed={0.32} size={3.1} />
    <ParallaxLayer asset="/models/game/forest.glb" count={6} y={FLOOR_Y + 0.05} z={-5.2} spacing={4.5} speed={0.3} size={5.3} running={status === 'running'} />
    <mesh position={[0, FLOOR_Y - 0.08, 0]} receiveShadow>
      <boxGeometry args={[80, 0.16, 12]} />
      <GrassMaterial />
    </mesh>
    <RunnerCharacter key={team} team={team} action={action} onActionFinished={onActionFinished} />
    {obstacles.map((obstacle) => <Obstacle key={obstacle.id} obstacle={obstacle} running={status === 'running'} speed={speed} action={action} onAvoided={onAvoided} onExit={handleExit} onCollision={handleCollision} />)}
    <ReadySignal status={status} onReady={onReady} />
  </>
}

useGLTF.preload('/models/game/forest.glb')
useGLTF.preload('/models/game/cloud-1.glb')

function ReadySignal({ status, onReady }: { status: GameStatus; onReady: () => void }) {
  useEffect(() => {
    if (status === 'ready') onReady()
  }, [onReady, status])
  return null
}

export default function RunnerGame({ initialTeam, bestScore, onBestScore }: { initialTeam: Team; bestScore: number; onBestScore: (score: number) => Promise<number> }) {
  const [team, setTeam] = useState<Team>(initialTeam)
  const [status, setStatus] = useState<GameStatus>('ready')
  const [action, setAction] = useState<RunnerAction>('run')
  const [score, setScore] = useState(0)
  const [savedBest, setSavedBest] = useState(bestScore)
  const [saving, setSaving] = useState(false)
  const [ready, setReady] = useState(false)
  const scoreRef = useRef(0)

  useEffect(() => setSavedBest(bestScore), [bestScore])

  const finishRun = useCallback(async () => {
    setStatus('over')
    setAction('falling')
    if (scoreRef.current <= savedBest) return
    setSaving(true)
    try {
      const nextBest = await onBestScore(scoreRef.current)
      setSavedBest(nextBest)
    } catch (error) {
      console.error('Impossible d’enregistrer le record du runner :', error)
      setSavedBest((current) => Math.max(current, scoreRef.current))
    } finally {
      setSaving(false)
    }
  }, [onBestScore, savedBest])

  const handlePassed = useCallback(() => {
    scoreRef.current += 1
    setScore(scoreRef.current)
  }, [])

  const startRun = useCallback(() => {
    scoreRef.current = 0
    setScore(0)
    setAction('run')
    setStatus('running')
  }, [])

  function chooseTeam(nextTeam: Team) {
    if (status === 'running' || team === nextTeam) return
    setTeam(nextTeam)
    setAction('run')
    setStatus('ready')
  }

  const performAction = useCallback((nextAction: 'jump' | 'roll') => {
    if (status !== 'running' || action !== 'run') return
    setAction(nextAction)
  }, [action, status])

  const handleActionFinished = useCallback((finishedAction: RunnerAction) => {
    if (finishedAction === 'jump' || finishedAction === 'roll') {
      setAction('run')
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code === 'ArrowUp' || event.code === 'Space') {
        event.preventDefault()
        performAction('jump')
      } else if (event.code === 'ArrowDown') {
        event.preventDefault()
        performAction('roll')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [performAction])

  return <section className="runner-page page-enter">
    <div className="runner-heading"><span className="eyebrow"><span className="eyebrow-line" /> JEU BONUS</span><h1>La course des mariés<em>.</em></h1><p>Saute les obstacles au sol, roule sous ceux qui volent. Chaque obstacle évité ajoute un point.</p></div>
    <div className="runner-team-choice" aria-label="Choisir le personnage">
      <button type="button" className={`runner-team-button groom ${team === 'marie' ? 'selected' : ''}`} onClick={() => chooseTeam('marie')} disabled={status === 'running'} aria-pressed={team === 'marie'}>
        <Crown size={18} /><span>Le marié</span>
      </button>
      <button type="button" className={`runner-team-button bride ${team === 'mariee' ? 'selected' : ''}`} onClick={() => chooseTeam('mariee')} disabled={status === 'running'} aria-pressed={team === 'mariee'}>
        <Heart size={18} /><span>La mariée</span>
      </button>
    </div>
    <div className="runner-scoreboard"><div><span>SCORE</span><strong>{score}</strong></div><div><span>RECORD</span><strong>{Math.max(savedBest, score)}</strong></div></div>
    <div className="runner-scene">
      <Canvas camera={{ position: [0, 2.2, 11], fov: 34 }} onCreated={({ camera }) => camera.lookAt(0, 1.35, 0)} shadows dpr={[1, 1.5]}>
        <Suspense fallback={null}>
          <RunnerWorld team={team} status={status} action={action} score={score} onAvoided={handlePassed} onCollision={finishRun} onReady={() => setReady(true)} onActionFinished={handleActionFinished} />
        </Suspense>
      </Canvas>
      {!ready && <div className="runner-overlay"><span className="scene-loading-spinner" /><strong>Chargement du personnage…</strong></div>}
      {ready && status !== 'running' && <div className="runner-overlay">
        <strong>{status === 'over' ? 'Course terminée' : 'Prête à courir ?'}</strong>
        {status === 'over' && <span>{score} obstacle{score === 1 ? '' : 's'} évité{score === 1 ? '' : 's'}{score > bestScore ? ' · Nouveau record !' : ''}</span>}
        <button className="primary-button runner-start-button" type="button" onClick={startRun}><Play size={16} /> {status === 'over' ? 'Rejouer' : 'Lancer la course'}</button>
      </div>}
    </div>
    <div className="runner-controls" aria-label="Commandes de jeu">
      <button type="button" className="runner-control-button" onPointerDown={(event) => { event.preventDefault(); performAction('jump') }} disabled={status !== 'running'} aria-label="Sauter"><ArrowUp size={23} /><span>Sauter</span></button>
      <button type="button" className="runner-control-button runner-roll-button" onPointerDown={(event) => { event.preventDefault(); performAction('roll') }} disabled={status !== 'running'} aria-label="Roulade"><ArrowDown size={23} /><span>Roulade</span></button>
    </div>
    {saving && <p className="runner-saving" role="status">Enregistrement du record…</p>}
    <p className="runner-note">Le meilleur score est ajouté une seule fois à votre total de points. Les parties suivantes améliorent le record sans compter deux fois les mêmes points.</p>
  </section>
}
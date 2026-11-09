import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { Clone, useAnimations, useFBX, useGLTF } from '@react-three/drei'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Circle, Music2, Play, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Box3, CanvasTexture, DoubleSide, LoopOnce, LoopRepeat, Object3D, SRGBColorSpace, Vector3, type AnimationAction, type AnimationClip, type Group, type Mesh, type SpotLight } from 'three'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { animatedModelBounds } from '../lib/animatedModelBounds'
import DiscoLights from './DiscoLights'
import { advanceGame, enterSymbol, finishDance, finishMistake, newGame, scoreMultiplier, startGame, WINS_PER_LEVEL, type Dancer, type DanceSymbol } from './danceBattleLogic'

type AnimatedGroup = Group & { animations: AnimationClip[] }

const assets: Record<Dancer, { model: string; idle: string; clapping: string; defeated: string; victory: string; dances: string[] }> = {
  marie: {
    model: '/models/groom/groom.glb', idle: '/models/groom/groom-idle.fbx',
    clapping: '/models/groom/groom-clapping.fbx',
    defeated: '/models/groom/groom-defeat.fbx',
    victory: '/models/groom/groom-victory.fbx',
    dances: ['chicken-dance', 'dancing-twerk', 'gangnam-style', 'locking-hip-hop-dance', 'macarena-dance', 'salsa-dance', 'twist-dance'].map((name) => `/models/groom/dance/groom-${name}.fbx`),
  },
  mariee: {
    model: '/models/bride/bride.glb', idle: '/models/bride/bride-idle.fbx',
    clapping: '/models/bride/bride-clapping.fbx',
    defeated: '/models/bride/bride-defeated.fbx',
    victory: '/models/bride/bride-victory.fbx',
    dances: ['belly-dance', 'hip-hop-dancing', 'house-dancing', 'robot-hip-hop-dance', 'break-dance', 'salsa-dancing', 'samba-dancing'].map((name) => `/models/bride/dance/bride-${name}.fbx`),
  },
}

const controls = [
  { symbol: 'left', label: 'Gauche', Icon: ArrowLeft },
  { symbol: 'up', label: 'Haut', Icon: ArrowUp },
  { symbol: 'down', label: 'Bas', Icon: ArrowDown },
  { symbol: 'right', label: 'Droite', Icon: ArrowRight },
  { symbol: 'star', label: 'Étoile', Icon: Star },
  { symbol: 'circle', label: 'Rond', Icon: Circle },
] as const

function Character({ team, dancer, defeated, victory, danceIndex, onDanceFinished, onDefeatFinished }: { team: Dancer; dancer: Dancer | null; defeated: Dancer | null; victory: boolean; danceIndex: number; onDanceFinished: (team: Dancer) => void; onDefeatFinished: (team: Dancer) => void }) {
  const { scene } = useGLTF(assets[team].model)
  const idle = useFBX(assets[team].idle) as AnimatedGroup
  const clapping = useFBX(assets[team].clapping) as AnimatedGroup
  const defeat = useFBX(assets[team].defeated) as AnimatedGroup
  const celebration = useFBX(assets[team].victory) as AnimatedGroup
  const dances = useLoader(FBXLoader, assets[team].dances) as AnimatedGroup[]
  scene.rotation.x = -Math.PI / 2
  const [bottom] = useState(() => (idle.animations[0] ? animatedModelBounds(scene, idle.animations[0]) : new Box3().setFromObject(scene)).min.y)
  const clips = useMemo(() => [idle, clapping, defeat, celebration, ...dances].flatMap((asset, index) => {
    const clip = asset.animations[0]?.clone()
    if (!clip) return []
    clip.name = index === 0 ? 'idle' : index === 1 ? 'clapping' : index === 2 ? 'defeated' : index === 3 ? 'victory' : `dance-${index - 4}`
    return [clip]
  }), [idle, clapping, defeat, celebration, dances])
  const { actions, mixer } = useAnimations(clips, scene)
  const currentAction = useRef<AnimationAction | null>(null)

  useLayoutEffect(() => {
    const meshes: { mesh: Mesh; castShadow: boolean }[] = []
    scene.traverse((object) => {
      const mesh = object as Mesh
      if (mesh.isMesh) {
        meshes.push({ mesh, castShadow: mesh.castShadow })
        mesh.castShadow = true
      }
    })
    return () => { meshes.forEach(({ mesh, castShadow }) => { mesh.castShadow = castShadow }) }
  }, [scene])

  useLayoutEffect(() => () => { currentAction.current = null }, [clips])

  useLayoutEffect(() => {
    function handleFinished(event: { action: AnimationAction }) {
      if (event.action !== currentAction.current) return
      if (defeated === team && event.action === actions.defeated) onDefeatFinished(team)
      else if (dancer === team) onDanceFinished(team)
    }
    mixer.addEventListener('finished', handleFinished)
    return () => mixer.removeEventListener('finished', handleFinished)
  }, [actions, dancer, defeated, mixer, onDanceFinished, onDefeatFinished, team])

  useLayoutEffect(() => {
    const name = victory ? 'victory' : defeated === team ? 'defeated' : dancer === team ? `dance-${danceIndex % assets[team].dances.length}` : dancer ? 'clapping' : 'idle'
    const action = actions[name]
    if (!action || (action === currentAction.current && (action.isRunning() || action.paused))) return
    action.reset()
    action.setEffectiveTimeScale(1).setEffectiveWeight(1)
    if (name.startsWith('dance-') || name === 'defeated') {
      action.setLoop(LoopOnce, 1)
      action.clampWhenFinished = true
    } else if (name === 'victory') {
      action.setLoop(LoopRepeat, Infinity)
      action.clampWhenFinished = false
    }
    action.play()
    if (currentAction.current && currentAction.current !== action) currentAction.current.crossFadeTo(action, 0.2, false)
    currentAction.current = action
    mixer.update(0)
  }, [actions, dancer, defeated, victory, danceIndex, mixer, team])

  useEffect(() => {
    const action = currentAction.current
    if (!action || action.isRunning() || action.paused) return
    action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play()
    mixer.update(0)
  }, [actions, dancer, defeated, victory, danceIndex, mixer])

  return <group position={[team === 'marie' ? -1.15 : 1.15, -1.4 - bottom * 1.6, 0]} rotation={[0, team === 'marie' ? 0.65 : -0.65, 0]} scale={1.6}>
    <primitive object={scene} />
  </group>
}

function Characters({ dancer, defeated, victory, danceIndex, onReady, onDanceFinished, onDefeatFinished }: { dancer: Dancer | null; defeated: Dancer | null; victory: boolean; danceIndex: number; onReady: () => void; onDanceFinished: (team: Dancer) => void; onDefeatFinished: (team: Dancer) => void }) {
  useEffect(() => { onReady() }, [onReady])
  return <>
    <Character team="marie" dancer={dancer} defeated={defeated} victory={victory} danceIndex={danceIndex} onDanceFinished={onDanceFinished} onDefeatFinished={onDefeatFinished} />
    <Character team="mariee" dancer={dancer} defeated={defeated} victory={victory} danceIndex={danceIndex} onDanceFinished={onDanceFinished} onDefeatFinished={onDefeatFinished} />
  </>
}

function LightBeam({ light, target, color }: { light: RefObject<SpotLight | null>; target: Object3D; color: string }) {
  const beam = useRef<Group>(null)
  const direction = useRef(new Vector3())
  const up = useMemo(() => new Vector3(0, 1, 0), [])

  useFrame(() => {
    if (!beam.current || !light.current) return
    direction.current.copy(light.current.position).sub(target.position)
    const length = direction.current.length()
    beam.current.position.copy(light.current.position).add(target.position).multiplyScalar(0.5)
    beam.current.quaternion.setFromUnitVectors(up, direction.current.normalize())
    beam.current.scale.set(length, length, length)
  })

  return <group ref={beam}>
    <mesh>
      <coneGeometry args={[0.35, 1, 24, 1, true]} />
      <meshBasicMaterial color={color} transparent opacity={0.045} depthWrite={false} side={DoubleSide} toneMapped={false} />
    </mesh>
  </group>
}

function DanceFloor() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const context = canvas.getContext('2d')
    if (!context) return null
    const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128)
    gradient.addColorStop(0, '#ffffff')
    gradient.addColorStop(0.18, '#ffffff')
    gradient.addColorStop(0.62, '#000000')
    gradient.addColorStop(1, '#000000')
    context.fillStyle = gradient
    context.fillRect(0, 0, canvas.width, canvas.height)
    return new CanvasTexture(canvas)
  }, [])

  const floorColor = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 2
    const context = canvas.getContext('2d')
    if (!context) return null
    const gradient = context.createLinearGradient(0, 0, canvas.width, 0)
    gradient.addColorStop(0.25, '#82bde7')
    gradient.addColorStop(0.5, '#d5cae0')
    gradient.addColorStop(0.75, '#eba1c4')
    context.fillStyle = gradient
    context.fillRect(0, 0, canvas.width, canvas.height)
    const colorTexture = new CanvasTexture(canvas)
    colorTexture.colorSpace = SRGBColorSpace
    return colorTexture
  }, [])

  useEffect(() => () => texture?.dispose(), [texture])
  useEffect(() => () => floorColor?.dispose(), [floorColor])

  return <mesh position={[0, -1.4, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
    <planeGeometry args={[20, 20]} />
    <meshStandardMaterial color="#fffefa" map={floorColor ?? undefined} emissive="#ffffff" emissiveMap={floorColor ?? undefined} emissiveIntensity={0.3} roughness={0.9} metalness={0} transparent alphaMap={texture ?? undefined} depthWrite={false} />
  </mesh>
}

function Speakers() {
  const { scene } = useGLTF('/models/game/speaker.glb')
  const bounds = useMemo(() => new Box3().setFromObject(scene), [scene])
  const size = useMemo(() => bounds.getSize(new Vector3()), [bounds])
  const center = useMemo(() => bounds.getCenter(new Vector3()), [bounds])
  const scale = 1.35 / Math.max(size.y, 0.001)
  const speakers = useRef<(Group | null)[]>([])
  const movement = useRef({
    beat: -1,
    height: 0.06,
    speakers: [{ tilt: 1, turn: 1 }, { tilt: -1, turn: -1 }],
  })

  useFrame(({ clock }) => {
    const beatPosition = clock.elapsedTime / 0.62
    const beat = Math.floor(beatPosition)
    if (movement.current.beat !== beat) {
      movement.current.beat = beat
      movement.current.height = 0.055 + Math.random() * 0.02
      movement.current.speakers.forEach((motion, index) => {
        const direction = (beat + index) % 2 === 0 ? 1 : -1
        motion.tilt = direction * (0.65 + Math.random() * 0.35)
        motion.turn = -direction * (0.5 + Math.random() * 0.5)
      })
    }
    const bounce = Math.sin(Math.PI * Math.min((beatPosition - beat) / 0.55, 1))
    speakers.current.forEach((speaker, index) => {
      if (!speaker) return
      const motion = movement.current.speakers[index]
      const tilt = bounce * motion.tilt * 0.11
      speaker.rotation.z = tilt
      speaker.rotation.y = -Math.PI / 2 - (index === 1 ? Math.PI / 9 : 0) + bounce * motion.turn * 0.16
      speaker.position.y = -1.4 + bounce * movement.current.height + Math.abs(Math.sin(tilt)) * Math.hypot(size.x, size.z) * scale / 2
    })
  })

  return <>
    {[-2.35, 2.35].map((x, index) => <group key={x} ref={(speaker) => { speakers.current[index] = speaker }} position={[x, -1.4, -1.25]} rotation={[0, -Math.PI / 2 - (x > 0 ? Math.PI / 9 : 0), 0]} scale={scale}>
      <Clone object={scene} position={[-center.x, -bounds.min.y, -center.z]} receiveShadow />
      <mesh position={[0, size.y / 2, 0]} castShadow>
        <boxGeometry args={[size.x * 0.85, size.y, size.z * 0.85]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
    </group>)}
  </>
}

function DanceStage() {
  const leftTarget = useRef(new Object3D())
  const rightTarget = useRef(new Object3D())
  const leftSpot = useRef<SpotLight>(null)
  const rightSpot = useRef<SpotLight>(null)

  useFrame(({ clock }) => {
    const time = clock.elapsedTime
    leftTarget.current.position.set(Math.sin(time * 0.65) * 0.45, -1.35, Math.cos(time * 0.48) * 0.45)
    rightTarget.current.position.set(1.4 + Math.sin(time * 0.55 + 1.5) * 1.5, -1.35, Math.sin(time * 0.42) * 1.1)
    leftSpot.current?.position.set(-2.2 + Math.sin(time * 0.42) * 1.8, 4.5, 1.5 + Math.cos(time * 0.38) * 1.2)
    rightSpot.current?.position.set(3.2 + Math.sin(time * 0.35 + 1) * 1.2, 4.5, -0.5 + Math.cos(time * 0.3) * 0.8)
  })

  return <>
    <ambientLight color="#d8e6de" intensity={0.16} />
    <hemisphereLight args={['#e1f4ef', '#332e2a', 0.24]} />
    <directionalLight position={[-2, 5, 4]} color="#fff1dc" intensity={0.45} />
    <primitive object={leftTarget.current} />
    <primitive object={rightTarget.current} />
    <spotLight ref={leftSpot} position={[-2.2, 4.5, 1.5]} target={leftTarget.current} color="#a4cde8" intensity={30} angle={0.78} penumbra={0.65} distance={14} castShadow shadow-mapSize-width={512} shadow-mapSize-height={512} shadow-camera-near={0.5} shadow-camera-far={14} shadow-bias={-0.0003} shadow-normalBias={0.02} />
    <spotLight ref={rightSpot} position={[3.2, 4.5, -0.5]} target={rightTarget.current} color="#efa5bc" intensity={25} angle={0.55} penumbra={0.7} distance={14} />
    <LightBeam light={leftSpot} target={leftTarget.current} color="#9ec5e2" />
    <LightBeam light={rightSpot} target={rightTarget.current} color="#e9a1bd" />
    <pointLight position={[0, 2.4, -1.5]} color="#f6c477" intensity={4.5} distance={8} />
    <DanceFloor />
    <Suspense fallback={null}><Speakers /></Suspense>
    <DiscoLights />
  </>
}

function DanceCamera({ dancer }: { dancer: Dancer | null }) {
  const { camera, size } = useThree()
  const position = useRef(new Vector3())
  const target = useRef(new Vector3(0, 0.15, 0))
  const nextTarget = useRef(new Vector3())

  useFrame((_, delta) => {
    const focusX = dancer === 'marie' ? -0.65 : dancer === 'mariee' ? 0.65 : 0
    const aspect = size.width / Math.max(size.height, 1)
    const distance = Math.max(dancer ? 6.8 : 7.4, 8 / aspect)
    const smoothness = 1 - Math.exp(-Math.min(delta, 0.1) * 2)
    position.current.set(focusX * 0.7, 1.5, distance)
    nextTarget.current.set(focusX, 0.15, 0)
    camera.position.lerp(position.current, smoothness)
    target.current.lerp(nextTarget.current, smoothness)
    camera.lookAt(target.current)
  })

  return null
}

function SymbolIcon({ symbol, size = 22 }: { symbol: DanceSymbol; size?: number }) {
  const Icon = controls.find((control) => control.symbol === symbol)?.Icon ?? Circle
  return <Icon size={size} strokeWidth={2} />
}

export default function DanceBattle({ bestScore, onBestScore }: { bestScore: number; onBestScore: (score: number) => Promise<number> }) {
  const [game, setGame] = useState(newGame)
  const [now, setNow] = useState(Date.now())
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [savedBest, setSavedBest] = useState(bestScore)
  const attemptedSave = useRef(false)
  const savingRef = useRef(false)
  const markReady = useCallback(() => setReady(true), [])
  const handleDanceFinished = useCallback((dancer: Dancer) => {
    setGame((current) => finishDance(current, dancer, Date.now()))
  }, [])
  const handleDefeatFinished = useCallback((dancer: Dancer) => {
    setGame((current) => finishMistake(current, dancer, Date.now()))
  }, [])

  useEffect(() => setSavedBest(bestScore), [bestScore])

  const saveRecord = useCallback(async (score: number) => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setSaveError(false)
    try {
      setSavedBest(await onBestScore(score))
    } catch (error) {
      console.error('Impossible d’enregistrer le record de Dance Battle :', error)
      setSaveError(true)
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [onBestScore])

  useEffect(() => {
    if (game.phase !== 'over' || game.score <= savedBest || attemptedSave.current) return
    attemptedSave.current = true
    void saveRecord(game.score)
  }, [game.phase, game.score, savedBest, saveRecord])

  useEffect(() => {
    if (game.phase === 'ready' || game.phase === 'over') return
    const timer = window.setInterval(() => {
      const time = Date.now()
      setNow(time)
      setGame((current) => advanceGame(current, time))
    }, 100)
    return () => window.clearInterval(timer)
  }, [game.phase])

  const playSymbol = useCallback((symbol: DanceSymbol) => {
    setGame((current) => enterSymbol(current, symbol, Date.now()))
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
      const keys: Record<string, DanceSymbol> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyA: 'star', KeyS: 'circle' }
      const symbol = keys[event.code]
      if (!symbol) return
      event.preventDefault()
      playSymbol(symbol)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [playSymbol])

  function start() {
    if (saving) return
    attemptedSave.current = false
    setSaveError(false)
    const time = Date.now()
    setNow(time)
    setGame(startGame(time))
  }

  const seconds = game.phase === 'ready' ? 180 : game.phase === 'over' ? 0 : Math.max(0, Math.ceil((game.deadline - now) / 1000))
  const timeLabel = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  const showSequence = game.phase === 'showing' && now < game.phaseDeadline
  const status = game.phase === 'showing' ? 'Mémorise la suite' : game.phase === 'input' ? 'À toi de jouer !' : game.phase === 'dancing' ? `Bien joué ! +${game.sequence.length * scoreMultiplier(game.sequence.length)} points` : game.phase === 'mistake' ? 'Raté ! On réessaie.' : game.phase === 'over' ? 'Partie terminée' : 'Prêts à danser ?'

  return <section className="dance-page page-enter">
    <Link className="back-link" to="/"><ArrowLeft size={15} /> Retour aux jeux</Link>
    <div className="dance-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> JEU BONUS</span><h1>Dance battle<em>.</em></h1></div><Music2 size={26} /></div>
    <div className="dance-scoreboard"><div><span>SCORE</span><strong>{game.score}</strong></div><div><span>TEMPS</span><strong>{timeLabel}</strong></div><div><span>SUITE</span><strong>{game.length}</strong></div></div>
    <div className="dance-level"><span>RÉUSSITES <strong>{game.levelWins} / {WINS_PER_LEVEL}</strong></span><span>MULTIPLICATEUR <strong>×{scoreMultiplier(game.length)}</strong></span></div>
    <div className="dance-stage" aria-label="Les mariés sur la piste de danse">
      <Canvas camera={{ position: [0, 1.5, 7.4], fov: 36 }} onCreated={({ camera }) => camera.lookAt(new Vector3(0, 0.15, 0))} dpr={[1, 1.5]} shadows>
        <DanceStage />
        <DanceCamera dancer={game.dancer ?? game.defeated} />
        <Suspense fallback={null}><Characters dancer={game.defeated ? null : game.dancer} defeated={game.defeated} victory={game.phase === 'over'} danceIndex={game.danceIndex} onReady={markReady} onDanceFinished={handleDanceFinished} onDefeatFinished={handleDefeatFinished} /></Suspense>
      </Canvas>
      {!ready && <div className="dance-stage-loading" role="status"><span className="scene-loading-spinner" /> Chargement des mariés…</div>}
      <div className="dance-stage-labels"><span>RÉMY</span><span>KAREN</span></div>
    </div>
    <div className="dance-play-area">
      <div className="dance-status" role="status" aria-live="polite">{status}</div>
      {(game.phase === 'ready' || game.phase === 'over') ? <div className="dance-start">
        {game.phase === 'over' && <p>{game.score} points</p>}
        {game.phase === 'over' && <p>Record : {savedBest} points</p>}
        {saving && <p role="status">Enregistrement du record…</p>}
        {saveError && <p className="submit-error" role="alert">Impossible d’enregistrer le record. <button type="button" onClick={() => void saveRecord(game.score)}>Réessayer</button></p>}
        <button className="primary-button dance-start-button" type="button" disabled={!ready || saving} onClick={start}><Play size={16} /> {game.phase === 'over' ? 'Rejouer' : 'Commencer'}</button>
      </div> : <div className="dance-sequence" aria-label={showSequence ? 'Suite à mémoriser' : `Progression : ${game.inputCount} sur ${game.sequence.length}`}>
        {game.sequence.map((symbol, index) => <span className={`dance-symbol ${index < game.inputCount ? 'is-entered' : ''}`} key={index} role="img" aria-label={showSequence || index < game.inputCount ? controls.find((control) => control.symbol === symbol)?.label : 'À trouver'}>{showSequence ? <SymbolIcon symbol={symbol} /> : index < game.inputCount ? <SymbolIcon symbol={symbol} /> : <span className="dance-symbol-dot" />}</span>)}
      </div>}
      <div className="dance-controls" aria-label="Commandes de danse">{controls.map(({ symbol, label, Icon }) => <button key={symbol} type="button" aria-label={label} title={label} disabled={game.phase !== 'input'} onClick={() => playSymbol(symbol)}><Icon size={24} /></button>)}</div>
    </div>
  </section>
}
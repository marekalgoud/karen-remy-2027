import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Clone, useAnimations, useFBX, useGLTF } from '@react-three/drei'
import { ArrowDown, ArrowUp, Crown, Heart, Play } from 'lucide-react'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { AmbientLight, Box3, CanvasTexture, Color, DirectionalLight, FogExp2, HemisphereLight, LoopOnce, LoopRepeat, RepeatWrapping, SRGBColorSpace, Vector3, type AnimationAction, type AnimationClip, type Group, type Mesh } from 'three'
import type { Team } from '../lib/gameStore'
import { animatedModelBounds } from '../lib/animatedModelBounds'

type RunnerAction = 'run' | 'jump' | 'roll' | 'falling'
type GameStatus = 'ready' | 'running' | 'crashing' | 'over'
type ObstacleKind = 'ground' | 'air'
type AnimatedGroup = Group & { animations: AnimationClip[] }
type ObstacleData = { id: number; kind: ObstacleKind }
type SceneryData = { id: number; x: number; variant: number }
type PlayerCollider = { halfWidth: number; bottom: number; top: number }
type ObstacleCollider = { halfWidth: number; height: number }

const PLAYER_X = -2.4
const FLOOR_Y = -1.4
const ROLL_COLLIDER_HEIGHT = 1.3
const CAKE_COLLIDER_HEIGHT_RATIO = 0.35
const PLAYER_COLLIDER_WIDTH_RATIO = 0.4
const OBSTACLE_COLLIDER_WIDTH_RATIO = 0.4
const PLANE_FLOAT_AMPLITUDE = 0.12
const JUMP_HEIGHT = 1.55
const JUMP_DURATION_SCALE = 1.25

const RUNNER_LIGHT_PHASES = [
  { ambient: '#e7f2df', ambientIntensity: 0.4, sky: '#c5e1b8', ground: '#456844', hemisphereIntensity: 0.58, sunlight: '#e4efb2', sunlightIntensity: 0.9, background: '#a9cda9', fogDensity: 0.04, sunPosition: [-2, 4.5, 5] },
  { ambient: '#fff7d6', ambientIntensity: 0.44, sky: '#ffe79b', ground: '#70643c', hemisphereIntensity: 0.66, sunlight: '#ffdc6b', sunlightIntensity: 1.2, background: '#e8d078', fogDensity: 0.045, sunPosition: [-3, 7, 5] },
  { ambient: '#f8d9dc', ambientIntensity: 0.36, sky: '#efa4b2', ground: '#563744', hemisphereIntensity: 0.5, sunlight: '#ffadb0', sunlightIntensity: 0.72, background: '#d47788', fogDensity: 0.065, sunPosition: [-1, 3.8, 5] },
  { ambient: '#c4d2d7', ambientIntensity: 0.24, sky: '#73909b', ground: '#26363a', hemisphereIntensity: 0.4, sunlight: '#a8c1cc', sunlightIntensity: 0.48, background: '#263b45', fogDensity: 0.08, sunPosition: [1, 5, 5] },
] as const

const runnerAssets: Record<Team, { run: string; jump: string; roll: string; fall: string }> = {
  marie: {
    run: '/models/groom/groom-run.fbx',
    jump: '/models/groom/groom-jump.fbx',
    roll: '/models/groom/groom-roll.fbx',
    fall: '/models/groom/groom-fall.fbx',
  },
  mariee: {
    run: '/models/bride/bride-run.fbx',
    jump: '/models/bride/bride-jump.fbx',
    roll: '/models/bride/bride-roll.fbx',
    fall: '/models/bride/bride-fall.fbx',
  },
}

export function preloadRunnerCharacter(team: Team): void {
  const assets = runnerAssets[team]
  useGLTF.preload(team === 'marie' ? '/models/groom/groom.glb' : '/models/bride/bride.glb')
  useFBX.preload(assets.run)
  useFBX.preload(assets.jump)
  useFBX.preload(assets.roll)
  useFBX.preload(assets.fall)
}

type RunnerCharacterProps = { team: Team; action: RunnerAction; collider: { current: PlayerCollider }; onActionFinished: (action: RunnerAction) => void }

function RunnerCharacter(props: RunnerCharacterProps) {
  return props.team === 'marie' ? <GroomRunnerCharacter {...props} /> : <BrideRunnerCharacter {...props} />
}

function GroomRunnerCharacter(props: RunnerCharacterProps) {
  const { scene } = useGLTF('/models/groom/groom.glb')
  const runAnimation = useFBX(runnerAssets.marie.run) as AnimatedGroup
  scene.rotation.x = -Math.PI / 2
  return <AnimatedRunnerCharacter {...props} model={scene} runAnimation={runAnimation} modelScale={1.6} />
}

function BrideRunnerCharacter(props: RunnerCharacterProps) {
  const { scene } = useGLTF('/models/bride/bride.glb')
  const runAnimation = useFBX(runnerAssets.mariee.run) as AnimatedGroup
  scene.rotation.x = -Math.PI / 2
  return <AnimatedRunnerCharacter {...props} model={scene} runAnimation={runAnimation} modelScale={1.6} />
}

function AnimatedRunnerCharacter({ team, action, collider, onActionFinished, model, runAnimation, modelScale }: RunnerCharacterProps & { model: Group; runAnimation: AnimatedGroup; modelScale: number }) {
  const assets = runnerAssets[team]
  const jumpAnimation = useFBX(assets.jump) as AnimatedGroup
  const rollAnimation = useFBX(assets.roll) as AnimatedGroup
  const fallAnimation = useFBX(assets.fall) as AnimatedGroup
  const modelBounds = useMemo(() => runAnimation.animations[0]
    ? animatedModelBounds(model, runAnimation.animations[0])
    : new Box3().setFromObject(model), [model, runAnimation, team])
  const modelBottom = modelBounds.min.y
  const modelSize = useMemo(() => modelBounds.getSize(new Vector3()), [modelBounds])
  const characterRef = useRef<Group>(null)
  const jumpElapsed = useRef(0)
  const clips = useMemo(() => {
    const runClip = runAnimation.animations[0]?.clone()
    const jumpClip = jumpAnimation.animations[0]?.clone()
    const rollClip = rollAnimation.animations[0]?.clone()
    const fallClip = fallAnimation.animations[0]?.clone()
    if (runClip) runClip.name = 'run'
    if (jumpClip) jumpClip.name = 'jump'
    if (rollClip) rollClip.name = 'roll'
    if (fallClip) fallClip.name = 'falling'
    return [runClip, jumpClip, rollClip, fallClip].filter((clip): clip is AnimationClip => Boolean(clip))
  }, [fallAnimation, jumpAnimation, runAnimation, rollAnimation])
  const { actions, mixer } = useAnimations(clips, model)
  const currentAction = useRef<AnimationAction | null>(null)

  useEffect(() => {
    const preparedActions = [actions.run, actions.jump, actions.roll, actions.falling].filter((candidate): candidate is AnimationAction => Boolean(candidate))
    preparedActions.forEach((candidate) => candidate.play().setEffectiveWeight(0))
    mixer.update(0)
    preparedActions.forEach((candidate) => candidate.setEffectiveWeight(1))
    preparedActions.forEach((candidate) => candidate.stop())
  }, [actions, mixer])

  useEffect(() => {
    const nextAction = actions[action]
    if (!nextAction) {
      if (action === 'falling') {
        currentAction.current?.stop()
        currentAction.current = null
      }
      return
    }

    const previousAction = currentAction.current
    nextAction.reset()
    nextAction.setLoop(action === 'run' ? LoopRepeat : LoopOnce, action === 'run' ? Infinity : 1)
    nextAction.setEffectiveTimeScale(action === 'jump' ? 1 / JUMP_DURATION_SCALE : 1)
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

  const footOffset = FLOOR_Y - modelScale * modelBottom

  useEffect(() => {
    if (action === 'jump') jumpElapsed.current = 0
  }, [action])

  useFrame((_, delta) => {
    const character = characterRef.current
    if (!character) return
    if (action === 'jump') {
      jumpElapsed.current += delta
      const duration = Math.max((actions.jump?.getClip().duration ?? 0.9) * JUMP_DURATION_SCALE, 0.1)
      const progress = Math.min(jumpElapsed.current / duration, 1)
      character.position.y = footOffset + Math.sin(progress * Math.PI) * JUMP_HEIGHT
    } else {
      character.position.y = footOffset
    }
    const bottom = character.position.y + modelScale * modelBottom
    collider.current.halfWidth = Math.max(modelSize.x, modelSize.z) * modelScale * PLAYER_COLLIDER_WIDTH_RATIO
    collider.current.bottom = bottom
    collider.current.top = bottom + Math.min(modelSize.y * modelScale, action === 'roll' ? ROLL_COLLIDER_HEIGHT : Infinity)
  })

  return <group ref={characterRef} position={[PLAYER_X, footOffset, 0]} rotation={[0, Math.PI / 2, 0]} scale={modelScale}>
    <primitive object={model} />
  </group>
}

function Obstacle({ obstacle, running, speed, action, playerCollider, onAvoided, onExit, onCollision }: {
  obstacle: ObstacleData
  running: boolean
  speed: number
  action: RunnerAction
  playerCollider: { current: PlayerCollider }
  onAvoided: () => void
  onExit: (id: number) => void
  onCollision: () => void
}) {
  const obstacleRef = useRef<Group>(null)
  const scored = useRef(false)
  const overlapping = useRef(false)
  const obstacleY = obstacle.kind === 'ground' ? FLOOR_Y : FLOOR_Y + 1.65
  const colliderDimensions = useRef<ObstacleCollider>({ halfWidth: 0.85, height: obstacle.kind === 'ground' ? 0.9 : 0.3 })

  useFrame((state, delta) => {
    const mesh = obstacleRef.current
    if (!mesh || !running) return

    mesh.rotation.set(0, 0, 0)
    const previousDistance = mesh.position.x - PLAYER_X
    mesh.position.x -= speed * delta
    const distance = mesh.position.x - PLAYER_X
    const halfWidth = playerCollider.current.halfWidth + colliderDimensions.current.halfWidth
    const crossedWindow = previousDistance >= halfWidth && distance <= -halfWidth
    if (!scored.current && (crossedWindow || Math.abs(distance) < halfWidth)) {
      overlapping.current = true
      const obstacleBottom = obstacleY + (obstacle.kind === 'air' ? Math.sin(state.clock.elapsedTime * 4) * PLANE_FLOAT_AMPLITUDE : 0)
      const obstacleTop = obstacleBottom + colliderDimensions.current.height
      const collidingVertically = playerCollider.current.bottom < obstacleTop && playerCollider.current.top > obstacleBottom
      const planeNotRolledUnder = obstacle.kind === 'air' && action !== 'roll'
      if (planeNotRolledUnder || collidingVertically) {
        scored.current = true
        onCollision()
      }
    }
    if (!scored.current && overlapping.current && distance <= -halfWidth) {
      scored.current = true
      onAvoided()
    }
    if (mesh.position.x < -10) {
      onExit(obstacle.id)
    }
  })

  return <group ref={obstacleRef} position={[9, obstacleY, 0]}>
    <ObstacleModel kind={obstacle.kind} colliderDimensions={colliderDimensions} />
  </group>
}

function ObstacleModel({ kind, colliderDimensions }: { kind: ObstacleKind; colliderDimensions: { current: ObstacleCollider } }) {
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
    colliderDimensions.current = {
      halfWidth: modelSize.x * modelScale * OBSTACLE_COLLIDER_WIDTH_RATIO,
      height: modelSize.y * modelScale * (isPlane ? 1 : CAKE_COLLIDER_HEIGHT_RATIO),
    }
    scene.traverse((object) => {
      const mesh = object as Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
  }, [colliderDimensions, isPlane, modelScale, modelSize, scene])

  useFrame((state) => {
    if (isPlane && modelOffset.current) {
      modelOffset.current.traverse((object) => {
        if (object !== modelOffset.current) object.rotation.set(0, 0, 0)
      })
      modelOffset.current.position.y = Math.sin(state.clock.elapsedTime * 4) * PLANE_FLOAT_AMPLITUDE
      modelOffset.current.rotation.z = Math.sin(state.clock.elapsedTime * 2.6) * 0.075
    }
  })

  return <group ref={modelOffset}>
    <Clone object={scene} scale={modelScale} rotation={[0, 0, 0]} position={[-modelCenter.x * modelScale, -modelBounds.min.y * modelScale, -modelCenter.z * modelScale]} />
  </group>
}

function ParallaxLayer({ asset, count, y, z, spacing, speed, size, running = true }: {
  asset: string
  count: number
  y: number
  z: number
  spacing: number
  speed: number
  size: number
  running?: boolean
}) {
  const { scene } = useGLTF(asset)
  const modelBounds = useMemo(() => new Box3().setFromObject(scene), [scene])
  const modelSize = useMemo(() => modelBounds.getSize(new Vector3()), [modelBounds])
  const modelCenter = useMemo(() => modelBounds.getCenter(new Vector3()), [modelBounds])
  const maxDimension = Math.max(modelSize.x, modelSize.y, modelSize.z, 0.001)
  const modelScale = size / maxDimension
  const refs = useRef<(Group | null)[]>([])
  const isGrass = asset.endsWith('/grass.glb')
  const mergedGrassGeometry = useMemo(() => {
    if (!isGrass) return null
    scene.updateMatrixWorld(true)
    const geometries: Mesh['geometry'][] = []
    scene.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      const geometry = mesh.geometry.clone()
      geometry.applyMatrix4(mesh.matrixWorld)
      geometries.push(geometry)
    })
    const mergedGeometry = mergeGeometries(geometries, false)
    geometries.forEach((geometry) => geometry.dispose())
    return mergedGeometry
  }, [isGrass, scene])
  const grassMaterial = useMemo(() => {
    if (!isGrass) return null
    let material: Mesh['material'] | null = null
    scene.traverse((object) => {
      const mesh = object as Mesh
      if (!material && mesh.isMesh) material = mesh.material
    })
    return material
  }, [isGrass, scene])
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

  useEffect(() => () => mergedGrassGeometry?.dispose(), [mergedGrassGeometry])

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
      scale={modelScale * (isGrass ? 0.78 + (item.variant % 5) * 0.11 : asset.includes('cloud') && item.variant % 2 === 1 ? 0.78 : 1)}
      rotation={[0, isGrass ? (item.variant * 2.399963) % (Math.PI * 2) : asset.includes('cloud') ? 0 : (item.variant % 3 - 1) * 0.045, 0]}
    >
      {mergedGrassGeometry && grassMaterial
        ? <mesh geometry={mergedGrassGeometry} material={grassMaterial} position={[-modelCenter.x, -modelBounds.min.y, -modelCenter.z]} />
        : <Clone object={scene} position={[-modelCenter.x, -modelBounds.min.y, -modelCenter.z]} />}
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

function RunnerLighting({ score }: { score: number }) {
  const phaseScore = score % 60
  const phase = RUNNER_LIGHT_PHASES[Math.floor(phaseScore / 10)]
  const ambientRef = useRef<AmbientLight>(null)
  const hemisphereRef = useRef<HemisphereLight>(null)
  const sunlightRef = useRef<DirectionalLight>(null)
  const { scene } = useThree()
  const background = useRef(new Color(RUNNER_LIGHT_PHASES[0].background))
  const fog = useRef(new FogExp2(RUNNER_LIGHT_PHASES[0].background, RUNNER_LIGHT_PHASES[0].fogDensity))
  const ambientColor = useMemo(() => new Color(phase.ambient), [phase])
  const skyColor = useMemo(() => new Color(phase.sky), [phase])
  const groundColor = useMemo(() => new Color(phase.ground), [phase])
  const sunlightColor = useMemo(() => new Color(phase.sunlight), [phase])
  const backgroundColor = useMemo(() => new Color(phase.background), [phase])
  const sunlightPosition = useMemo(() => new Vector3(phase.sunPosition[0], phase.sunPosition[1], phase.sunPosition[2]), [phase])

  useEffect(() => {
    scene.background = background.current
    scene.fog = fog.current
    return () => {
      if (scene.background === background.current) scene.background = null
      if (scene.fog === fog.current) scene.fog = null
    }
  }, [scene])

  useFrame((_, delta) => {
    const ambient = ambientRef.current
    const hemisphere = hemisphereRef.current
    const sunlight = sunlightRef.current
    if (!ambient || !hemisphere || !sunlight) return

    const blend = 1 - Math.exp(-delta * 1.2)
    ambient.intensity += (phase.ambientIntensity - ambient.intensity) * blend
    ambient.color.lerp(ambientColor, blend)
    hemisphere.intensity += (phase.hemisphereIntensity - hemisphere.intensity) * blend
    hemisphere.color.lerp(skyColor, blend)
    hemisphere.groundColor.lerp(groundColor, blend)
    sunlight.intensity += (phase.sunlightIntensity - sunlight.intensity) * blend
    sunlight.color.lerp(sunlightColor, blend)
    sunlight.position.lerp(sunlightPosition, blend)
    background.current.lerp(backgroundColor, blend)
    fog.current.color.lerp(backgroundColor, blend)
    fog.current.density += (phase.fogDensity - fog.current.density) * blend
  })

  return <>
    <ambientLight ref={ambientRef} color={RUNNER_LIGHT_PHASES[0].ambient} intensity={RUNNER_LIGHT_PHASES[0].ambientIntensity} />
    <hemisphereLight ref={hemisphereRef} args={[RUNNER_LIGHT_PHASES[0].sky, RUNNER_LIGHT_PHASES[0].ground, RUNNER_LIGHT_PHASES[0].hemisphereIntensity]} />
    <directionalLight ref={sunlightRef} position={RUNNER_LIGHT_PHASES[0].sunPosition} color={RUNNER_LIGHT_PHASES[0].sunlight} intensity={RUNNER_LIGHT_PHASES[0].sunlightIntensity} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
  </>
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
  const playerCollider = useRef<PlayerCollider>({ halfWidth: 0.35, bottom: FLOOR_Y, top: FLOOR_Y + 2 })
  const spawnTimer = useRef(0)
  const nextId = useRef(0)
  const speed = 5.5 + Math.min(score * 0.16, 7)

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
    <RunnerLighting score={score} />
    <ParallaxLayer asset="/models/game/cloud-1.glb" count={5} y={2.8} z={-4.2} spacing={5.5} speed={0.32} size={3.1} />
    <ParallaxLayer asset="/models/game/forest.glb" count={6} y={FLOOR_Y + 0.05} z={-5.2} spacing={4.5} speed={0.3} size={5.3} running={status === 'running'} />
    <ParallaxLayer asset="/models/game/grass.glb" count={20} y={FLOOR_Y + 0.02} z={2.1} spacing={1.8} speed={speed} size={1.5} running={status === 'running'} />
    <mesh position={[0, FLOOR_Y - 0.08, 0]} receiveShadow>
      <boxGeometry args={[80, 0.16, 12]} />
      <GrassMaterial />
    </mesh>
    <RunnerCharacter key={team} team={team} action={action} collider={playerCollider} onActionFinished={onActionFinished} />
    {obstacles.map((obstacle) => <Obstacle key={obstacle.id} obstacle={obstacle} running={status === 'running'} speed={speed} action={action} playerCollider={playerCollider} onAvoided={onAvoided} onExit={handleExit} onCollision={handleCollision} />)}
    <ReadySignal status={status} onReady={onReady} />
  </>
}

useGLTF.preload('/models/game/forest.glb')
useGLTF.preload('/models/game/cloud-1.glb')
useGLTF.preload('/models/game/grass.glb')
useGLTF.preload('/models/game/cake.glb')
useGLTF.preload('/models/game/paper-plane.glb')

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
  const crashStarted = useRef(false)
  const resultTimer = useRef<number | null>(null)

  useEffect(() => () => {
    if (resultTimer.current !== null) window.clearTimeout(resultTimer.current)
  }, [])

  useEffect(() => setSavedBest(bestScore), [bestScore])

  const finishRun = useCallback(async () => {
    if (crashStarted.current) return
    crashStarted.current = true
    setStatus('crashing')
    setAction('falling')
    resultTimer.current = window.setTimeout(() => {
      setStatus((current) => current === 'crashing' ? 'over' : current)
      resultTimer.current = null
    }, 650)
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
    if (resultTimer.current !== null) window.clearTimeout(resultTimer.current)
    resultTimer.current = null
    crashStarted.current = false
    scoreRef.current = 0
    setScore(0)
    setAction('run')
    setStatus('running')
  }, [])

  function chooseTeam(nextTeam: Team) {
    if (status === 'running' || status === 'crashing' || team === nextTeam) return
    setTeam(nextTeam)
    setAction('run')
    setStatus('ready')
  }

  const performAction = useCallback((nextAction: 'jump' | 'roll') => {
    if (status !== 'running' || action !== 'run') return
    setAction(nextAction)
  }, [action, status])

  const handleActionFinished = useCallback((finishedAction: RunnerAction) => {
    if ((finishedAction === 'jump' || finishedAction === 'roll') && !crashStarted.current) {
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
      <button type="button" className={`runner-team-button groom ${team === 'marie' ? 'selected' : ''}`} onClick={() => chooseTeam('marie')} disabled={status === 'running' || status === 'crashing'} aria-pressed={team === 'marie'}>
        <Crown size={18} /><span>Le marié</span>
      </button>
      <button type="button" className={`runner-team-button bride ${team === 'mariee' ? 'selected' : ''}`} onClick={() => chooseTeam('mariee')} disabled={status === 'running' || status === 'crashing'} aria-pressed={team === 'mariee'}>
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
      {ready && (status === 'ready' || status === 'over') && <div className={`runner-overlay ${status === 'over' ? 'runner-overlay-result' : ''}`}>
        <strong>{status === 'over' ? 'Course terminée' : 'Prêt à courir ?'}</strong>
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
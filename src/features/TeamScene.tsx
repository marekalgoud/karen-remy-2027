import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useAnimations, useFBX, useGLTF } from '@react-three/drei'
import { Box3, MathUtils, Object3D, PerspectiveCamera, Vector3, type AnimationClip, type Group, type Mesh, type PointLight, type SpotLight } from 'three'
import type { Team } from '../lib/gameStore'
import { animatedModelBounds } from '../lib/animatedModelBounds'

type AnimatedGroup = Group & { animations: AnimationClip[] }

const modelPaths: Record<Team, string> = {
  marie: '/models/groom/groom-idle.fbx',
  mariee: '/models/bride/bride-idle.fbx',
}

const animationPaths: Record<Team, string> = {
  marie: '/models/groom/groom-silly-dance.fbx',
  mariee: '/models/bride/bride-belly-dance.fbx',
}

function PreloadDanceAnimations() {
  useFBX(animationPaths.marie)
  useFBX(animationPaths.mariee)
  return null
}

function CharacterAnimation({ team, model, idleAnimation, active }: { team: Team; model: Group; idleAnimation: AnimatedGroup; active: boolean }) {
  const danceModel = useFBX(animationPaths[team]) as AnimatedGroup
  const clips = useMemo(() => {
    const idleClip = idleAnimation.animations[0]?.clone()
    const danceClip = danceModel.animations[0]?.clone()
    if (idleClip) idleClip.name = 'idle'
    if (danceClip) danceClip.name = 'dance'
    return [idleClip, danceClip].filter((clip): clip is AnimationClip => Boolean(clip))
  }, [danceModel, idleAnimation])
  const { actions } = useAnimations(clips, model)

  useEffect(() => {
    const incoming = active ? actions.dance : actions.idle
    const outgoing = active ? actions.idle : actions.dance
    if (!incoming) return

    incoming.reset().play()
    if (outgoing?.isRunning()) outgoing.crossFadeTo(incoming, 0.6, false)
    else incoming.fadeIn(0.25)
  }, [actions, active])

  useEffect(() => () => {
    actions.idle?.stop()
    actions.dance?.stop()
  }, [actions])

  return null
}

type CharacterProps = { team: Team; active: boolean; hasSelection: boolean; position: [number, number, number] }

function Character(props: CharacterProps) {
  return props.team === 'marie' ? <GroomCharacter {...props} /> : <BrideCharacter {...props} />
}

function GroomCharacter(props: CharacterProps) {
  const { scene } = useGLTF('/models/groom/groom.glb')
  const idleAnimation = useFBX(modelPaths.marie) as AnimatedGroup
  scene.rotation.x = -Math.PI / 2
  return <AnimatedCharacter {...props} model={scene} idleAnimation={idleAnimation} modelScale={1.6} />
}

function BrideCharacter(props: CharacterProps) {
  const { scene } = useGLTF('/models/bride/bride.glb')
  const idleAnimation = useFBX(modelPaths.mariee) as AnimatedGroup
  scene.rotation.x = -Math.PI / 2
  return <AnimatedCharacter {...props} model={scene} idleAnimation={idleAnimation} modelScale={1.6} />
}

function AnimatedCharacter({ team, active, hasSelection, position, model, idleAnimation, modelScale }: CharacterProps & { model: Group; idleAnimation: AnimatedGroup; modelScale: number }) {
  const modelBottom = useMemo(() => (idleAnimation.animations[0]
    ? animatedModelBounds(model, idleAnimation.animations[0])
    : new Box3().setFromObject(model)).min.y, [idleAnimation, model, team])

  useEffect(() => {
    model.traverse((object) => {
      const mesh = object as Mesh
      if (mesh.isMesh) {
        mesh.castShadow = active || !hasSelection
        mesh.receiveShadow = true
      }
    })
  }, [active, hasSelection, model, team])

  const depthOffset = active ? 0.3 : hasSelection ? -0.75 : 0
  const characterScale = active ? 1.12 : hasSelection ? 0.84 : 1
  const unscaledFootY = -1.35 + modelBottom * modelScale
  const verticalOffset = -1.4 - characterScale * unscaledFootY

  return <group position={[position[0], verticalOffset, position[2] + depthOffset]} scale={characterScale}>
    <group scale={modelScale} position={[0, -1.35, 0]}>
      <primitive object={model} />
    </group>
    <CharacterAnimation team={team} model={model} idleAnimation={idleAnimation} active={active} />
  </group>
}

function CameraFocus({ team }: { team?: Team }) {
  const { camera } = useThree()
  const cameraTarget = useRef(new Vector3())
  const lookTarget = useRef(new Vector3())
  const lookHelper = useRef(new PerspectiveCamera())

  useFrame((_, delta) => {
    const focusX = team === 'marie' ? -0.75 : team === 'mariee' ? 0.75 : 0
    cameraTarget.current.set(focusX * 0.7, 0.35, team === 'mariee' ? 8.4 : team ? 7.15 : 7.4)
    lookTarget.current.set(focusX, 0.32, 0)
    const smoothness = 1 - Math.exp(-delta * 1.5)
    camera.position.lerp(cameraTarget.current, smoothness)
    lookHelper.current.position.copy(camera.position)
    lookHelper.current.lookAt(lookTarget.current)
    camera.quaternion.slerp(lookHelper.current.quaternion, smoothness)
  })

  return null
}

function TeamLighting({ team }: { team?: Team }) {
  const groomLight = useRef<PointLight>(null)
  const brideLight = useRef<PointLight>(null)
  const groomSpot = useRef<SpotLight>(null)
  const brideSpot = useRef<SpotLight>(null)
  const groomTarget = useRef(new Object3D())
  const brideTarget = useRef(new Object3D())

  useFrame((_, delta) => {
    if (groomLight.current) {
      groomLight.current.intensity = MathUtils.damp(groomLight.current.intensity, team === 'marie' ? 7 : 0.5, 2.8, delta)
    }
    if (brideLight.current) {
      brideLight.current.intensity = MathUtils.damp(brideLight.current.intensity, team === 'mariee' ? 7 : 0.5, 2.8, delta)
    }
    if (groomSpot.current) {
      groomSpot.current.intensity = MathUtils.damp(groomSpot.current.intensity, team === 'marie' ? 68 : 8, 2, delta)
    }
    if (brideSpot.current) {
      brideSpot.current.intensity = MathUtils.damp(brideSpot.current.intensity, team === 'mariee' ? 68 : 8, 2, delta)
    }
  })

  return <>
    <primitive object={groomTarget.current} position={[-1.15, -1.35, 0]} />
    <primitive object={brideTarget.current} position={[1.15, -1.35, 0]} />
    <pointLight ref={groomLight} position={[-1.15, 1.8, 2.2]} color="#69aaff" intensity={1} distance={6} decay={2} />
    <pointLight ref={brideLight} position={[1.15, 1.8, 2.2]} color="#ff78b5" intensity={1} distance={6} decay={2} />
    <spotLight ref={groomSpot} target={groomTarget.current} position={[-2.8, 4.2, 3.2]} color="#8fc4ff" intensity={8} angle={0.62} penumbra={0.78} distance={12} decay={2} castShadow={!team || team === 'marie'} shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-bias={-0.00015} shadow-radius={5} />
    <spotLight ref={brideSpot} target={brideTarget.current} position={[2.8, 4.2, 3.2]} color="#ff9bc8" intensity={8} angle={0.62} penumbra={0.78} distance={12} decay={2} castShadow={!team || team === 'mariee'} shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-bias={-0.00015} shadow-radius={5} />
  </>
}

function LoadedCharacters({ team, onLoaded }: { team?: Team; onLoaded: () => void }) {
  useEffect(() => onLoaded(), [onLoaded])

  return <>
    <PreloadDanceAnimations />
    <Character team="marie" active={team === 'marie'} hasSelection={Boolean(team)} position={[-1.15, 0, 0]} />
    <Character team="mariee" active={team === 'mariee'} hasSelection={Boolean(team)} position={[1.15, 0, 0]} />
  </>
}

export default function TeamScene({ team }: { team?: Team }) {
  const [modelsReady, setModelsReady] = useState(false)
  const markModelsReady = useCallback(() => setModelsReady(true), [])
  const shadowColor = team === 'mariee' ? '#c64f79' : '#4d8ecb'

  return <div className="team-scene" aria-label="Les deux mariés en 3D; le personnage choisi s’anime">
    <Canvas camera={{ position: [0, 0.35, 7.4], fov: 36 }} dpr={[1, 1.5]} shadows>
      <ambientLight intensity={0.45} />
      <directionalLight position={[-3, 5, 5]} intensity={0.8} />
      <TeamLighting team={team} />
      <CameraFocus team={team} />
      <mesh position={[0, -1.4, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <shadowMaterial transparent color={shadowColor} opacity={0.36} />
      </mesh>
      <Suspense fallback={null}>
        <LoadedCharacters team={team} onLoaded={markModelsReady} />
      </Suspense>
    </Canvas>
    {!modelsReady && <div className="scene-loading-overlay" role="status" aria-live="polite">
      <div className="scene-loading">
        <span className="scene-loading-spinner" />
        <span>Chargement des mariés…</span>
      </div>
    </div>}
    <div className="scene-labels"><span className={team === 'marie' ? 'active' : ''}>LE MARIÉ</span><span className="scene-heart">♥</span><span className={team === 'mariee' ? 'active' : ''}>LA MARIÉE</span></div>
  </div>
}
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, DynamicDrawUsage, Object3D, type InstancedMesh } from 'three'

const REFLECTION_COUNT = 36
const REFLECTION_COLORS = ['#79aecd', '#d28ea9', '#b7a487']

export default function DiscoLights() {
  const wall = useRef<InstancedMesh>(null)
  const floor = useRef<InstancedMesh>(null)
  const tile = useMemo(() => new Object3D(), [])

  useLayoutEffect(() => {
    const colors = REFLECTION_COLORS.map((color) => new Color(color))
    for (const mesh of [wall.current, floor.current]) {
      if (!mesh) continue
      mesh.instanceMatrix.setUsage(DynamicDrawUsage)
      for (let index = 0; index < REFLECTION_COUNT; index += 1) mesh.setColorAt(index, colors[index % colors.length])
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  }, [])

  useFrame(({ clock }) => {
    if (!wall.current || !floor.current) return
    const time = clock.elapsedTime
    for (let index = 0; index < REFLECTION_COUNT; index += 1) {
      const angle = time * 0.28 + index * 2.399963
      const radius = 0.8 + (index % 8) * 0.46
      const shimmer = 0.6 + 0.4 * Math.sin(time * 1.5 + index * 1.7) ** 2
      tile.position.set(Math.cos(angle) * radius, 0.2 + Math.sin(angle) * (0.45 + (index % 6) * 0.24), -3.27)
      tile.rotation.set(0, 0, angle * 0.3)
      tile.scale.setScalar(shimmer)
      tile.updateMatrix()
      wall.current.setMatrixAt(index, tile.matrix)
      tile.position.set(Math.cos(angle + 0.8) * radius, -1.392, Math.sin(angle + 0.8) * radius * 0.7)
      tile.rotation.set(-Math.PI / 2, 0, angle * 0.3)
      tile.updateMatrix()
      floor.current.setMatrixAt(index, tile.matrix)
    }
    wall.current.instanceMatrix.needsUpdate = true
    floor.current.instanceMatrix.needsUpdate = true
  })

  return <>
    <instancedMesh ref={wall} name="disco-wall-reflections" args={[undefined, undefined, REFLECTION_COUNT]} frustumCulled={false}>
      <planeGeometry args={[0.18, 0.12]} /><meshBasicMaterial transparent opacity={0.45} depthWrite={false} toneMapped={false} />
    </instancedMesh>
    <instancedMesh ref={floor} name="disco-floor-reflections" args={[undefined, undefined, REFLECTION_COUNT]} frustumCulled={false}>
      <planeGeometry args={[0.22, 0.15]} /><meshBasicMaterial transparent opacity={0.45} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  </>
}
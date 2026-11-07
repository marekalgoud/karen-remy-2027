import { AnimationMixer, Box3, type AnimationClip, type Group, type SkinnedMesh } from 'three'

export function animatedModelBounds(model: Group, clip: AnimationClip): Box3 {
  const mixer = new AnimationMixer(model)
  mixer.clipAction(clip).play()
  mixer.update(0)
  model.updateMatrixWorld(true)
  model.traverse((object) => {
    const mesh = object as SkinnedMesh
    if (mesh.isSkinnedMesh) {
      mesh.skeleton.update()
      mesh.computeBoundingBox()
    }
  })
  const bounds = new Box3().setFromObject(model)
  mixer.stopAllAction()
  return bounds
}
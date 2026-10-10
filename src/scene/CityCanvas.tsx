import { MapControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { useCity } from '@/store/city';
import { Building } from './Building';
import { Districts, Ground, Roads } from './Ground';
import { C } from './look';
import { Overlays } from './Overlays';
import { Props } from './Props';
import { SimDriver } from './SimDriver';
import { Vehicles } from './Vehicles';

/** Smoothly pans the camera to the focused object. */
function CameraRig() {
  const focus = useCity((s) => s.focus);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update(): void } | null;
  const camera = useThree((s) => s.camera);
  const handled = useRef(0);
  const goal = useRef<THREE.Vector3 | null>(null);
  if (focus && focus.seq !== handled.current) {
    handled.current = focus.seq;
    goal.current = new THREE.Vector3(focus.at[0], 0, focus.at[1]);
  }
  useFrame((_, dt) => {
    if (!controls || !goal.current) return;
    const delta = goal.current.clone().sub(controls.target).multiplyScalar(Math.min(dt * 4, 1));
    controls.target.add(delta);
    camera.position.add(delta);
    controls.update();
    if (goal.current.distanceTo(controls.target) < 0.05) goal.current = null;
  });
  return null;
}

function City() {
  const placements = useCity((s) => s.space.placements);
  return (
    <>
      <Ground />
      <Districts />
      <Roads />
      <Props />
      {placements.map((p) => (
        <Building key={p.entityId} placement={p} />
      ))}
      <Vehicles />
      <Overlays />
    </>
  );
}

export function CityCanvas() {
  return (
    <Canvas
      shadows="percentage"
      orthographic
      dpr={[1, 2]}
      camera={{ position: [54, 43, 47], zoom: 11.5, near: -200, far: 400 }}
      onPointerMissed={() => useCity.getState().select(null)}
      gl={{ antialias: true }}
    >
      <color attach="background" args={[C.bg]} />
      <hemisphereLight args={['#ffffff', '#c9d0ea', 1.15]} />
      <directionalLight
        position={[-25, 40, 30]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
      />
      <directionalLight position={[30, 20, -20]} intensity={0.35} color="#dfe6ff" />
      <MapControls
        makeDefault
        target={[15, 0, 2]}
        enableDamping
        dampingFactor={0.12}
        minZoom={7}
        maxZoom={70}
        minPolarAngle={0.35}
        maxPolarAngle={1.15}
        screenSpacePanning={false}
      />
      <CameraRig />
      <SimDriver />
      <City />
    </Canvas>
  );
}

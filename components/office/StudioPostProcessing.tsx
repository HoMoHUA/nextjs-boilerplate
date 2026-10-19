"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/** Moving contact shading, without baking people into permanent floor shadows. */
export function StudioPostProcessing() {
  const { gl, scene, camera, size } = useThree();
  const pipeline = useRef<{ composer: EffectComposer; ao: GTAOPass } | null>(null);
  useEffect(() => {
    const composer = new EffectComposer(gl);
    const samples = Math.min(2, gl.capabilities.maxSamples);
    composer.renderTarget1.samples = composer.renderTarget2.samples = samples;
    const render = new RenderPass(scene, camera);
    const ao = new GTAOPass(scene, camera);
    ao.updateGtaoMaterial({ radius: 0.36, samples: 8, thickness: 0.8, distanceFallOff: 1, scale: 0.65 });
    ao.updatePdMaterial({ radius: 3, samples: 8, rings: 2 });
    ao.blendIntensity = 0.85;
    const output = new OutputPass();
    composer.addPass(render);
    composer.addPass(ao);
    composer.addPass(output);
    pipeline.current = { composer, ao };
    return () => {
      pipeline.current = null;
      render.dispose(); ao.dispose(); output.dispose(); composer.dispose();
    };
  }, [gl, scene, camera]);
  useEffect(() => {
    const current = pipeline.current;
    if (!current) return;
    const ratio = Math.min(gl.getPixelRatio(), 1.5);
    current.composer.setPixelRatio(ratio);
    current.composer.setSize(size.width, size.height);
    current.ao.setSize(Math.max(1, Math.floor(size.width * ratio * 0.65)), Math.max(1, Math.floor(size.height * ratio * 0.65)));
  }, [gl, camera, size]);
  useFrame((_, delta) => {
    if (pipeline.current) pipeline.current.composer.render(delta);
    else gl.render(scene, camera);
  }, 1);
  return null;
}

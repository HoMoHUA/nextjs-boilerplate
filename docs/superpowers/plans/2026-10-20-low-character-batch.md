# Low character draw-call reduction

Measured gap: 12-person Low reports 638 calls in the static mobile matrix, above the provisional 250 target. The authored joints already provide rigid transforms for each mesh; retain these controls and batch opaque character surfaces through rigid skinning for Low only.

1. Test transforms against actual source geometry, including mirrored limbs and nonuniform body/root scaling; test dynamic hand visibility, transparent exclusions and owned-resource cleanup.
2. Build one vertex-colored SkinnedMesh per character. Each source primitive uses one rigid bone; copy its actual transform after character animation. Preserve transparent materials, carried cup and pen separately. Bake colors and use a matte Low material; Medium/High keep their existing materials.
3. Verify browser Low rendering and poses, repeat the 12-person counter measurement and quality/resource lifecycle check. Keep hardware FPS/GPU-byte acceptance explicitly open.

This is a rendering optimization, not an animation/identity/status change. Source geometry/materials remain shared and must never be disposed by the batch. Disposal removes only owned buffers, material, skeleton texture and helper mesh. Appearance or quality changes rebuild and clean up the batch.

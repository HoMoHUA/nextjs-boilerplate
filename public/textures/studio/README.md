# Studio material textures

Generated material base-color images matching the approved `docs/concepts/office-studio-concept.png` direction:

- `oak.jpg` — warm honey natural oak, subtle vertical grain.
- `fabric.jpg` — pale oatmeal/sage woven upholstery.
- `plaster.jpg` — warm ivory fine lime plaster.
- `garden.jpg` — soft-focus warm sunlit cream/olive garden for the view beyond the windows.

The three material maps are 512 × 512 RGB progressive JPEGs at quality 88. Treat as sRGB base color. Set material roughness separately; these images do not contain normal, roughness, or metalness data.

The garden background is a separate 1536 × 768 RGB progressive JPEG at quality 86. It was generated as a soft-focus photographic environment without frames or architecture. Its original is retained at `/workspace/generated_images/exec-612c68de-c033-4181-8dab-884eb83e2a15.png`.

Created with Image Gen as one evenly lit, orthographic, three-panel texture atlas, then cropped into the three square panels and resized for real-time use. Original atlas retained at `/workspace/generated_images/exec-bba09870-50bf-46a9-9b79-71c17f48e483.png`.

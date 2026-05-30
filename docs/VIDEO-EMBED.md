# Demo video: embedding the native HTML5 player

The README hero is the silent, autoplaying **GIF** at [`.github/assets/demo.gif`](../.github/assets/demo.gif). That is the only fully-autonomous embed GitHub renders inline, so it is what ships in the README.

There is also a **voiced MP4** (`demo-output/output.mp4`, ~45s, H.264, 1920×1080, ~2 MB) with narration. GitHub will not play an MP4 that lives in the repo via a `<video>` tag pointing at a repo file; the only way to get an inline HTML5 player is to upload the file through GitHub's own attachment flow and use the resulting `user-attachments` URL.

## How to add the native player (manual, one-time)

1. Open a GitHub **issue, pull request, or release** in this repo and drag `demo-output/output.mp4` into the comment box (or click to attach).
2. GitHub uploads it and returns a URL of the form `https://github.com/user-attachments/assets/…`.
3. Paste that URL on its own line at the **top of `README.md`**, just above the GIF. GitHub auto-renders `user-attachments` video URLs as an inline HTML5 `<video>` player.

### Limits
- **Size:** 10 MB on the free tier, 100 MB on paid. Our `output.mp4` is ~2 MB, so it fits the free tier.
- **Formats:** `.mp4`, `.mov`, `.webm`. Must be **H.264** for the inline player (ours is `libx264` / `yuv420p`).
- A `<video src="...repo file...">` tag pointing at a file committed in the repo does **not** play inline; you must use the `user-attachments` URL from the upload flow above.

## Rebuilding the demo

All build inputs live under `demo-output/` (gitignored): `scenes/*.html`, `narration/*.txt`, `frames/*.png`, `audio/*.aiff`, the per-scene `clip*.mp4`, and `output.mp4`. The pipeline:

1. Render each scene to a frame: `playwright screenshot --viewport-size=1920,1080 --wait-for-timeout=<ms> "file://$PWD/demo-output/scenes/sN.html" demo-output/frames/sN.png`
2. Per-scene voiced clip: `ffmpeg -loop 1 -i frames/sN.png -i audio/sN.aiff -c:v libx264 -tune stillimage -pix_fmt yuv420p -t <dur> -vf "scale=1920:1080,fade=in:...,fade=out:..." clipN.mp4`
3. Concat with 0.3s crossfades (`xfade` + `acrossfade`) into `output.mp4`.
4. GIF from `output.mp4` via `palettegen`/`paletteuse` (fps 12, width 960) then `gifsicle -O3 --lossy=80 --colors 200`.

> **zsh note:** pass the `xfade` filtergraph via `ffmpeg -filter_complex_script <file>` rather than inline; zsh glob-expands the `[stream]` brackets and mangles the filter string, producing an empty `offset` error.

## Narration / TTS note

Narration uses the offline macOS `say` voice (`say -v Alex -o audio/sN.aiff "$(cat narration/sN.txt)"`) because **edge-tts cannot run in this environment**: the system clock is set to 2026, so Microsoft's speech endpoint rejects edge-tts's time-based `Sec-MS-GEC` token with WebSocket close code 1007, and edge-tts only self-corrects on a 403 that never fires. To regenerate higher-quality neural narration, run on a machine with a correct clock:

```bash
edge-tts --voice en-US-AndrewNeural --file demo-output/narration/sN.txt --write-media demo-output/audio/sN.mp3
```

then rebuild the clips and `output.mp4` with the `.mp3` audio inputs.

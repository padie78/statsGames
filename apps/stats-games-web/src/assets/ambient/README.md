# Ambient loops (UpStats AI)

Loops WebM **abstractos propios** — sin IP de Epic/Roblox.

| Archivo | Uso | Spec |
|---------|-----|------|
| `fortnite-abstract-loop.webm` | Hero/banner Fortnite | ≤3s, mute, VP9 |
| `roblox-abstract-loop.webm` | Hero/banner Roblox | ≤3s, mute, VP9 |

Regenerar (requiere ffmpeg):

```bash
FFMPEG=/tmp/ffmpeg-7.0.2-amd64-static/ffmpeg   # o `ffmpeg` del PATH
OUT=apps/stats-games-web/src/assets/ambient

# Fortnite: cyan/purple storm sweep
"$FFMPEG" -y -f lavfi -i "color=c=#080910:s=640x360:d=2.5,format=yuv420p" \
  -f lavfi -i "gradients=s=640x360:c0=#22D3EE:c1=#A855F7:x0=0:y0=0:x1=640:y1=360:d=2.5" \
  -filter_complex "[1]format=yuva420p,colorchannelmixer=aa=0.35[g];[0][g]overlay,fade=t=in:st=0:d=0.3,fade=t=out:st=2.2:d=0.3" \
  -c:v libvpx-vp9 -b:v 120k -an -loop 0 -t 2.5 "$OUT/fortnite-abstract-loop.webm"

# Roblox: gold/purple block pulse
"$FFMPEG" -y -f lavfi -i "color=c=#080910:s=640x360:d=2.5,format=yuv420p" \
  -f lavfi -i "gradients=s=640x360:c0=#A855F7:c1=#F5C542:x0=640:y0=0:x1=0:y1=360:d=2.5" \
  -filter_complex "[1]format=yuva420p,colorchannelmixer=aa=0.32[g];[0][g]overlay,fade=t=in:st=0:d=0.3,fade=t=out:st=2.2:d=0.3" \
  -c:v libvpx-vp9 -b:v 100k -an -loop 0 -t 2.5 "$OUT/roblox-abstract-loop.webm"
```

Política: `.cursor/rules/media-ip-policy.mdc`

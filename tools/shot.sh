#!/usr/bin/env bash
# Screenshot game screens from the kit preview with headless Chrome.
#   tools/shot.sh <out dir> [screen...]      screens: home market checkout stream result levels streamers
# Needs the preview running: node <kit>/web/hs-web.mjs preview mukbang-bang --port 8090
# Headless Chrome on Windows forces a window at least 548 px wide, so the phone
# aspect (390x844) is captured at 548x1186 — the game lays out by aspect ratio.
OUT="${1:?out dir}"; shift
CH="/c/Program Files/Google/Chrome/Application/chrome.exe"
URL="${SHOT_URL:-http://127.0.0.1:8090/__hs_frame.html}"
mkdir -p "$OUT"
SCREENS="${*:-home market checkout stream result levels streamers}"
for s in $SCREENS; do
  png="$OUT/$s.png"; rm -f "$png"
  "$CH" --headless=new --disable-gpu --hide-scrollbars --mute-audio --window-size=548,1186 --virtual-time-budget=3000 \
    --screenshot="$(cygpath -w "$png")" "$URL#auto=$s:5" >/dev/null 2>&1 &
  pid=$!
  for i in $(seq 1 40); do [ -s "$png" ] && break; sleep 0.5; done
  sleep 1; kill $pid 2>/dev/null
  [ -s "$png" ] && echo "ok  $s" || echo "MISSING $s"
done
# headless Chrome leaves helper processes behind on Windows: kill only those
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name = 'chrome.exe'\" | Where-Object { \$_.CommandLine -like '*--headless*' } | ForEach-Object { try { Stop-Process -Id \$_.ProcessId -Force -ErrorAction Stop } catch {} }" >/dev/null 2>&1

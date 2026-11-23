#!/bin/bash
# Schneidet trailer/raw/*.webm zu gack-attack-trailer.mp4 (mit prozeduraler Musik, 124 BPM)
set -e; cd "$(dirname "$0")"
f=$(ls raw/*.webm | head -1); D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
S=2.2; L=$(python3 -c "print(round($D-$S-0.3,2))")
B="0.5*sin(2*PI*55*t)*exp(-8*mod(t,0.4839))+0.22*sin(2*PI*(110+27.5*floor(mod(t/1.935,4)))*t)*exp(-4*mod(t,0.2419))*gte(mod(t,0.4839),0.24)+0.1*(random(0)-0.5)*exp(-40*mod(t+0.2419,0.4839))"
ffmpeg -y -v error -ss $S -i "$f" -f lavfi -i "aevalsrc='$B':s=44100" -t $L \
 -vf "fade=in:0:15,fade=out:st=$(python3 -c "print($L-1)"):d=1,format=yuv420p" \
 -af "afade=in:d=1,afade=out:st=$(python3 -c "print($L-1.5)"):d=1.5,volume=0.7" \
 -c:v libx264 -crf 22 -preset medium -c:a aac -b:a 128k -movflags +faststart gack-attack-trailer.mp4

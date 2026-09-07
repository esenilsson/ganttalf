#!/usr/bin/env sh
# Package the Ganttalf skill for upload to the Claude app
# (Customize → Skills → Add → Upload a skill).
# The archive must contain the skill folder itself as its root entry.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
out=${1:-"$root/ganttalf-skill.zip"}
rm -f "$out"
cd "$root/.claude/skills"

if command -v zip >/dev/null 2>&1; then
  zip -rq "$out" ganttalf -x 'ganttalf/node_modules/*' 'ganttalf/.gitignore' '*/.DS_Store'
else
  python3 - "$out" <<'PY'
import os, sys, zipfile
out = sys.argv[1]
skip = {'node_modules', '__pycache__'}
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for dirpath, dirnames, filenames in os.walk('ganttalf'):
        dirnames[:] = [d for d in dirnames if d not in skip]
        for f in sorted(filenames):
            if f in ('.gitignore', '.DS_Store'):
                continue
            z.write(os.path.join(dirpath, f))
PY
fi
echo "Wrote $out"
python3 -c "import zipfile,sys; [print(' ', n) for n in zipfile.ZipFile(sys.argv[1]).namelist()]" "$out"

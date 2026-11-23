#!/usr/bin/env bash
# OX 퀴즈 — GitHub Pages 배포 스크립트
# 사용법:  bash deploy.sh            (repo: 2002gywjd-bot/ox-quiz)
#          REPO=2002gywjd-bot/other bash deploy.sh
set -u
OWNER="2002gywjd-bot"
REPO_FULL="${REPO:-2002gywjd-bot/ox-quiz}"
NAME="${REPO_FULL#*/}"
URL="https://${REPO_FULL%%/*}.github.io/${NAME}/"
HERE="$(cd "$(dirname "$0")" && pwd)"

cd "$HERE" || exit 1

echo "▶ 대상 저장소: $REPO_FULL"

# 1) 저장소가 있는지 확인
if ! gh repo view "$REPO_FULL" >/dev/null 2>&1; then
  cat <<EOF
✖ 저장소 $REPO_FULL 이(가) 아직 없습니다.
  Pickle의 GitHub 연결 권한으로는 저장소를 새로 만들 수 없어서,
  사용자가 https://github.com/new 에서 이름 '$NAME', Public 으로 15초만에 만들어 주셔야 합니다.
  (또는 GitHub의 Pickle 앱 설치 설정에서 'Administration: Read and write' 권한을 허용)
EOF
  exit 2
fi

# 2) 푸시
git remote remove origin >/dev/null 2>&1
git remote add origin "https://github.com/${REPO_FULL}.git"
if ! git push -u origin main 2>/tmp/push.err; then
  echo "· 첫 푸시 거부됨(저장소에 초기 커밋이 있는 경우) — 병합 후 다시 시도합니다."
  git fetch origin main || { cat /tmp/push.err; exit 3; }
  git merge -s ours --allow-unrelated-histories -m "저장소 초기 커밋과 병합" origin/main || exit 3
  git push -u origin main || { cat /tmp/push.err; exit 3; }
fi
echo "✔ main 브랜치 푸시 완료"

# 3) GitHub Pages 활성화 (이미 켜져 있으면 무시)
if ! gh api "repos/${REPO_FULL}/pages" >/dev/null 2>&1; then
  if printf '{"source":{"branch":"main","path":"/"},"build_type":"legacy"}' \
     | gh api -X POST "repos/${REPO_FULL}/pages" --input - >/dev/null 2>&1; then
    echo "✔ GitHub Pages 활성화 요청"
  else
    echo "· Pages API 실패 — GitHub 웹(Settings → Pages → main / (root))에서 켜야 할 수 있습니다."
  fi
else
  echo "· GitHub Pages 이미 활성화됨"
fi

# 4) 배포 대기 후 확인
echo "… 배포 대기"
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
  if [ "$code" = "200" ]; then echo "✔ 라이브: $URL (HTTP 200)"; exit 0; fi
  sleep 10
done
echo "△ 아직 200이 아닙니다(마지막 응답: ${code:-none}). 몇 분 뒤 다시 확인: $URL"
exit 4

#!/bin/bash
# Regenerate the Collega sprint dashboard every 60s.
#   start:  .sprint-dashboard/run.sh start
#   stop:   .sprint-dashboard/run.sh stop
#   status: .sprint-dashboard/run.sh status
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDFILE="$DIR/run.pid"
LOGFILE="$DIR/run.log"
INTERVAL="${INTERVAL:-60}"

loop() {
  while true; do
    python3 "$DIR/generate.py" >>"$LOGFILE" 2>&1
    sleep "$INTERVAL"
  done
}

case "${1:-start}" in
  start)
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
      echo "already running (pid $(cat "$PIDFILE"))"; exit 0
    fi
    python3 "$DIR/generate.py" || exit 1
    nohup "${BASH_SOURCE[0]}" __loop >>"$LOGFILE" 2>&1 &
    echo $! >"$PIDFILE"
    echo "refreshing every ${INTERVAL}s (pid $(cat "$PIDFILE"))"
    echo "open: file://$DIR/dashboard.html"
    ;;
  __loop) loop ;;
  stop)
    if [ -f "$PIDFILE" ]; then
      kill "$(cat "$PIDFILE")" 2>/dev/null && echo "stopped"
      rm -f "$PIDFILE"
    else
      echo "not running"
    fi
    ;;
  status)
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
      echo "running (pid $(cat "$PIDFILE")); last write:"
      tail -1 "$LOGFILE"
    else
      echo "not running"
    fi
    ;;
  *) echo "usage: run.sh {start|stop|status}"; exit 1 ;;
esac

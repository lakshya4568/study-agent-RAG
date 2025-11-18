#!/bin/bash

# ChromaDB Server Management Script
# Easily start, stop, restart, and check status of ChromaDB server

CHROMA_BIN=".venv/bin/chroma"
CHROMA_STORAGE=".chromadb/chroma_storage"
CHROMA_PORT="8000"
CHROMA_HOST="localhost"
CHROMA_LOG=".chromadb/chroma.log"

case "$1" in
  start)
    echo "🚀 Starting ChromaDB server..."
    
    # Check if already running
    if curl -s http://${CHROMA_HOST}:${CHROMA_PORT}/api/v2/heartbeat >/dev/null 2>&1; then
      echo "⚠️  ChromaDB server is already running"
      exit 0
    fi
    
    # Ensure storage directory exists
    mkdir -p ${CHROMA_STORAGE}
    
    # Start server in background
    nohup ${CHROMA_BIN} run --path ${CHROMA_STORAGE} --port ${CHROMA_PORT} --host ${CHROMA_HOST} > ${CHROMA_LOG} 2>&1 &
    
    # Wait for server to start
    sleep 3
    
    if curl -s http://${CHROMA_HOST}:${CHROMA_PORT}/api/v2/heartbeat >/dev/null 2>&1; then
      echo "✅ ChromaDB server started successfully"
      echo "   URL: http://${CHROMA_HOST}:${CHROMA_PORT}"
      echo "   Storage: ${CHROMA_STORAGE}"
      echo "   Logs: ${CHROMA_LOG}"
    else
      echo "❌ Failed to start ChromaDB server"
      echo "Check logs: tail -f ${CHROMA_LOG}"
      exit 1
    fi
    ;;
    
  stop)
    echo "🛑 Stopping ChromaDB server..."
    PID=$(pgrep -f "chroma run")
    
    if [ -z "$PID" ]; then
      echo "⚠️  ChromaDB server is not running"
      exit 0
    fi
    
    kill $PID
    sleep 2
    
    if ! pgrep -f "chroma run" >/dev/null; then
      echo "✅ ChromaDB server stopped"
    else
      echo "⚠️  Force killing server..."
      kill -9 $PID
      echo "✅ ChromaDB server stopped (forced)"
    fi
    ;;
    
  restart)
    echo "🔄 Restarting ChromaDB server..."
    $0 stop
    sleep 2
    $0 start
    ;;
    
  status)
    echo ""
    echo "🔍 ChromaDB Server Status"
    echo "========================="
    
    if curl -s http://${CHROMA_HOST}:${CHROMA_PORT}/api/v2/heartbeat >/dev/null 2>&1; then
      echo "Status: ✅ RUNNING"
      echo "URL: http://${CHROMA_HOST}:${CHROMA_PORT}"
      PID=$(pgrep -f "chroma run")
      echo "PID: $PID"
      
      # Show storage info
      if [ -d "${CHROMA_STORAGE}" ]; then
        SIZE=$(du -sh ${CHROMA_STORAGE} | cut -f1)
        echo "Storage: ${CHROMA_STORAGE} (${SIZE})"
        
        # Show collections if sqlite3 is available
        if command -v sqlite3 >/dev/null 2>&1; then
          echo ""
          echo "Collections:"
          sqlite3 ${CHROMA_STORAGE}/chroma.sqlite3 "SELECT name FROM collections;" 2>/dev/null | sed 's/^/  - /'
        fi
      fi
    else
      echo "Status: ❌ NOT RUNNING"
    fi
    echo ""
    ;;
    
  logs)
    echo "📋 ChromaDB Server Logs (last 50 lines)"
    echo "========================================"
    tail -50 ${CHROMA_LOG}
    ;;
    
  *)
    echo "ChromaDB Server Management"
    echo ""
    echo "Usage: $0 {start|stop|restart|status|logs}"
    echo ""
    echo "Commands:"
    echo "  start    - Start ChromaDB server in background"
    echo "  stop     - Stop ChromaDB server"
    echo "  restart  - Restart ChromaDB server"
    echo "  status   - Check server status and show info"
    echo "  logs     - Show recent server logs"
    exit 1
    ;;
esac

exit 0

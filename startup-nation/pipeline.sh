#!/bin/bash
# Startup Nation News Pipeline
# Fetches → Scores → Builds viewer.html
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "🔄 [$(date '+%H:%M')] מביא כתבות..."
python3 fetch_news.py

echo "⚙️  [$(date '+%H:%M')] מדרג כתבות..."
python3 score_articles.py

echo "🏗️  [$(date '+%H:%M')] בונה viewer..."
python3 build_viewer.py

echo "✅ [$(date '+%H:%M')] viewer.html עודכן!"

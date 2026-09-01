#!/usr/bin/env bash
# Renders a coverage summary block for $GITHUB_STEP_SUMMARY. Report-format-specific
# extraction (JaCoCo XML, vitest json-summary) stays in each calling workflow — this
# script only owns the part that was duplicated between them: the ✅/❌ threshold
# comparison and the "report missing or empty" fallback.
#
# Usage: coverage-summary.sh <title> <threshold> [pct] [covered] [total]
# pct/covered/total should be left empty (or total left <= 0) when the calling
# workflow couldn't parse its report — this prints the fallback message in that case.
set -eo pipefail

TITLE="$1"
THRESHOLD="$2"
PCT="${3:-}"
COVERED="${4:-}"
TOTAL="${5:-}"

echo "## $TITLE"
echo ""
if [[ "$COVERED" =~ ^[0-9]+$ && "$TOTAL" =~ ^[0-9]+$ ]] && [ "$TOTAL" -gt 0 ]; then
  STATUS="✅ Above threshold"
  # Compare the raw covered/total ratio against the threshold, not the display-rounded
  # $PCT — rounding could show "Above threshold" for a run that actually failed the
  # real gate (e.g. a true 89.996% rounds to "90.00").
  awk "BEGIN { exit !($COVERED * 100 < $THRESHOLD * $TOTAL) }" && STATUS="❌ Below threshold"
  echo "Lines: ${PCT}% (${COVERED}/${TOTAL})"
  echo "Threshold: ${THRESHOLD}%"
  echo "$STATUS"
else
  echo "Coverage unavailable — report missing or empty"
fi

#!/bin/bash

# Script to extract audio from database and check durations with ffprobe
# Usage: ./check_durations.sh [call_id1] [call_id2] ...

# Database connection from rdio-scanner.ini
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="rdio_scanner"
DB_USER="michaelchambers"
DB_PASS="asdfasd5456456df"

# Call IDs from the log (all the ones that were skipped)
CALL_IDS=(368490 368491 368492 368493 368494 368495 368496 368497 368498 368499 368500 368501 368502 368503 368504 368506 368507 368508 368509)

# Use provided call IDs or default list
if [ $# -gt 0 ]; then
    CALL_IDS=("$@")
fi

# Create temp directory
TEMP_DIR=$(mktemp -d)
echo "Using temp directory: $TEMP_DIR"

# Function to extract and check duration
check_call() {
    local call_id=$1
    echo ""
    echo "=== Checking Call ID: $call_id ==="
    
    # Extract audio filename and audio data
    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT \"audioFilename\" FROM \"calls\" WHERE \"callId\" = $call_id;
    " | tr -d ' ' > "$TEMP_DIR/${call_id}_filename.txt"
    
    local filename=$(cat "$TEMP_DIR/${call_id}_filename.txt")
    
    if [ -z "$filename" ]; then
        echo "ERROR: Call $call_id not found in database"
        return
    fi
    
    echo "Filename: $filename"
    
    # Extract audio data to file
    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c "
        SELECT encode(\"audio\", 'base64') FROM \"calls\" WHERE \"callId\" = $call_id;
    " | base64 -d > "$TEMP_DIR/${call_id}_${filename}"
    
    if [ ! -s "$TEMP_DIR/${call_id}_${filename}" ]; then
        echo "ERROR: Failed to extract audio for call $call_id"
        return
    fi
    
    # Check duration with ffprobe
    echo "Checking duration with ffprobe..."
    duration=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$TEMP_DIR/${call_id}_${filename}" 2>/dev/null)
    
    if [ -z "$duration" ]; then
        echo "ERROR: ffprobe failed to get duration"
        echo "ffprobe output:"
        ffprobe -v error -show_entries format=duration -of json "$TEMP_DIR/${call_id}_${filename}" 2>&1
    else
        echo "Actual duration: ${duration}s"
        printf "File size: "
        ls -lh "$TEMP_DIR/${call_id}_${filename}" | awk '{print $5}'
    fi
}

# Check each call
for call_id in "${CALL_IDS[@]}"; do
    check_call "$call_id"
done

echo ""
echo "=== Summary ==="
echo "All audio files saved in: $TEMP_DIR"
echo "To clean up, run: rm -rf $TEMP_DIR"


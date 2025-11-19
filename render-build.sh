#!/usr/bin/env bash
set -o errexit  # Exit on first error
set -o nounset  # Treat unset variables as errors
set -o pipefail # Catch errors in piped commands

# Install ffmpeg if possible (some build environments are read-only)
if command -v apt-get >/dev/null 2>&1 && [ -w /var/lib/apt/lists ]; then
	echo "Installing ffmpeg via apt-get..."
	apt-get update
	apt-get install -y ffmpeg
else
	echo "Warning: Skipping apt-get install. apt-get not available or filesystem is read-only."
	echo "If ffmpeg is required at runtime, consider adding the 'ffmpeg-static' npm package or using a Dockerfile that installs ffmpeg."
fi

# Install Node dependencies
npm install --production

#!/usr/bin/env bash
set -o errexit  # Exit on first error
set -o nounset  # Treat unset variables as errors
set -o pipefail # Catch errors in piped commands

# Install ffmpeg
apt-get update
apt-get install -y ffmpeg

# Install Node dependencies
npm install --production

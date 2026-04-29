#!/bin/bash

# Build script for ATD Motion Detector ACAP

set -e

echo "Building ATD Motion Detector ACAP..."

# Create build directory
mkdir -p build
cd build

# Configure with CMake
cmake .. -DCMAKE_BUILD_TYPE=Release

# Build the application
make -j$(nproc)

# Go back to package root
cd ..

# Create ACAP package structure
ACAP_NAME="atd_motion_detector"
VERSION="1.0.0"

# Copy binary
mkdir -p ${ACAP_NAME}/bin
cp build/atd_motion_detector ${ACAP_NAME}/bin/

# Copy web files
cp -r www/* ${ACAP_NAME}/www/

# Copy configuration files
cp manifest.xml ${ACAP_NAME}/
cp package.conf ${ACAP_NAME}/
cp param.conf ${ACAP_NAME}/

# Create ACAP package
echo "Creating ACAP package..."
tar czf ${ACAP_NAME}_${VERSION}.acap ${ACAP_NAME}/

echo "ACAP package created: ${ACAP_NAME}_${VERSION}.acap"
echo ""
echo "To install on Axis camera:"
echo "1. Access camera web interface"
echo "2. Go to Setup > Applications"
echo "3. Upload the .acap file"
echo "4. Access the application at: http://<camera-ip>/local/atd-motion-detector/"
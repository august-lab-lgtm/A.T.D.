# ATD Motion Detector - C++ ACAP Application

This is a C++ implementation of the Autonomous Trauma Detection (ATD) system, packaged as an Axis Camera Application Platform (ACAP) application for deployment on Axis IP cameras.

## Features

- **Motion Detection**: Real-time motion detection using OpenCV
- **Multi-Target Tracking**: Tracks multiple moving objects simultaneously
- **Heatmap Generation**: Visualizes activity density
- **Web Interface**: Built-in HTTP server for web-based monitoring
- **Older Camera Compatibility**: Native C++ implementation works on older Axis camera models

## Requirements

### Development
- CMake 3.10+
- OpenCV 4.x
- Boost 1.70+
- Axis ACAP SDK (for camera-specific features)
- C++17 compatible compiler

### Target Hardware
- Axis IP cameras with ACAP support
- Compatible with older models (firmware 4.x+)

## Building

1. Install dependencies:
   ```bash
   # Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install cmake libopencv-dev libboost-all-dev build-essential
   ```

2. Build the application:
   ```bash
   cd acap-package
   make package
   # OR
   ./build.sh
   ```

3. The build process will create `atd_motion_detector_1.0.0.acap`

## Installation on Axis Camera

1. Access your Axis camera's web interface
2. Navigate to: **Setup** > **Applications** > **App Licensing** (or similar)
3. Click **Add** or **Upload Application**
4. Select the `atd_motion_detector_1.0.0.acap` file
5. Click **Install**
6. Once installed, access the application at:
   `http://<camera-ip>/local/atd-motion-detector/`

## Configuration

The application can be configured through the camera's web interface:

- **Motion Sensitivity**: Adjust detection threshold (1-100)
- **Email Notifications**: Enable/disable alert notifications
- **Camera Access**: Grant camera feed access permissions

## Architecture

### C++ Components
- `main.cpp`: Main application logic with OpenCV motion detection
- HTTP server using Boost.Beast for web interface
- Real-time video processing and target tracking

### Web Interface
- `www/index.html`: Canvas-based visualization
- Real-time updates via polling
- Compatible with older browser versions

### ACAP Integration
- `manifest.xml`: Application metadata and permissions
- `package.conf`: Package configuration and dependencies
- `param.conf`: Runtime parameters for camera integration

## Compatibility

This C++ implementation is designed to work with older Axis camera models:

- ✅ Native C++ performance (no JavaScript dependencies)
- ✅ OpenCV for robust computer vision
- ✅ Embedded HTTP server (no external web server needed)
- ✅ Minimal resource requirements
- ✅ Compatible with firmware versions 4.x and later

## API Endpoints

The application provides the following HTTP endpoints:

- `GET /`: Main web interface
- `GET /api/status`: JSON status information
- `GET /api/targets`: Current tracked targets
- `GET /api/heatmap`: Heatmap data

## Troubleshooting

### Build Issues
- Ensure all dependencies are installed
- Check CMake version (3.10+ required)
- Verify OpenCV and Boost installations

### Camera Installation
- Ensure camera has sufficient storage space (4MB+)
- Check ACAP compatibility for your camera model
- Verify network permissions for application installation

### Runtime Issues
- Check camera system logs for error messages
- Ensure camera has video feed access
- Verify HTTP server is running on port 8080
- Check for OpenCV library compatibility

## File Structure

```
acap-package/
├── CMakeLists.txt          # CMake build configuration
├── Makefile               # Alternative build system
├── build.sh              # Build script
├── manifest.xml          # ACAP application manifest
├── package.conf          # Package configuration
├── param.conf            # Runtime parameters
├── README.md             # This file
├── scripts/
│   └── setup.sh          # Post-installation script
├── src/
│   └── main.cpp          # Main C++ application
└── www/
    └── index.html        # Web interface
```

## Development Notes

- The application uses OpenCV for motion detection and tracking
- Boost.Beast provides HTTP server functionality
- Canvas-based visualization for broad browser compatibility
- Designed for resource-constrained embedded systems

## License

This project is provided as-is for educational and development purposes.
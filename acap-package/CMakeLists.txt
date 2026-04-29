cmake_minimum_required(VERSION 3.10)
project(ATD_MotionDetector)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find required packages
find_package(OpenCV REQUIRED)
find_package(Boost REQUIRED COMPONENTS system thread)

# Axis ACAP SDK
include_directories(/opt/axis/sdk/include)
link_directories(/opt/axis/sdk/lib)

# Include directories
include_directories(${OpenCV_INCLUDE_DIRS})
include_directories(${Boost_INCLUDE_DIRS})

# Source files
set(SOURCES
    src/main.cpp
)

# Create executable
add_executable(atd_motion_detector ${SOURCES})

# Link libraries
target_link_libraries(atd_motion_detector
    ${OpenCV_LIBS}
    ${Boost_LIBRARIES}
    axis_http_server
    axis_camera
    pthread
)

# Install
install(TARGETS atd_motion_detector DESTINATION bin)
install(DIRECTORY www/ DESTINATION www)
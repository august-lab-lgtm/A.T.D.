# Makefile for ATD Motion Detector ACAP

CXX = g++
CXXFLAGS = -std=c++17 -Wall -Wextra -O2
LDFLAGS = -pthread

# OpenCV
OPENCV_CFLAGS = $(shell pkg-config --cflags opencv4)
OPENCV_LIBS = $(shell pkg-config --libs opencv4)

# Boost
BOOST_CFLAGS = -I/usr/include/boost
BOOST_LIBS = -lboost_system -lboost_thread

# Axis SDK (uncomment if available)
# AXIS_CFLAGS = -I/opt/axis/sdk/include
# AXIS_LIBS = -L/opt/axis/sdk/lib -laxis_http_server -laxis_camera

TARGET = atd_motion_detector
SOURCES = src/main.cpp
OBJECTS = $(SOURCES:.cpp=.o)

.PHONY: all clean install package

all: $(TARGET)

$(TARGET): $(OBJECTS)
	$(CXX) $(OBJECTS) -o $@ $(LDFLAGS) $(OPENCV_LIBS) $(BOOST_LIBS)

%.o: %.cpp
	$(CXX) $(CXXFLAGS) $(OPENCV_CFLAGS) $(BOOST_CFLAGS) -c $< -o $@

clean:
	rm -f $(OBJECTS) $(TARGET)
	rm -rf build/

install: $(TARGET)
	mkdir -p /usr/local/bin
	cp $(TARGET) /usr/local/bin/

package: all
	@echo "Creating ACAP package..."
	mkdir -p atd_motion_detector/bin
	mkdir -p atd_motion_detector/www
	cp $(TARGET) atd_motion_detector/bin/
	cp -r www/* atd_motion_detector/www/
	cp manifest.xml package.conf param.conf atd_motion_detector/
	tar czf atd_motion_detector_1.0.0.acap atd_motion_detector/
	@echo "Package created: atd_motion_detector_1.0.0.acap"
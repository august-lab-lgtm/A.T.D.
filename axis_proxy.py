#!/usr/bin/env python3
"""
Simple proxy server for Axis camera to bypass CORS and handle authentication
Includes MJPEG frame extraction and automatic camera discovery
"""
import http.server
import socketserver
import urllib.request
import urllib.error
import base64
import sys
import re
import socket
import json
import ipaddress
from urllib.parse import urlparse, parse_qs
from io import BytesIO
from threading import Thread, Lock

CAMERA_IP = "192.168.0.90"
CAMERA_USERNAME = "root"
CAMERA_PASSWORD = "pass"
PROXY_PORT = 8081

# Cache for discovered cameras
discovered_cameras = []
discovery_lock = Lock()

def get_local_network_ips():
    """Get all potential Axis camera IPs in local network"""
    ips = []
    try:
        # Get local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        
        # Get network prefix (assume /24 subnet)
        network_prefix = ".".join(local_ip.split(".")[:3])
        
        # Also add common private ranges
        ranges = [
            network_prefix,
            "192.168.1",
            "192.168.0",
            "10.0.0",
            "10.0.1",
            "172.16.0"
        ]
        
        for prefix in ranges:
            for i in range(1, 255):
                ips.append(f"{prefix}.{i}")
        
        return ips
    except Exception as e:
        print(f"[DISCOVERY] Error getting network info: {e}", file=sys.stderr)
        # Fall back to common ranges
        return [f"192.168.1.{i}" for i in range(1, 255)] + [f"192.168.0.{i}" for i in range(1, 255)]

def is_axis_camera(ip):
    """Check if IP has an Axis camera"""
    try:
        url = f"http://{ip}/axis-cgi/param.cgi?action=list&group=ImageSource"
        
        auth_str = f"{CAMERA_USERNAME}:{CAMERA_PASSWORD}"
        auth_bytes = auth_str.encode('ascii')
        auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
        
        req = urllib.request.Request(url)
        req.add_header('Authorization', f'Basic {auth_b64}')
        req.add_header('User-Agent', 'ATD-Discovery/1.0')
        
        with urllib.request.urlopen(req, timeout=1) as response:
            content = response.read().decode('utf-8')
            # Check for Axis-specific response
            if 'ImageSource' in content or 'Axis' in content:
                return True
    except:
        pass
    
    return False

def discover_cameras_threaded():
    """Discover cameras in background"""
    global discovered_cameras
    
    try:
        print("[DISCOVERY] Starting camera discovery scan...", file=sys.stderr)
        found = []
        ips = get_local_network_ips()
        
        # Sample IPs instead of checking all (faster)
        sampled_ips = ips[::8]  # Check every 8th IP
        
        for ip in sampled_ips:
            if is_axis_camera(ip):
                print(f"[DISCOVERY] Found Axis camera at {ip}", file=sys.stderr)
                found.append(ip)
                if len(found) >= 3:  # Stop after finding 3 cameras
                    break
        
        if found:
            with discovery_lock:
                discovered_cameras = found
            print(f"[DISCOVERY] Discovery complete. Found {len(found)} camera(s)", file=sys.stderr)
        else:
            print("[DISCOVERY] No Axis cameras found", file=sys.stderr)
            
    except Exception as e:
        print(f"[DISCOVERY] Error during discovery: {e}", file=sys.stderr)

class AxisCameraProxyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        """Handle GET requests and proxy them to the Axis camera"""
        
        # Parse the requested path
        path = self.path
        
        print(f"[PROXY] GET request: {path}", file=sys.stderr)
        
        # Handle discovery endpoint
        if path == '/discover' or path == '/discover/':
            self.handle_discovery()
            return
        
        # Route to camera endpoints
        if path.startswith('/camera'):
            # Remove /camera prefix to get the actual camera path
            camera_path = path[7:]  # Remove '/camera'
            
            if not camera_path:
                camera_path = '/'
            
            camera_url = f"http://{CAMERA_IP}{camera_path}"
            
            try:
                # Create authentication
                auth_str = f"{CAMERA_USERNAME}:{CAMERA_PASSWORD}"
                auth_bytes = auth_str.encode('ascii')
                auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
                
                # Create request with authentication
                req = urllib.request.Request(camera_url)
                req.add_header('Authorization', f'Basic {auth_b64}')
                req.add_header('User-Agent', 'ATD-Axis-Proxy/1.0')
                
                print(f"[PROXY] Fetching: {camera_url}", file=sys.stderr)
                
                # Fetch from camera
                with urllib.request.urlopen(req, timeout=3) as response:
                    content_type = response.headers.get('Content-Type', 'application/octet-stream')
                    
                    # Check if this is MJPEG stream
                    if 'multipart' in content_type.lower():
                        print(f"[PROXY] MJPEG stream detected", file=sys.stderr)
                        self.handle_mjpeg_stream(response)
                    else:
                        # Regular single frame
                        content = response.read()
                        
                        # Send response with CORS headers
                        self.send_response(200)
                        self.send_header('Content-Type', content_type)
                        self.send_header('Content-Length', len(content))
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
                        self.end_headers()
                        self.wfile.write(content)
                        
                        print(f"[PROXY] Success: {len(content)} bytes", file=sys.stderr)
                    
            except urllib.error.HTTPError as e:
                print(f"[PROXY] HTTP Error: {e.code} {e.reason}", file=sys.stderr)
                self.send_response(e.code)
                self.send_header('Content-Type', 'text/plain')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(f"Camera returned: {e.code} {e.reason}".encode())
                
            except urllib.error.URLError as e:
                print(f"[PROXY] URL Error: {e.reason}", file=sys.stderr)
                self.send_response(502)
                self.send_header('Content-Type', 'text/plain')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(f"Connection error: {e.reason}".encode())
                
            except Exception as e:
                print(f"[PROXY] Error: {e}", file=sys.stderr)
                self.send_response(500)
                self.send_header('Content-Type', 'text/plain')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(f"Error: {e}".encode())
        else:
            # Serve local files
            super().do_GET()
    
    def handle_mjpeg_stream(self, response):
        """Extract a single JPEG frame from MJPEG stream"""
        try:
            boundary = None
            content_type = response.headers.get('Content-Type', '')
            
            # Extract boundary from Content-Type
            match = re.search(r'boundary=([^\r\n]+)', content_type)
            if match:
                boundary = match.group(1).strip('"')
                print(f"[PROXY] Boundary: {boundary}", file=sys.stderr)
            
            # Read first frame from stream
            frame_data = BytesIO()
            boundary_found = False
            in_frame = False
            frame_headers = {}
            
            # Read up to 500KB of data to find a JPEG frame
            chunk_size = 4096
            bytes_read = 0
            max_bytes = 500 * 1024
            
            while bytes_read < max_bytes:
                try:
                    chunk = response.read(chunk_size)
                    if not chunk:
                        break
                    
                    bytes_read += len(chunk)
                    frame_data.write(chunk)
                    
                    # Look for JPEG start marker
                    if not in_frame and b'\xff\xd8\xff' in frame_data.getvalue():
                        print(f"[PROXY] JPEG frame found after {bytes_read} bytes", file=sys.stderr)
                        in_frame = True
                    
                    # Look for JPEG end marker
                    if in_frame and b'\xff\xd9' in frame_data.getvalue():
                        print(f"[PROXY] JPEG frame complete", file=sys.stderr)
                        
                        # Extract JPEG data
                        data = frame_data.getvalue()
                        jpeg_start = data.find(b'\xff\xd8\xff')
                        jpeg_end = data.find(b'\xff\xd9', jpeg_start) + 2
                        jpeg_data = data[jpeg_start:jpeg_end]
                        
                        print(f"[PROXY] Extracted JPEG: {len(jpeg_data)} bytes", file=sys.stderr)
                        
                        # Send response
                        self.send_response(200)
                        self.send_header('Content-Type', 'image/jpeg')
                        self.send_header('Content-Length', len(jpeg_data))
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
                        self.end_headers()
                        self.wfile.write(jpeg_data)
                        
                        print(f"[PROXY] Frame sent successfully", file=sys.stderr)
                        return
                        
                except socket.timeout:
                    print(f"[PROXY] Socket timeout while reading stream", file=sys.stderr)
                    break
            
            # If we got here, no complete frame found
            print(f"[PROXY] No complete JPEG frame found after {bytes_read} bytes", file=sys.stderr)
            self.send_response(503)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b"No frame data available")
            
        except Exception as e:
            print(f"[PROXY] MJPEG handling error: {e}", file=sys.stderr)
            self.send_response(500)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(f"Error: {e}".encode())
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Max-Age', '3600')
        self.end_headers()
    
    def handle_discovery(self):
        """Handle camera discovery request"""
        try:
            with discovery_lock:
                cameras = discovered_cameras.copy()
            
            response_data = {
                "cameras": cameras,
                "status": "complete" if cameras else "no_cameras_found"
            }
            
            response_json = json.dumps(response_data)
            response_bytes = response_json.encode('utf-8')
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', len(response_bytes))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.end_headers()
            self.wfile.write(response_bytes)
            
            print(f"[DISCOVERY] Returned {len(cameras)} camera(s)", file=sys.stderr)
        except Exception as e:
            print(f"[DISCOVERY] Error handling discovery request: {e}", file=sys.stderr)
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())
    
    def log_message(self, format, *args):
        """Custom logging"""
        print(f"[PROXY] {format % args}", file=sys.stderr)

if __name__ == '__main__':
    handler = AxisCameraProxyHandler
    
    # Start camera discovery in background
    discovery_thread = Thread(target=discover_cameras_threaded, daemon=True)
    discovery_thread.start()
    
    with socketserver.TCPServer(("", PROXY_PORT), handler) as httpd:
        print(f"Axis Camera Proxy Server running on port {PROXY_PORT}")
        print(f"Camera: http://{CAMERA_IP}")
        print(f"Proxy: http://localhost:{PROXY_PORT}")
        print(f"Access camera via: http://localhost:{PROXY_PORT}/camera/axis-cgi/mjpg/video.cgi")
        print(f"Auto-discovery: http://localhost:{PROXY_PORT}/discover")
        print("Press Ctrl+C to stop")
        print()
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nProxy server stopped")

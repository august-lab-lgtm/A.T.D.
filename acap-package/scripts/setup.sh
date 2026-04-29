#!/bin/bash

# Post-installation script for ATD Motion Detector

echo "Setting up ATD Motion Detector..."

# Create necessary directories
mkdir -p /usr/local/packages/atd_motion_detector
mkdir -p /var/log/atd_motion_detector

# Set permissions
chmod 755 /usr/local/packages/atd_motion_detector/bin/atd_motion_detector
chmod 644 /usr/local/packages/atd_motion_detector/www/*

# Create systemd service (if supported)
if command -v systemctl >/dev/null 2>&1; then
    cat > /etc/systemd/system/atd-motion-detector.service << EOF
[Unit]
Description=ATD Motion Detector Service
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/packages/atd_motion_detector/bin/atd_motion_detector
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable atd-motion-detector
    systemctl start atd-motion-detector

    echo "Service installed and started"
else
    echo "Systemd not available, manual startup required"
fi

echo "ATD Motion Detector setup complete"
echo "Access the web interface at: http://<camera-ip>:8080/"
#!/bin/bash
# mobile-dev.sh - Helper script for mobile development

echo "🔍 Finding your local IP address..."

# Detect OS and get IP
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    LOCAL_IP=$(hostname -I | awk '{print $1}')
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    # Windows Git Bash
    LOCAL_IP=$(ipconfig.exe | grep "IPv4 Address" | head -1 | awk '{print $14}' | tr -d '\r')
else
    echo "❌ Unsupported OS. Please find your IP manually."
    exit 1
fi

echo "📱 Your local IP address: $LOCAL_IP"
echo "🌐 Access your app from mobile: http://$LOCAL_IP:5183"
echo ""
echo "🔧 Make sure to:"
echo "   1. Update vite.config.ts with host: '0.0.0.0'"
echo "   2. Restart your dev server with: npm run dev"
echo "   3. Connect your phone to the same WiFi network"
echo "   4. Open http://$LOCAL_IP:5183 in your phone's browser"
echo ""
echo "📷 For camera features, consider using ngrok for HTTPS:"
echo "   npm install -g ngrok"
echo "   ngrok http 5173"
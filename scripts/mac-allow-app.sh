#!/bin/bash
# Script to allow macOS to run unsigned Electron app
# Usage: ./scripts/mac-allow-app.sh "DMarket Bot.app"

APP_NAME="${1:-DMarket Bot.app}"
APP_PATH="./dist-electron/mac/${APP_NAME}"

if [ ! -d "$APP_PATH" ]; then
    echo "Error: Application not found at $APP_PATH"
    echo "Please build the app first using: npm run build:mac"
    exit 1
fi

echo "Removing quarantine attribute from $APP_NAME..."
xattr -dr com.apple.quarantine "$APP_PATH"

echo "Done! You can now open the application."
echo "If you still see a warning, right-click the app and select 'Open'."


#!/bin/bash
set -euo pipefail

# Ensure Xcode.app toolchain is used even if xcode-select points at CLT
if [ -d /Applications/Xcode.app/Contents/Developer ]; then
    export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi

APP_NAME="Clotch"
PRODUCT="Clotch"  # SwiftPM executable name
BUILD_DIR=".build/release"
APP_BUNDLE="$BUILD_DIR/$APP_NAME.app"
ICON_CATALOG="Assets.xcassets"
ICON_SOURCE="AppIcon.icon"
ICON_INFO_PLIST=".build/AppIcon.partial.plist"

NOTARIZE=false

usage() {
    cat <<'EOF'
Usage: ./build.sh [--notarize]

  --notarize    Notarize macOS app bundle / DMG after signing
  --help        Show this help
EOF
}

for arg in "$@"; do
    case "$arg" in
        --notarize)
            NOTARIZE=true
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $arg" >&2
            usage >&2
            exit 1
            ;;
    esac
done

# grep reads the saved output: a pipe into grep -q breaks tee (SIGPIPE) under pipefail and reads Accepted as failed.
notarize() {
    local out
    out=$(xcrun notarytool submit "$1" --keychain-profile "clotch" --wait 2>&1) || true
    echo "$out" >&2
    grep -q "status: Accepted" <<<"$out"
}

build_mac() {
    echo "Building $APP_NAME (arm64 only)..."
    swift build -c release --arch arm64

    # Newer SwiftPM puts products in .build/out/Products/Release: ask it instead of guessing.
    ARM_DIR="$(swift build -c release --arch arm64 --show-bin-path)"

    echo "Creating app bundle..."
    rm -rf "$APP_BUNDLE"
    mkdir -p "$APP_BUNDLE/Contents/MacOS"
    mkdir -p "$APP_BUNDLE/Contents/Helpers"
    mkdir -p "$APP_BUNDLE/Contents/Resources"
    mkdir -p "$APP_BUNDLE/Contents/Frameworks"

    cp "$ARM_DIR/$PRODUCT" "$APP_BUNDLE/Contents/MacOS/$APP_NAME"
    cp "$ARM_DIR/clotch-bridge" "$APP_BUNDLE/Contents/Helpers/clotch-bridge"
    cp Info.plist "$APP_BUNDLE/Contents/Info.plist"
    # The commit in the bundle: every launch writes it in the log, so it is always known which build runs (#174).
    /usr/libexec/PlistBuddy -c "Add :ClotchCommit string $(git rev-parse --short HEAD)$(git diff --quiet HEAD -- Sources || echo +)" "$APP_BUNDLE/Contents/Info.plist"
    # Every build a higher CFBundleVersion: «1.0.38.<commits>» tells two builds apart from outside and still sorts below 1.0.39 for Sparkle (#195).
    /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' Info.plist).$(git rev-list --count HEAD)" "$APP_BUNDLE/Contents/Info.plist"

    echo "Embedding frameworks..."
    # Sparkle.xcframework macos-arm64_x86_64 slice is already universal; copy as-is to preserve symlinks.
    SPARKLE_SRC=".build/artifacts/sparkle/Sparkle/Sparkle.xcframework/macos-arm64_x86_64/Sparkle.framework"
    if [ ! -d "$SPARKLE_SRC" ]; then
        echo "Missing Sparkle.framework at $SPARKLE_SRC" >&2
        exit 1
    fi
    ditto "$SPARKLE_SRC" "$APP_BUNDLE/Contents/Frameworks/Sparkle.framework"

    # Add rpath so executables can locate embedded frameworks.
    install_name_tool -add_rpath "@executable_path/../Frameworks" \
        "$APP_BUNDLE/Contents/MacOS/$APP_NAME" 2>/dev/null || true
    install_name_tool -add_rpath "@executable_path/../../Frameworks" \
        "$APP_BUNDLE/Contents/Helpers/clotch-bridge" 2>/dev/null || true

    # App icon: the Clotch logo (#31) replaces AppIcon.icon (Icon Composer) and
    # Sources/Clotch/Resources/AppIcon.icns; nothing else changes here.
    echo "Compiling app icon assets..."
    xcrun actool \
        --output-format human-readable-text \
        --warnings \
        --errors \
        --notices \
        --platform macosx \
        --target-device mac \
        --minimum-deployment-target 14.0 \
        --app-icon AppIcon \
        --output-partial-info-plist "$ICON_INFO_PLIST" \
        --compile "$APP_BUNDLE/Contents/Resources" \
        "$ICON_CATALOG" \
        "$ICON_SOURCE"
    cp "Sources/Clotch/Resources/AppIcon.icns" "$APP_BUNDLE/Contents/Resources/AppIcon.icns"

    # Copy SPM resource bundles into Contents/Resources/ (required for code signing)
    for bundle in "$ARM_DIR"/*.bundle; do
        if [ -e "$bundle" ]; then
            cp -R "$bundle" "$APP_BUNDLE/Contents/Resources/"
            break
        fi
    done

    ENTITLEMENTS="Clotch.entitlements"

    # Use SIGN_ID env var, or auto-detect: prefer "Developer ID Application" for distribution,
    # fall back to any valid identity, then ad-hoc. Sign by SHA-1: two certificates with the
    # same name make the name ambiguous to codesign.
    if [ -z "${SIGN_ID:-}" ]; then
        IDS=$(security find-identity -v -p codesigning 2>/dev/null | grep -v "REVOKED" | grep '"' || true)
        LINE=$(echo "$IDS" | grep "Developer ID Application" | head -1 || true)
        [ -n "$LINE" ] || LINE=$(echo "$IDS" | head -1)
        SIGN_ID=$(echo "$LINE" | awk '{print $2}')
        SIGN_NAME=$(echo "$LINE" | sed 's/.*"\(.*\)".*/\1/')
    fi
    if [ -z "$SIGN_ID" ]; then
        echo "No developer certificate found, using ad-hoc signing..."
        SIGN_ID="-"
    fi
    SIGN_NAME="${SIGN_NAME:-$SIGN_ID}"

    echo "Code signing ($SIGN_NAME)..."
    # Sign embedded frameworks first (inside-out).
    SPARKLE_FW="$APP_BUNDLE/Contents/Frameworks/Sparkle.framework"
    # Sign nested helpers inside Sparkle before the framework itself.
    for xpc in "$SPARKLE_FW/Versions/B/XPCServices/"*.xpc; do
        [ -e "$xpc" ] || continue
        codesign --force --options runtime --sign "$SIGN_ID" "$xpc"
    done
    if [ -d "$SPARKLE_FW/Versions/B/Updater.app" ]; then
        codesign --force --options runtime --sign "$SIGN_ID" "$SPARKLE_FW/Versions/B/Updater.app"
    fi
    if [ -e "$SPARKLE_FW/Versions/B/Autoupdate" ]; then
        codesign --force --options runtime --sign "$SIGN_ID" "$SPARKLE_FW/Versions/B/Autoupdate"
    fi
    codesign --force --options runtime --sign "$SIGN_ID" "$SPARKLE_FW"

    codesign --force --options runtime --sign "$SIGN_ID" "$APP_BUNDLE/Contents/Helpers/clotch-bridge"
    codesign --force --options runtime --sign "$SIGN_ID" --entitlements "$ENTITLEMENTS" "$APP_BUNDLE"

    if [ "$NOTARIZE" = true ] && [[ "$SIGN_NAME" == *"Developer ID"* ]]; then
        echo "Creating ZIP for notarization..."
        ZIP_PATH="$BUILD_DIR/$APP_NAME.zip"
        ditto -c -k --keepParent "$APP_BUNDLE" "$ZIP_PATH"

        echo "Submitting for notarization..."
        if notarize "$ZIP_PATH"; then
            echo "Stapling notarization ticket..."
            xcrun stapler staple "$APP_BUNDLE"
        else
            echo "ERROR: Notarization failed. Run 'xcrun notarytool log <submission-id> --keychain-profile clotch' for details."
            rm -f "$ZIP_PATH"
            exit 1
        fi
        rm -f "$ZIP_PATH"

        echo "Creating DMG..."
        DMG_PATH="$BUILD_DIR/$APP_NAME.dmg"
        rm -f "$DMG_PATH"
        if command -v create-dmg >/dev/null 2>&1; then
            create-dmg \
                --volname "$APP_NAME" \
                --window-pos 200 120 \
                --window-size 600 400 \
                --icon-size 100 \
                --icon "$APP_NAME.app" 150 185 \
                --app-drop-link 450 185 \
                --no-internet-enable \
                "$DMG_PATH" "$APP_BUNDLE"
        else
            echo "create-dmg not found, using hdiutil fallback..."
            DMG_STAGING="$BUILD_DIR/dmg-staging"
            rm -rf "$DMG_STAGING"
            mkdir -p "$DMG_STAGING"
            ditto "$APP_BUNDLE" "$DMG_STAGING/$APP_NAME.app"
            ln -s /Applications "$DMG_STAGING/Applications"
            hdiutil create \
                -volname "$APP_NAME" \
                -srcfolder "$DMG_STAGING" \
                -format UDZO \
                -ov \
                "$DMG_PATH"
        fi

        codesign --force --sign "$SIGN_ID" "$DMG_PATH"
        echo "Notarizing DMG..."
        if notarize "$DMG_PATH"; then
            xcrun stapler staple "$DMG_PATH"
            echo "DMG ready: $DMG_PATH"
        else
            echo "WARNING: DMG notarization failed, but app is notarized."
        fi
    fi

    echo "Done: $APP_BUNDLE"
    echo "Run: open $APP_BUNDLE"
}

build_mac

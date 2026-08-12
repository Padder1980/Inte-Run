#!/usr/bin/env python3
"""Generate ios/InteRun.xcodeproj/project.pbxproj.

The project file is generated rather than hand-maintained so that the shell-script build phase can
be written as ordinary shell here and escaped correctly on the way in. Re-run after changing build
settings; Xcode can also edit the result in place, in which case regenerate carefully or drop this.

Uses objectVersion 77 (Xcode 16+) and a synchronized root group, so new Swift files added under
ios/InteRun/ are picked up automatically with no project edit at all.
"""
import os
import pathlib
import subprocess

# ⚠️ EVERY TESTFLIGHT UPLOAD NEEDS A HIGHER BUILD NUMBER THAN THE LAST, or App Store Connect rejects
# it outright — and hand-editing a constant before each archive is exactly the step that gets
# forgotten once and then costs twenty minutes working out why the upload bounced. The commit count is
# monotonic, needs no bookkeeping, and is applied identically to all four targets (they must match, or
# the embedded watch app and widget extension are refused). Floored at 36, so it can never drop below
# a build that has already gone out.
def build_number():
    try:
        root = os.path.dirname(os.path.abspath(__file__)) + "/.."
        n = int(subprocess.run(["git", "rev-list", "--count", "HEAD"], cwd=root,
                               capture_output=True, text=True, check=True).stdout.strip())
    except Exception:
        n = 0
    return str(max(36, n))

BUILD_NUMBER = build_number()

# --- the "Embed web app" build phase ------------------------------------------------------------
# Copies the built PWA into the app bundle at build time. docs/ stays the single source of truth —
# nothing is duplicated into git, and every build picks up the latest `node web/app.ts` output.
EMBED_SCRIPT = r'''set -eu
SRC="${SRCROOT}/../docs"
DST="${BUILT_PRODUCTS_DIR}/${CONTENTS_FOLDER_PATH}/web"

if [ ! -f "${SRC}/index.html" ]; then
  echo "error: ${SRC}/index.html not found — run 'node web/app.ts' at the repo root first." >&2
  exit 1
fi

mkdir -p "${DST}"
# Dev-only pages and the owner's private roadmap never ship.
rsync -a --delete \
  --exclude 'coverage.html' \
  --exclude 'walkthrough.html' \
  --exclude 'roadmap' \
  --exclude 'mapstyles' \
  "${SRC}/" "${DST}/"
echo "note: embedded web app ($(du -sh "${DST}" | cut -f1)) from ${SRC}"

# ⚠️ THE MAPBOX TOKEN TRAVELS WITH THE APP AND NEVER WITH THE REPO. docs/ is committed and is served
# publicly by GitHub Pages, so a token written into the built page would be published and scraped —
# and a Mapbox token is billable. It lives in ios/mapbox-token.txt, which is gitignored, and is copied
# into the bundle here at build time. Same two-tier shape as the personal voice packs: the public
# build has no key in it, the owner's build does.
# ⚠️ Absent is the NORMAL case, not an error — a checkout without the file simply builds on the free
# CARTO maps, which is what anyone else cloning this repo should get.
# ⚠️ VALIDATE IT, DO NOT JUST COPY IT. The first version copied whatever the file held and announced
# "embedded a Mapbox token" — and the owner, following an instruction of mine literally, had a file
# containing the words PASTE_YOUR_TOKEN_HERE. Swift's pk. guard refused it correctly and the app fell
# back to the free maps, so nothing broke; but the build said the opposite of what it had done, which
# is how someone spends an evening wondering why their maps have not changed.
TOK="${SRCROOT}/mapbox-token.txt"
rm -f "${DST}/mapbox-token.txt"
if [ -f "${TOK}" ]; then
  VAL=$(tr -d " \t\r\n" < "${TOK}")
  case "${VAL}" in
    pk.*) printf '%s' "${VAL}" > "${DST}/mapbox-token.txt"
          echo "note: embedded a Mapbox token — maps will use Mapbox" ;;
    sk.*) echo "warning: ios/mapbox-token.txt holds a SECRET token (sk.). Refusing to ship it — a secret token must never go in an app. Maps will use the free CARTO styles." ;;
    "")   echo "note: ios/mapbox-token.txt is empty — maps will use the free CARTO styles" ;;
    *)    echo "warning: ios/mapbox-token.txt does not contain a Mapbox token (they begin with pk.). Maps will use the free CARTO styles." ;;
  esac
else
  echo "note: no ios/mapbox-token.txt — maps will use the free CARTO styles"
fi
'''


def pbx_string(s: str) -> str:
    """Quote a Python string as a pbxproj string literal."""
    out = s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n").replace("\t", "\\t")
    return '"%s"' % out


ID = {name: "1A%022X" % (i + 1) for i, name in enumerate([
    "project", "target", "product", "syncGroup", "rootGroup", "productsGroup",
    "sourcesPhase", "frameworksPhase", "resourcesPhase", "embedPhase",
    "projConfigList", "targetConfigList",
    "projDebug", "projRelease", "targetDebug", "targetRelease", "infoPlistRef",
    # The watchOS app: a modern single-target watch app (WKApplication), embedded in the iOS app.
    "wTarget", "wProduct", "wSyncGroup", "wSourcesPhase", "wFrameworksPhase", "wResourcesPhase",
    "wConfigList", "wDebug", "wRelease", "wInfoPlistRef",
    "embedWatchPhase", "wBuildFile", "wDependency", "wProxy",
    # The widget extension, which exists solely to render the run's Live Activity. A Live Activity
    # cannot be drawn by the app itself — WidgetKit requires an extension — so this target is a
    # requirement of the feature, not a convenience.
    "xTarget", "xProduct", "xSyncGroup", "xSourcesPhase", "xFrameworksPhase", "xResourcesPhase",
    "xConfigList", "xDebug", "xRelease", "xInfoPlistRef",
    "embedExtPhase", "xBuildFile", "xDependency", "xProxy",
    # Shared between the app and the extension: the Live Activity's attributes must be one file.
    "sharedSyncGroup",
    # The UI-test bundle. Exists because the keyboard-pan bug class can only be reproduced with a
    # REAL tap gesture raising the REAL software keyboard - neither a desktop browser nor
    # programmatic focus() can do it, so without this target every keyboard fix ships blind and
    # gets proven (or disproven) on the owner's phone.
    "uTarget", "uProduct", "uSyncGroup", "uSourcesPhase", "uFrameworksPhase", "uResourcesPhase",
    "uConfigList", "uDebug", "uRelease", "uDependency", "uProxy",
])}

BUNDLE_ID = "com.interun.app"

# Your Apple Developer Team ID, needed to build onto a real iPhone or Watch.
#
# Read from the environment or from ios/team.txt (gitignored) rather than typed in here, because
# this script OVERWRITES the project file: a Team set through Xcode's UI would be silently lost the
# next time anyone regenerates. Put it in one of those two places and it survives.
#
#   echo ABCDE12345 > ios/team.txt
#
# Find it in Xcode > Settings > Accounts > (your account) > the Team ID column, or at
# developer.apple.com > Membership. Leave unset to keep simulator-only builds working.
def _team():
    env = os.environ.get("DEVELOPMENT_TEAM", "").strip()
    if env:
        return env
    f = pathlib.Path(__file__).resolve().parent / "team.txt"
    return f.read_text(encoding="utf-8").strip() if f.exists() else ""

DEVELOPMENT_TEAM = _team()
DEPLOYMENT_TARGET = "17.0"

WATCH_BUNDLE_ID = BUNDLE_ID + ".watchkitapp"
# 10.0, not the newest available. A watch app whose minimum is higher than the watch's actual
# watchOS silently fails to install, with no useful error anywhere - and people routinely update the
# phone while leaving the watch behind. 10.0 covers Series 4 and later and costs nothing: everything
# this app uses (HKWorkoutSession, NowPlayingView, NavigationStack, water lock) exists there.
WATCH_DEPLOYMENT_TARGET = "10.0"

WATCH_COMMON = {
    "ASSETCATALOG_COMPILER_APPICON_NAME": "AppIcon",
    "CODE_SIGN_ENTITLEMENTS": '"InteRunWatch.entitlements"',
    "CODE_SIGN_STYLE": "Automatic",
    "CURRENT_PROJECT_VERSION": BUILD_NUMBER,
    "GENERATE_INFOPLIST_FILE": "NO",
    "INFOPLIST_FILE": '"InteRunWatch-Info.plist"',
    "MARKETING_VERSION": "1.0",
    "PRODUCT_BUNDLE_IDENTIFIER": WATCH_BUNDLE_ID,
    "PRODUCT_NAME": '"$(TARGET_NAME)"',
    # ⚠️ Without this the watch app ships with InteRunWatch.debug.dylib and __preview.dylib
    # alongside its binary (Xcode 16+ builds Debug that way for SwiftUI Previews), and a real Apple
    # Watch refuses the install with "This app cannot be installed because its integrity could not
    # be verified" - even though the signature verifies perfectly on the Mac. Costs only in-app
    # previews for the watch target, which is a trivial price for being installable.
    "ENABLE_DEBUG_DYLIB": "NO",
    # Standard architectures (arm64 + arm64_32). arm64 is required by Apple's upload validator;
    # ENABLE_DEBUG_DYLIB=NO above is what prevents the "integrity could not be verified" install
    # failure on real devices, so there is no longer any reason to exclude arm64.
    "SDKROOT": "watchos",
    "SKIP_INSTALL": "YES",
    "SWIFT_EMIT_LOC_STRINGS": "YES",
    "SWIFT_VERSION": "5.0",
    "TARGETED_DEVICE_FAMILY": "4",
    "WATCHOS_DEPLOYMENT_TARGET": WATCH_DEPLOYMENT_TARGET,
}

WIDGET_BUNDLE_ID = BUNDLE_ID + ".widgets"

WIDGET_COMMON = {
    "ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME": "AccentColor",
    "CODE_SIGN_STYLE": "Automatic",
    "CURRENT_PROJECT_VERSION": BUILD_NUMBER,
    "GENERATE_INFOPLIST_FILE": "NO",
    "INFOPLIST_FILE": '"InteRunWidgets-Info.plist"',
    # ⚠️ An app extension's version MUST match the app's, or the build fails validation at install.
    "MARKETING_VERSION": "1.0",
    "PRODUCT_BUNDLE_IDENTIFIER": WIDGET_BUNDLE_ID,
    "PRODUCT_NAME": '"$(TARGET_NAME)"',
    "SKIP_INSTALL": "YES",
    "SWIFT_EMIT_LOC_STRINGS": "YES",
    "SWIFT_VERSION": "5.0",
    "TARGETED_DEVICE_FAMILY": "1",
    "IPHONEOS_DEPLOYMENT_TARGET": DEPLOYMENT_TARGET,
    "LD_RUNPATH_SEARCH_PATHS": '("$(inherited)", "@executable_path/Frameworks", "@executable_path/../../Frameworks")',
    # Same reason as the watch target: debug dylibs beside an extension binary break installs.
    "ENABLE_DEBUG_DYLIB": "NO",
}

UITEST_COMMON = {
    "CODE_SIGN_STYLE": "Automatic",
    "CURRENT_PROJECT_VERSION": BUILD_NUMBER,
    "GENERATE_INFOPLIST_FILE": "YES",
    "MARKETING_VERSION": "1.0",
    "PRODUCT_BUNDLE_IDENTIFIER": BUNDLE_ID + ".uitests",
    "PRODUCT_NAME": '"$(TARGET_NAME)"',
    "SWIFT_EMIT_LOC_STRINGS": "NO",
    "SWIFT_VERSION": "5.0",
    "TARGETED_DEVICE_FAMILY": "1",
    "IPHONEOS_DEPLOYMENT_TARGET": DEPLOYMENT_TARGET,
    "LD_RUNPATH_SEARCH_PATHS": '("$(inherited)", "@executable_path/Frameworks", "@loader_path/Frameworks")',
    # Which app the runner launches and instruments.
    "TEST_TARGET_NAME": "InteRun",
}

PROJECT_COMMON = {
    "ALWAYS_SEARCH_USER_PATHS": "NO",
    "CLANG_ANALYZER_NONNULL": "YES",
    "CLANG_ENABLE_MODULES": "YES",
    "CLANG_ENABLE_OBJC_ARC": "YES",
    "CLANG_WARN_DOCUMENTATION_COMMENTS": "YES",
    "CLANG_WARN_UNGUARDED_AVAILABILITY": "YES_AGGRESSIVE",
    "COPY_PHASE_STRIP": "NO",
    # The "Embed web app" phase reads ../docs and writes into the bundle; script sandboxing would
    # block both. Turning it off is deliberate, not an oversight.
    "ENABLE_USER_SCRIPT_SANDBOXING": "NO",
    "ENABLE_STRICT_OBJC_MSGSEND": "YES",
    "GCC_C_LANGUAGE_STANDARD": "gnu17",
    "GCC_NO_COMMON_BLOCKS": "YES",
    "IPHONEOS_DEPLOYMENT_TARGET": DEPLOYMENT_TARGET,
    "LOCALIZATION_PREFERS_STRING_CATALOGS": "YES",
    "MTL_FAST_MATH": "YES",
    "SDKROOT": "iphoneos",
    "SWIFT_VERSION": "5.0",
}

PROJECT_DEBUG = {
    "DEBUG_INFORMATION_FORMAT": "dwarf",
    "ENABLE_TESTABILITY": "YES",
    "GCC_OPTIMIZATION_LEVEL": "0",
    "GCC_PREPROCESSOR_DEFINITIONS": '("DEBUG=1", "$(inherited)")',
    "MTL_ENABLE_DEBUG_INFO": "INCLUDE_SOURCE",
    "ONLY_ACTIVE_ARCH": "YES",
    "SWIFT_ACTIVE_COMPILATION_CONDITIONS": '"DEBUG $(inherited)"',
    "SWIFT_OPTIMIZATION_LEVEL": '"-Onone"',
}

PROJECT_RELEASE = {
    "DEBUG_INFORMATION_FORMAT": '"dwarf-with-dsym"',
    "ENABLE_NS_ASSERTIONS": "NO",
    "MTL_ENABLE_DEBUG_INFO": "NO",
    "SWIFT_COMPILATION_MODE": "wholemodule",
    "VALIDATE_PRODUCT": "YES",
}

TARGET_COMMON = {
    "ASSETCATALOG_COMPILER_APPICON_NAME": "AppIcon",
    "ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME": "AccentColor",
    "CODE_SIGN_STYLE": "Automatic",
    "CURRENT_PROJECT_VERSION": BUILD_NUMBER,
    "ENABLE_PREVIEWS": "YES",
    "GENERATE_INFOPLIST_FILE": "NO",
    "CODE_SIGN_ENTITLEMENTS": '"InteRun.entitlements"',
    "INFOPLIST_FILE": '"InteRun-Info.plist"',
    "LD_RUNPATH_SEARCH_PATHS": '("$(inherited)", "@executable_path/Frameworks")',
    "MARKETING_VERSION": "1.0",
    "PRODUCT_BUNDLE_IDENTIFIER": BUNDLE_ID,
    "PRODUCT_NAME": '"$(TARGET_NAME)"',
    "SUPPORTS_MACCATALYST": "NO",
    "SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD": "NO",
    "SUPPORTS_XR_DESIGNED_FOR_IPHONE_IPAD": "NO",
    "SWIFT_EMIT_LOC_STRINGS": "YES",
    "TARGETED_DEVICE_FAMILY": "1",
}
if DEVELOPMENT_TEAM:
    TARGET_COMMON["DEVELOPMENT_TEAM"] = DEVELOPMENT_TEAM
    WATCH_COMMON["DEVELOPMENT_TEAM"] = DEVELOPMENT_TEAM
    WIDGET_COMMON["DEVELOPMENT_TEAM"] = DEVELOPMENT_TEAM
    UITEST_COMMON["DEVELOPMENT_TEAM"] = DEVELOPMENT_TEAM


def settings_block(d, indent="\t\t\t\t"):
    return "".join("%s%s = %s;\n" % (indent, k, v) for k, v in sorted(d.items()))


def build_config(cid, name, settings):
    return (
        "\t\t%s /* %s */ = {\n"
        "\t\t\tisa = XCBuildConfiguration;\n"
        "\t\t\tbuildSettings = {\n"
        "%s"
        "\t\t\t};\n"
        "\t\t\tname = %s;\n"
        "\t\t};\n" % (cid, name, settings_block(settings), name)
    )


def main():
    here = pathlib.Path(__file__).resolve().parent
    out_dir = here / "InteRun.xcodeproj"
    out_dir.mkdir(parents=True, exist_ok=True)

    p = []
    p.append("// !$*UTF8*$!\n{\n")
    p.append("\tarchiveVersion = 1;\n\tclasses = {\n\t};\n\tobjectVersion = 77;\n\tobjects = {\n\n")

    p.append("/* Begin PBXFileReference section */\n")
    p.append("\t\t%s /* InteRun.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; "
             "includeInIndex = 0; path = InteRun.app; sourceTree = BUILT_PRODUCTS_DIR; };\n" % ID["product"])
    p.append("\t\t%s /* InteRun-Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; "
             'path = "InteRun-Info.plist"; sourceTree = "<group>"; };\n' % ID["infoPlistRef"])
    p.append("\t\t%s /* InteRunWatch.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; "
             "includeInIndex = 0; path = InteRunWatch.app; sourceTree = BUILT_PRODUCTS_DIR; };\n" % ID["wProduct"])
    p.append("\t\t%s /* InteRunWatch-Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; "
             'path = "InteRunWatch-Info.plist"; sourceTree = "<group>"; };\n' % ID["wInfoPlistRef"])
    p.append("\t\t%s /* InteRunWidgets.appex */ = {isa = PBXFileReference; explicitFileType = \"wrapper.app-extension\"; "
             "includeInIndex = 0; path = InteRunWidgets.appex; sourceTree = BUILT_PRODUCTS_DIR; };\n" % ID["xProduct"])
    p.append("\t\t%s /* InteRunWidgets-Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; "
             'path = "InteRunWidgets-Info.plist"; sourceTree = "<group>"; };\n' % ID["xInfoPlistRef"])
    p.append("\t\t%s /* InteRunUITests.xctest */ = {isa = PBXFileReference; explicitFileType = wrapper.cfbundle; "
             "includeInIndex = 0; path = InteRunUITests.xctest; sourceTree = BUILT_PRODUCTS_DIR; };\n" % ID["uProduct"])
    p.append("/* End PBXFileReference section */\n\n")

    # The watch app is embedded into the iOS app under Watch/, which is how the OS finds and
    # installs it alongside the phone app.
    p.append("/* Begin PBXBuildFile section */\n")
    p.append("\t\t%s /* InteRunWatch.app in Embed Watch App */ = {isa = PBXBuildFile; fileRef = %s /* InteRunWatch.app */; "
             "settings = {ATTRIBUTES = (RemoveHeadersOnCopy, ); }; };\n" % (ID["wBuildFile"], ID["wProduct"]))
    p.append("\t\t%s /* InteRunWidgets.appex in Embed Foundation Extensions */ = {isa = PBXBuildFile; "
             "fileRef = %s /* InteRunWidgets.appex */; "
             "settings = {ATTRIBUTES = (RemoveHeadersOnCopy, ); }; };\n" % (ID["xBuildFile"], ID["xProduct"]))
    p.append("/* End PBXBuildFile section */\n\n")

    p.append("/* Begin PBXFileSystemSynchronizedRootGroup section */\n")
    p.append("\t\t%s /* InteRun */ = {\n\t\t\tisa = PBXFileSystemSynchronizedRootGroup;\n"
             '\t\t\tpath = InteRun;\n\t\t\tsourceTree = "<group>";\n\t\t};\n' % ID["syncGroup"])
    p.append("\t\t%s /* InteRunWatch */ = {\n\t\t\tisa = PBXFileSystemSynchronizedRootGroup;\n"
             '\t\t\tpath = InteRunWatch;\n\t\t\tsourceTree = "<group>";\n\t\t};\n' % ID["wSyncGroup"])
    p.append("\t\t%s /* InteRunWidgets */ = {\n\t\t\tisa = PBXFileSystemSynchronizedRootGroup;\n"
             '\t\t\tpath = InteRunWidgets;\n\t\t\tsourceTree = "<group>";\n\t\t};\n' % ID["xSyncGroup"])
    # Belongs to BOTH the app and the extension: the Live Activity's attributes have to be the same
    # type on each side, and a copied file is a bug waiting to happen.
    p.append("\t\t%s /* InteRunShared */ = {\n\t\t\tisa = PBXFileSystemSynchronizedRootGroup;\n"
             '\t\t\tpath = InteRunShared;\n\t\t\tsourceTree = "<group>";\n\t\t};\n' % ID["sharedSyncGroup"])
    p.append("\t\t%s /* InteRunUITests */ = {\n\t\t\tisa = PBXFileSystemSynchronizedRootGroup;\n"
             '\t\t\tpath = InteRunUITests;\n\t\t\tsourceTree = "<group>";\n\t\t};\n' % ID["uSyncGroup"])
    p.append("/* End PBXFileSystemSynchronizedRootGroup section */\n\n")

    p.append("/* Begin PBXFrameworksBuildPhase section */\n")
    p.append("\t\t%s /* Frameworks */ = {\n\t\t\tisa = PBXFrameworksBuildPhase;\n"
             "\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n"
             "\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};\n" % ID["frameworksPhase"])
    p.append("\t\t%s /* Frameworks */ = {\n\t\t\tisa = PBXFrameworksBuildPhase;\n"
             "\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n"
             "\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};\n" % ID["wFrameworksPhase"])
    p.append("\t\t%s /* Frameworks */ = {\n\t\t\tisa = PBXFrameworksBuildPhase;\n"
             "\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n"
             "\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};\n" % ID["xFrameworksPhase"])
    p.append("\t\t%s /* Frameworks */ = {\n\t\t\tisa = PBXFrameworksBuildPhase;\n"
             "\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n"
             "\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};\n" % ID["uFrameworksPhase"])
    p.append("/* End PBXFrameworksBuildPhase section */\n\n")

    p.append("/* Begin PBXCopyFilesBuildPhase section */\n")
    p.append("\t\t%s /* Embed Watch App */ = {\n"
             "\t\t\tisa = PBXCopyFilesBuildPhase;\n"
             "\t\t\tbuildActionMask = 2147483647;\n"
             '\t\t\tdstPath = "$(CONTENTS_FOLDER_PATH)/Watch";\n'
             "\t\t\tdstSubfolderSpec = 16;\n"
             "\t\t\tfiles = (\n\t\t\t\t%s /* InteRunWatch.app in Embed Watch App */,\n\t\t\t);\n"
             '\t\t\tname = "Embed Watch App";\n'
             "\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};\n"
             % (ID["embedWatchPhase"], ID["wBuildFile"]))
    p.append("\t\t%s /* Embed Foundation Extensions */ = {\n"
             "\t\t\tisa = PBXCopyFilesBuildPhase;\n"
             "\t\t\tbuildActionMask = 2147483647;\n"
             '\t\t\tdstPath = "";\n'
             "\t\t\tdstSubfolderSpec = 13;\n"
             "\t\t\tfiles = (\n\t\t\t\t%s /* InteRunWidgets.appex in Embed Foundation Extensions */,\n\t\t\t);\n"
             '\t\t\tname = "Embed Foundation Extensions";\n'
             "\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};\n"
             % (ID["embedExtPhase"], ID["xBuildFile"]))
    p.append("/* End PBXCopyFilesBuildPhase section */\n\n")

    p.append("/* Begin PBXGroup section */\n")
    p.append("\t\t%s = {\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n"
             "\t\t\t\t%s /* InteRun */,\n\t\t\t\t%s /* InteRunWatch */,\n"
             "\t\t\t\t%s /* InteRunWidgets */,\n\t\t\t\t%s /* InteRunShared */,\n"
             "\t\t\t\t%s /* InteRun-Info.plist */,\n\t\t\t\t%s /* InteRunWatch-Info.plist */,\n"
             "\t\t\t\t%s /* InteRunWidgets-Info.plist */,\n"
             "\t\t\t\t%s /* InteRunUITests */,\n"
             "\t\t\t\t%s /* Products */,\n"
             '\t\t\t);\n\t\t\tsourceTree = "<group>";\n\t\t};\n'
             % (ID["rootGroup"], ID["syncGroup"], ID["wSyncGroup"], ID["xSyncGroup"],
                ID["sharedSyncGroup"], ID["infoPlistRef"], ID["wInfoPlistRef"],
                ID["xInfoPlistRef"], ID["uSyncGroup"], ID["productsGroup"]))
    p.append("\t\t%s /* Products */ = {\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n"
             "\t\t\t\t%s /* InteRun.app */,\n\t\t\t\t%s /* InteRunWatch.app */,\n"
             "\t\t\t\t%s /* InteRunWidgets.appex */,\n\t\t\t\t%s /* InteRunUITests.xctest */,\n\t\t\t);\n\t\t\tname = Products;\n"
             '\t\t\tsourceTree = "<group>";\n\t\t};\n'
             % (ID["productsGroup"], ID["product"], ID["wProduct"], ID["xProduct"], ID["uProduct"]))
    p.append("/* End PBXGroup section */\n\n")

    p.append("/* Begin PBXNativeTarget section */\n")
    p.append("\t\t%s /* InteRun */ = {\n"
             "\t\t\tisa = PBXNativeTarget;\n"
             "\t\t\tbuildConfigurationList = %s /* Build configuration list for PBXNativeTarget \"InteRun\" */;\n"
             "\t\t\tbuildPhases = (\n"
             "\t\t\t\t%s /* Sources */,\n"
             "\t\t\t\t%s /* Frameworks */,\n"
             "\t\t\t\t%s /* Resources */,\n"
             "\t\t\t\t%s /* Embed web app */,\n"
             "\t\t\t\t%s /* Embed Watch App */,\n"
             "\t\t\t\t%s /* Embed Foundation Extensions */,\n"
             "\t\t\t);\n"
             "\t\t\tbuildRules = (\n\t\t\t);\n"
             "\t\t\tdependencies = (\n\t\t\t\t%s /* PBXTargetDependency */,\n"
             "\t\t\t\t%s /* PBXTargetDependency */,\n\t\t\t);\n"
             "\t\t\tfileSystemSynchronizedGroups = (\n\t\t\t\t%s /* InteRun */,\n"
             "\t\t\t\t%s /* InteRunShared */,\n\t\t\t);\n"
             "\t\t\tname = InteRun;\n"
             "\t\t\tproductName = InteRun;\n"
             "\t\t\tproductReference = %s /* InteRun.app */;\n"
             '\t\t\tproductType = "com.apple.product-type.application";\n'
             "\t\t};\n" % (ID["target"], ID["targetConfigList"], ID["sourcesPhase"],
                           ID["frameworksPhase"], ID["resourcesPhase"], ID["embedPhase"],
                           ID["embedWatchPhase"], ID["embedExtPhase"],
                           ID["wDependency"], ID["xDependency"],
                           ID["syncGroup"], ID["sharedSyncGroup"], ID["product"]))
    p.append("\t\t%s /* InteRunWatch */ = {\n"
             "\t\t\tisa = PBXNativeTarget;\n"
             "\t\t\tbuildConfigurationList = %s /* Build configuration list for PBXNativeTarget \"InteRunWatch\" */;\n"
             "\t\t\tbuildPhases = (\n\t\t\t\t%s /* Sources */,\n\t\t\t\t%s /* Frameworks */,\n\t\t\t\t%s /* Resources */,\n\t\t\t);\n"
             "\t\t\tbuildRules = (\n\t\t\t);\n"
             "\t\t\tdependencies = (\n\t\t\t);\n"
             "\t\t\tfileSystemSynchronizedGroups = (\n\t\t\t\t%s /* InteRunWatch */,\n\t\t\t);\n"
             "\t\t\tname = InteRunWatch;\n"
             "\t\t\tproductName = InteRunWatch;\n"
             "\t\t\tproductReference = %s /* InteRunWatch.app */;\n"
             '\t\t\tproductType = "com.apple.product-type.application";\n'
             "\t\t};\n" % (ID["wTarget"], ID["wConfigList"], ID["wSourcesPhase"],
                           ID["wFrameworksPhase"], ID["wResourcesPhase"], ID["wSyncGroup"], ID["wProduct"]))
    p.append("\t\t%s /* InteRunWidgets */ = {\n"
             "\t\t\tisa = PBXNativeTarget;\n"
             "\t\t\tbuildConfigurationList = %s /* Build configuration list for PBXNativeTarget \"InteRunWidgets\" */;\n"
             "\t\t\tbuildPhases = (\n\t\t\t\t%s /* Sources */,\n\t\t\t\t%s /* Frameworks */,\n\t\t\t\t%s /* Resources */,\n\t\t\t);\n"
             "\t\t\tbuildRules = (\n\t\t\t);\n"
             "\t\t\tdependencies = (\n\t\t\t);\n"
             "\t\t\tfileSystemSynchronizedGroups = (\n\t\t\t\t%s /* InteRunWidgets */,\n"
             "\t\t\t\t%s /* InteRunShared */,\n\t\t\t);\n"
             "\t\t\tname = InteRunWidgets;\n"
             "\t\t\tproductName = InteRunWidgets;\n"
             "\t\t\tproductReference = %s /* InteRunWidgets.appex */;\n"
             '\t\t\tproductType = "com.apple.product-type.app-extension";\n'
             "\t\t};\n" % (ID["xTarget"], ID["xConfigList"], ID["xSourcesPhase"],
                           ID["xFrameworksPhase"], ID["xResourcesPhase"],
                           ID["xSyncGroup"], ID["sharedSyncGroup"], ID["xProduct"]))
    p.append("\t\t%s /* InteRunUITests */ = {\n"
             "\t\t\tisa = PBXNativeTarget;\n"
             "\t\t\tbuildConfigurationList = %s /* Build configuration list for PBXNativeTarget \"InteRunUITests\" */;\n"
             "\t\t\tbuildPhases = (\n\t\t\t\t%s /* Sources */,\n\t\t\t\t%s /* Frameworks */,\n\t\t\t\t%s /* Resources */,\n\t\t\t);\n"
             "\t\t\tbuildRules = (\n\t\t\t);\n"
             "\t\t\tdependencies = (\n\t\t\t\t%s /* PBXTargetDependency */,\n\t\t\t);\n"
             "\t\t\tfileSystemSynchronizedGroups = (\n\t\t\t\t%s /* InteRunUITests */,\n\t\t\t);\n"
             "\t\t\tname = InteRunUITests;\n"
             "\t\t\tproductName = InteRunUITests;\n"
             "\t\t\tproductReference = %s /* InteRunUITests.xctest */;\n"
             '\t\t\tproductType = "com.apple.product-type.bundle.ui-testing";\n'
             "\t\t};\n" % (ID["uTarget"], ID["uConfigList"], ID["uSourcesPhase"],
                           ID["uFrameworksPhase"], ID["uResourcesPhase"],
                           ID["uDependency"], ID["uSyncGroup"], ID["uProduct"]))
    p.append("/* End PBXNativeTarget section */\n\n")

    p.append("/* Begin PBXTargetDependency section */\n")
    p.append("\t\t%s /* PBXTargetDependency */ = {\n\t\t\tisa = PBXTargetDependency;\n"
             "\t\t\ttarget = %s /* InteRunWatch */;\n\t\t\ttargetProxy = %s /* PBXContainerItemProxy */;\n\t\t};\n"
             % (ID["wDependency"], ID["wTarget"], ID["wProxy"]))
    p.append("\t\t%s /* PBXTargetDependency */ = {\n\t\t\tisa = PBXTargetDependency;\n"
             "\t\t\ttarget = %s /* InteRunWidgets */;\n\t\t\ttargetProxy = %s /* PBXContainerItemProxy */;\n\t\t};\n"
             % (ID["xDependency"], ID["xTarget"], ID["xProxy"]))
    p.append("\t\t%s /* PBXTargetDependency */ = {\n\t\t\tisa = PBXTargetDependency;\n"
             "\t\t\ttarget = %s /* InteRun */;\n\t\t\ttargetProxy = %s /* PBXContainerItemProxy */;\n\t\t};\n"
             % (ID["uDependency"], ID["target"], ID["uProxy"]))
    p.append("/* End PBXTargetDependency section */\n\n")

    p.append("/* Begin PBXContainerItemProxy section */\n")
    p.append("\t\t%s /* PBXContainerItemProxy */ = {\n\t\t\tisa = PBXContainerItemProxy;\n"
             "\t\t\tcontainerPortal = %s /* Project object */;\n\t\t\tproxyType = 1;\n"
             "\t\t\tremoteGlobalIDString = %s;\n\t\t\tremoteInfo = InteRunWatch;\n\t\t};\n"
             % (ID["wProxy"], ID["project"], ID["wTarget"]))
    p.append("\t\t%s /* PBXContainerItemProxy */ = {\n\t\t\tisa = PBXContainerItemProxy;\n"
             "\t\t\tcontainerPortal = %s /* Project object */;\n\t\t\tproxyType = 1;\n"
             "\t\t\tremoteGlobalIDString = %s;\n\t\t\tremoteInfo = InteRunWidgets;\n\t\t};\n"
             % (ID["xProxy"], ID["project"], ID["xTarget"]))
    p.append("\t\t%s /* PBXContainerItemProxy */ = {\n\t\t\tisa = PBXContainerItemProxy;\n"
             "\t\t\tcontainerPortal = %s /* Project object */;\n\t\t\tproxyType = 1;\n"
             "\t\t\tremoteGlobalIDString = %s;\n\t\t\tremoteInfo = InteRun;\n\t\t};\n"
             % (ID["uProxy"], ID["project"], ID["target"]))
    p.append("/* End PBXContainerItemProxy section */\n\n")

    p.append("/* Begin PBXProject section */\n")
    p.append("\t\t%s /* Project object */ = {\n"
             "\t\t\tisa = PBXProject;\n"
             "\t\t\tattributes = {\n"
             "\t\t\t\tBuildIndependentTargetsInParallel = 1;\n"
             "\t\t\t\tLastSwiftUpdateCheck = 2700;\n"
             "\t\t\t\tLastUpgradeCheck = 2700;\n"
             "\t\t\t\tTargetAttributes = {\n"
             "\t\t\t\t\t%s = {\n\t\t\t\t\t\tCreatedOnToolsVersion = 27.0;\n\t\t\t\t\t};\n"
             "\t\t\t\t\t%s = {\n\t\t\t\t\t\tCreatedOnToolsVersion = 27.0;\n\t\t\t\t\t\tTestTargetID = %s;\n\t\t\t\t\t};\n"
             "\t\t\t\t};\n"
             "\t\t\t};\n"
             "\t\t\tbuildConfigurationList = %s /* Build configuration list for PBXProject \"InteRun\" */;\n"
             '\t\t\tdevelopmentRegion = en;\n'
             "\t\t\thasScannedForEncodings = 0;\n"
             "\t\t\tknownRegions = (\n\t\t\t\ten,\n\t\t\t\tBase,\n\t\t\t);\n"
             "\t\t\tmainGroup = %s;\n"
             "\t\t\tminimizedProjectReferenceProxies = 1;\n"
             "\t\t\tpreferredProjectObjectVersion = 77;\n"
             "\t\t\tproductRefGroup = %s /* Products */;\n"
             '\t\t\tprojectDirPath = "";\n'
             '\t\t\tprojectRoot = "";\n'
             "\t\t\ttargets = (\n\t\t\t\t%s /* InteRun */,\n\t\t\t\t%s /* InteRunWatch */,\n"
             "\t\t\t\t%s /* InteRunWidgets */,\n\t\t\t\t%s /* InteRunUITests */,\n\t\t\t);\n"
             "\t\t};\n" % (ID["project"], ID["target"], ID["uTarget"], ID["target"],
                           ID["projConfigList"], ID["rootGroup"],
                           ID["productsGroup"], ID["target"], ID["wTarget"], ID["xTarget"], ID["uTarget"]))
    p.append("/* End PBXProject section */\n\n")

    p.append("/* Begin PBXResourcesBuildPhase section */\n")
    p.append("\t\t%s /* Resources */ = {\n\t\t\tisa = PBXResourcesBuildPhase;\n"
             "\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n"
             "\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};\n" % ID["resourcesPhase"])
    p.append("\t\t%s /* Resources */ = {\n\t\t\tisa = PBXResourcesBuildPhase;\n"
             "\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n"
             "\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};\n" % ID["wResourcesPhase"])
    p.append("\t\t%s /* Resources */ = {\n\t\t\tisa = PBXResourcesBuildPhase;\n"
             "\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n"
             "\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};\n" % ID["xResourcesPhase"])
    p.append("\t\t%s /* Resources */ = {\n\t\t\tisa = PBXResourcesBuildPhase;\n"
             "\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n"
             "\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};\n" % ID["uResourcesPhase"])
    p.append("/* End PBXResourcesBuildPhase section */\n\n")

    p.append("/* Begin PBXShellScriptBuildPhase section */\n")
    p.append("\t\t%s /* Embed web app */ = {\n"
             "\t\t\tisa = PBXShellScriptBuildPhase;\n"
             "\t\t\talwaysOutOfDate = 1;\n"
             "\t\t\tbuildActionMask = 2147483647;\n"
             "\t\t\tfiles = (\n\t\t\t);\n"
             "\t\t\tinputFileListPaths = (\n\t\t\t);\n"
             "\t\t\tinputPaths = (\n\t\t\t);\n"
             '\t\t\tname = "Embed web app";\n'
             "\t\t\toutputFileListPaths = (\n\t\t\t);\n"
             "\t\t\toutputPaths = (\n\t\t\t);\n"
             "\t\t\trunOnlyForDeploymentPostprocessing = 0;\n"
             "\t\t\tshellPath = /bin/sh;\n"
             "\t\t\tshellScript = %s;\n"
             "\t\t};\n" % (ID["embedPhase"], pbx_string(EMBED_SCRIPT)))
    p.append("/* End PBXShellScriptBuildPhase section */\n\n")

    p.append("/* Begin PBXSourcesBuildPhase section */\n")
    p.append("\t\t%s /* Sources */ = {\n\t\t\tisa = PBXSourcesBuildPhase;\n"
             "\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n"
             "\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};\n" % ID["sourcesPhase"])
    p.append("\t\t%s /* Sources */ = {\n\t\t\tisa = PBXSourcesBuildPhase;\n"
             "\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n"
             "\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};\n" % ID["wSourcesPhase"])
    p.append("\t\t%s /* Sources */ = {\n\t\t\tisa = PBXSourcesBuildPhase;\n"
             "\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n"
             "\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};\n" % ID["xSourcesPhase"])
    p.append("\t\t%s /* Sources */ = {\n\t\t\tisa = PBXSourcesBuildPhase;\n"
             "\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n"
             "\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};\n" % ID["uSourcesPhase"])
    p.append("/* End PBXSourcesBuildPhase section */\n\n")

    p.append("/* Begin XCBuildConfiguration section */\n")
    dbg = dict(PROJECT_COMMON); dbg.update(PROJECT_DEBUG)
    rel = dict(PROJECT_COMMON); rel.update(PROJECT_RELEASE)
    p.append(build_config(ID["projDebug"], "Debug", dbg))
    p.append(build_config(ID["projRelease"], "Release", rel))
    p.append(build_config(ID["targetDebug"], "Debug", TARGET_COMMON))
    p.append(build_config(ID["targetRelease"], "Release", TARGET_COMMON))
    p.append(build_config(ID["wDebug"], "Debug", WATCH_COMMON))
    p.append(build_config(ID["wRelease"], "Release", WATCH_COMMON))
    p.append(build_config(ID["xDebug"], "Debug", WIDGET_COMMON))
    p.append(build_config(ID["xRelease"], "Release", WIDGET_COMMON))
    p.append(build_config(ID["uDebug"], "Debug", UITEST_COMMON))
    p.append(build_config(ID["uRelease"], "Release", UITEST_COMMON))
    p.append("/* End XCBuildConfiguration section */\n\n")

    p.append("/* Begin XCConfigurationList section */\n")
    for cid, label, d, r in (
        (ID["projConfigList"], 'PBXProject "InteRun"', ID["projDebug"], ID["projRelease"]),
        (ID["targetConfigList"], 'PBXNativeTarget "InteRun"', ID["targetDebug"], ID["targetRelease"]),
        (ID["wConfigList"], 'PBXNativeTarget "InteRunWatch"', ID["wDebug"], ID["wRelease"]),
        (ID["xConfigList"], 'PBXNativeTarget "InteRunWidgets"', ID["xDebug"], ID["xRelease"]),
        (ID["uConfigList"], 'PBXNativeTarget "InteRunUITests"', ID["uDebug"], ID["uRelease"]),
    ):
        p.append("\t\t%s /* Build configuration list for %s */ = {\n"
                 "\t\t\tisa = XCConfigurationList;\n"
                 "\t\t\tbuildConfigurations = (\n\t\t\t\t%s /* Debug */,\n\t\t\t\t%s /* Release */,\n\t\t\t);\n"
                 "\t\t\tdefaultConfigurationIsVisible = 0;\n"
                 "\t\t\tdefaultConfigurationName = Release;\n\t\t};\n" % (cid, label, d, r))
    p.append("/* End XCConfigurationList section */\n")

    p.append("\t};\n\trootObject = %s /* Project object */;\n}\n" % ID["project"])

    path = out_dir / "project.pbxproj"
    path.write_text("".join(p), encoding="utf-8")
    print("wrote", path)

    # A shared scheme so `xcodebuild test -scheme InteRunUITests` works headlessly. Xcode's
    # auto-generated schemes live in per-user folders that a fresh checkout does not have.
    schemes = out_dir / "xcshareddata" / "xcschemes"
    schemes.mkdir(parents=True, exist_ok=True)
    scheme = """<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2700" version="1.7">
  <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES">
    <BuildActionEntries>
      <BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="NO" buildForArchiving="NO" buildForAnalyzing="YES">
        <BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="%(app)s" BuildableName="InteRun.app" BlueprintName="InteRun" ReferencedContainer="container:InteRun.xcodeproj"/>
      </BuildActionEntry>
    </BuildActionEntries>
  </BuildAction>
  <TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.DebuggerFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES">
    <Testables>
      <TestableReference skipped="NO">
        <BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="%(ut)s" BuildableName="InteRunUITests.xctest" BlueprintName="InteRunUITests" ReferencedContainer="container:InteRun.xcodeproj"/>
      </TestableReference>
    </Testables>
  </TestAction>
  <LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.DebuggerFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES">
    <BuildableProductRunnable runnableDebuggingMode="0">
      <BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="%(app)s" BuildableName="InteRun.app" BlueprintName="InteRun" ReferencedContainer="container:InteRun.xcodeproj"/>
    </BuildableProductRunnable>
  </LaunchAction>
</Scheme>
""" % {"app": ID["target"], "ut": ID["uTarget"]}
    (schemes / "InteRunUITests.xcscheme").write_text(scheme, encoding="utf-8")
    print("wrote", schemes / "InteRunUITests.xcscheme")


if __name__ == "__main__":
    main()

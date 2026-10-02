// Console errors that aren't the page's fault, so the e2e tests don't fail a page on them:
//  - blocked hosts log "Failed to load resource" / net::ERR_ / blockedbyclient: the tests' network guard working;
//  - WebKit on Linux (CI) logs that it ignores the viewport's interactive-widget key, which Chrome on Android uses to
//    keep a sheet above the keyboard (engine/build.mjs). Browsers that don't know it ignore it; nothing breaks.
export const CONSOLE_NOISE = /Failed to load resource|net::ERR_|blockedbyclient|Viewport argument key "interactive-widget"/i;

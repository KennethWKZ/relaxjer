// Console errors that aren't the page's fault, so the e2e tests don't fail a page on them: blocked hosts log "Failed to
// load resource" / net::ERR_ / blockedbyclient, which is the tests' network guard working. Anything else the page logs
// is a bug, a browser's notice about the page's own markup included.
export const CONSOLE_NOISE = /Failed to load resource|net::ERR_|blockedbyclient/i;

// Console errors that aren't the page's fault, so the e2e tests don't fail a page on them: blocked hosts log "Failed to
// load resource" / net::ERR_ / blockedbyclient, which is the tests' network guard working. Anything else the page logs
// is a bug, a browser's notice about the page's own markup included.
export const CONSOLE_NOISE = /Failed to load resource|net::ERR_|blockedbyclient/i;

// A page error that isn't the page's either: as a reload or a close tears a page down, WebKit can report a fetch the
// navigation cancelled as an uncaught "<url> due to access control checks.", although the page caught it (CI saw it for
// the page's own file and for the map's tile probe, both caught). A real refusal still fails the test: WebKit logs it
// to the console too, and that stays checked.
export const TEARDOWN_NOISE = /\bdue to access control checks\.$/;

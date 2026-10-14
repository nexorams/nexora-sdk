/**
 * SDK version sent in the User-Agent header (shown in Developer Portal request logs).
 * Must equal "version" in package.json; test/sdk.test.js enforces this.
 */
export const SDK_VERSION = '2.0.0';
export const USER_AGENT = `Nexora-Node-SDK/${SDK_VERSION}`;

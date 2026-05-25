import releaseManifest from "../../../../config/release-manifest.json" with { type: "json" };

export const APP_NAME = releaseManifest.appName;
export const APP_VERSION = releaseManifest.version;
export const APP_DISPLAY_VERSION = releaseManifest.displayVersion;
export const APP_RELEASE_DATE = releaseManifest.releaseDate;
export const APP_RELEASE_NOTES = releaseManifest.releaseNotes;

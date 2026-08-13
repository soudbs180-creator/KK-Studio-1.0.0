import releaseManifest from "../../../../config/release-manifest.json" with { type: "json" };

export const APP_NAME = releaseManifest.appName;
export const APP_VERSION = releaseManifest.releasedVersion;
export const APP_DISPLAY_VERSION = releaseManifest.displayVersion;
export const APP_RELEASE_TARGET = releaseManifest.releaseTarget;
export const APP_RELEASE_PHASE = releaseManifest.releasePhase;
export const APP_RELEASE_SEQUENCE = releaseManifest.releaseSequence;
export const APP_ARTIFACT_VERSION = releaseManifest.artifactVersion;
export const APP_RELEASE_DATE = releaseManifest.releaseDate;
export const APP_RELEASE_NOTES = releaseManifest.releaseNotes;

// Transitional shim: keep the historical module path stable while the codebase
// converges on cloud-record naming. The implementation now lives in
// `userApiCloudRecordStorage.ts` and no longer performs direct profile I/O.
export * from './userApiCloudRecordStorage.ts';

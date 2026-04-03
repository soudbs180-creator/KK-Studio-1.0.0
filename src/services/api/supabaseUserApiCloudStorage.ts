// Transitional shim: keep the historical module path stable while the codebase
// converges on cloud-record naming. The implementation now lives in
// `userApiCloudRecordStorage.ts` and no longer performs direct profile I/O.
export {
  loadUserApisPayloadMetadataFromCloudRecord as loadUserApisPayloadMetadataViaSupabase,
  loadUserApisPayloadFromCloudRecord as loadUserApisPayloadViaSupabase,
  saveUserApisPayloadToCloudRecord as saveUserApisPayloadViaSupabase,
  upsertUserApiSlotToCloudRecord as upsertUserApiSlotViaSupabase,
  removeUserApiSlotFromCloudRecord as removeUserApiSlotViaSupabase,
  upsertUserApiProviderToCloudRecord as upsertUserApiProviderViaSupabase,
  removeUserApiProviderFromCloudRecord as removeUserApiProviderViaSupabase,
  mergeUserApisPayloadToCloudRecord as mergeUserApisPayloadViaSupabase,
} from './userApiCloudRecordStorage.ts';
export * from './userApiCloudRecordStorage.ts';

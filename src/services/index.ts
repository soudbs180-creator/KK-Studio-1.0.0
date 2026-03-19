// Services
export { supplierService, type Supplier, type SupplierModel } from './billing/supplierService';
export { newApiManagementService, type NewAPIModel, type NewAPIChannel } from './api/newApiManagementService';
export { ai12ApiService, type ChatMessage, type ChatCompletionOptions } from './api/AI12APIService';
export { modelCaller, type CallModelOptions, type CallResult } from './model/modelCaller';
export {
    nutrientDocumentService,
    type NutrientBinaryResult,
    type NutrientDocumentOperation,
    type NutrientOcrOptions,
    type NutrientRequestOptions,
    type NutrientTextResult,
} from './document/nutrientDocumentService';

// Re-export existing services
export { keyManager } from './auth/keyManager';
export { notify } from './system/notificationService';
export { supabase } from '../lib/supabase';

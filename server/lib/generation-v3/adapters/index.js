// server/lib/generation-v3/adapters/index.js
// 中文注释：统一注册 generation-v3 Provider Adapter。副作用：注册到 ProviderAdapterRegistry。

require('./openaiCompatibleImageAdapter');
require('./googleImageAdapter');
require('./wuyinImageAdapter');
require('./wuyinDocumentedAdapter');

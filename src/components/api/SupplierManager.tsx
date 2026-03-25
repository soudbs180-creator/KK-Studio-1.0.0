import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ExternalLink, RefreshCw, DollarSign, Server } from 'lucide-react';
import { supplierService, type Supplier } from '../../services/billing/supplierService';
import { SupplierModal } from './SupplierModal';
import { notify } from '../../services/system/notificationService';

interface SupplierManagerProps {
  onViewPricing?: (supplierId: string) => void;
}

export const SupplierManager: React.FC<SupplierManagerProps> = ({ onViewPricing }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  useEffect(() => {
    loadSuppliers();
    const unsubscribe = supplierService.subscribe(() => {
      setSuppliers(supplierService.getAll());
    });
    return unsubscribe;
  }, []);

  const loadSuppliers = () => {
    setSuppliers(supplierService.getAll());
  };

  const handleDelete = (supplier: Supplier) => {
    if (confirm(`确定要删除供应商 "${supplier.name}" 吗？\n相关的价格信息也会被删除。`)) {
      supplierService.delete(supplier.id);
      notify.success('删除成功', `供应商 "${supplier.name}" 已被删除`);
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditSupplier(supplier);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditSupplier(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditSupplier(null);
  };

  const handleRefreshModels = async (supplier: Supplier) => {
    if (supplierService.requiresSystemToken(supplier.baseUrl) && !supplier.systemToken) {
      notify.warning(
        '未配置 System Access Token',
        '无法刷新模型信息',
        '请先配置 System Access Token 才能获取模型列表'
      );
      return;
    }

    setRefreshingId(supplier.id);
    try {
      await supplierService.refreshModels(supplier.id);
      notify.success('刷新成功', `已从 "${supplier.name}" 获取到最新模型信息`);
    } catch (error: any) {
      notify.error('刷新失败', `无法从 "${supplier.name}" 获取模型信息`, error.message);
    } finally {
      setRefreshingId(null);
    }
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return '****';
    return key.slice(0, 4) + '****' + key.slice(-4);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">供应商管理</h2>
          <p className="mt-1 text-sm text-gray-400">
            配置第三方 API 供应商，自动获取模型和价格信息
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 font-medium text-white transition-all hover:from-blue-500 hover:to-indigo-500"
        >
          <Plus className="h-4 w-4 shrink-0" />
          添加供应商
        </button>
      </div>

      {suppliers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 bg-gray-800/50 py-12 text-center">
          <Server className="mx-auto mb-4 h-12 w-12 text-gray-600" />
          <h3 className="mb-2 text-lg font-medium text-gray-400">暂无供应商</h3>
          <p className="mb-4 text-sm text-gray-500">添加供应商以获取模型和价格信息</p>
          <button
            onClick={handleAdd}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-500"
          >
            添加第一个供应商
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {suppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="rounded-xl border border-gray-700 bg-gradient-to-br from-gray-800 to-gray-900 p-5 transition-all hover:border-gray-600"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-3">
                    <h3 className="truncate text-lg font-semibold text-white">{supplier.name}</h3>
                    <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">
                      {supplier.models.length} 模型
                    </span>
                  </div>

                  <div className="space-y-1 text-sm">
                    <p className="flex items-center gap-2 text-gray-400">
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span className="truncate">{supplier.baseUrl}</span>
                    </p>
                    <p className="text-gray-500">API Key: {maskKey(supplier.apiKey)}</p>
                    {supplier.budgetLimit ? (
                      <p className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-yellow-400">
                        <DollarSign className="h-3.5 w-3.5 shrink-0" />
                        预算限制: ${supplier.budgetLimit}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="ml-4 flex items-center gap-2">
                  {(supplier.systemToken || !supplierService.requiresSystemToken(supplier.baseUrl)) ? (
                    <button
                      onClick={() => handleRefreshModels(supplier)}
                      disabled={refreshingId === supplier.id}
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-500/10 hover:text-blue-400"
                      title="刷新模型信息"
                    >
                      <RefreshCw className={`h-4 w-4 ${refreshingId === supplier.id ? 'animate-spin' : ''}`} />
                    </button>
                  ) : null}

                  {onViewPricing ? (
                    <button
                      onClick={() => onViewPricing(supplier.id)}
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-green-500/10 hover:text-green-400"
                      title="查看定价"
                    >
                      <DollarSign className="h-4 w-4" />
                    </button>
                  ) : null}

                  <button
                    onClick={() => handleEdit(supplier)}
                    className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-500/10 hover:text-blue-400"
                    title="编辑"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(supplier)}
                    className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    title="删除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {supplier.models.length > 0 ? (
                <div className="mt-4 border-t border-gray-700 pt-4">
                  <div className="flex flex-wrap gap-2">
                    {supplier.models.slice(0, 5).map((model) => (
                      <span
                        key={model.id}
                        className="rounded bg-gray-700/50 px-2 py-1 text-xs text-gray-300"
                      >
                        {model.name}
                      </span>
                    ))}
                    {supplier.models.length > 5 ? (
                      <span className="rounded bg-gray-700/50 px-2 py-1 text-xs text-gray-500">
                        +{supplier.models.length - 5} 更多
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <SupplierModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        editSupplier={editSupplier}
      />
    </div>
  );
};

export default SupplierManager;

import React from 'react';
import { StorageSettingsView } from './StorageSettingsView.localized';

// 数据同步路由只负责选择页面；页面壳层和信息层级由存储视图统一维护，避免重复 Hero 与嵌套滚动容器。
export const DataSyncView: React.FC = () => <StorageSettingsView />;

export default DataSyncView;

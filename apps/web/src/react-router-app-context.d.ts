import 'react-router';

declare module 'react-router' {
	interface AppLoadContext {
		// 这里保留 React Router 的服务端上下文扩展点，避免覆盖原模块导出。
	}
}

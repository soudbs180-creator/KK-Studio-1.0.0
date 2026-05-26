declare module '*/+types/*' {
	export const Route: any;
	export namespace Route {
		export type ErrorBoundaryProps = {
			error?: any;
			params?: any;
		};
	}
}
declare module './+types/*' {
	export const Route: any;
	export namespace Route {
		export type ErrorBoundaryProps = {
			error?: any;
			params?: any;
		};
	}
}
declare module '../+types/*' {
	export const Route: any;
	export namespace Route {
		export type ErrorBoundaryProps = {
			error?: any;
			params?: any;
		};
	}
}
declare module './+types/root' {
	export const Route: any;
	export namespace Route {
		export type ErrorBoundaryProps = {
			error?: any;
			params?: any;
		};
	}
}
declare module './+types/not-found' {
	export const Route: any;
	export namespace Route {
		export type ErrorBoundaryProps = {
			error?: any;
			params?: any;
		};
	}
}
declare module 'virtual:design-mode' {
	export type GetStyleInfo = (resolved: any) => any;
	export function initDesignMode(getStyleInfo: GetStyleInfo): () => void;
}

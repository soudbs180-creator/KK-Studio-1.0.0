declare module 'virtual:load-fonts.jsx' {
	export function LoadFonts(): null;
}
declare module 'virtual:design-mode' {
	export type GetStyleInfo = (resolved: { element: Element }) => {
		className: unknown;
		styles: Record<string, string> | null;
	};
	export function initDesignMode(getStyleInfo: GetStyleInfo): () => void;
}
declare module 'npm:stripe' {
	import Stripe from 'stripe';
	export default Stripe;
}
declare module '@auth/create/react' {
	import { SessionProvider } from '@auth/react';
	export { SessionProvider };
}


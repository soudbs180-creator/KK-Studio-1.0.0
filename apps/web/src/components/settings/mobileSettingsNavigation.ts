import type {
  SettingsNavItem,
} from './settingsRegistry';
import { SETTINGS_NAVIGATION_GROUPS } from './settingsNavigationRegistry.ts';

/**
 * Builds the mobile navigation without a duplicate overview destination because
 * the settings landing screen already is the product overview.
 */
export function buildMobileSettingsGroups(items: SettingsNavItem[], english: boolean) {
  return SETTINGS_NAVIGATION_GROUPS.filter((group) => group.id !== 'overview').map((group) => ({
    id: group.id,
    label: english ? group.labelEn : group.labelZh,
    items: group.items
      .map((definition) => items.find((item) => item.id === definition.id))
      .filter((item): item is SettingsNavItem => Boolean(item)),
  })).filter((group) => group.items.length > 0);
}

/**
 * Keeps the mobile header predictable: the landing title uses the open back
 * slot while a nested route centers its title between back and close.
 */
export function resolveMobileSettingsTopbarState(
  atHome: boolean,
  currentTitle: string,
  homeTitle = '系统设置',
) {
  return {
    title: atHome ? homeTitle : currentTitle,
    titleAlignment: atHome ? 'start' : 'center',
    showBackButton: !atHome,
  } as const;
}

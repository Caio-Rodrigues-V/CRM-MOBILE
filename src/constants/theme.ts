/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#111B21',
    background: '#FFFFFF',
    backgroundElement: '#F0F2F5',
    backgroundSelected: '#FFE2E6',
    textSecondary: '#667781',
    primary: '#00A884', // WhatsApp Teal
    success: '#1FA855', // Active/Open
    warning: '#E17E1A', // Pending
    danger: '#EA0038',  // Closed
    chatBg: '#EFEAE2',   // Official WhatsApp light wallpaper beige
    myBubble: '#D9FDD3',  // Official WhatsApp light green bubble
    theirBubble: '#FFFFFF', // White
    border: '#E9EDEF',
  },
  dark: {
    text: '#E9EDEF',
    background: '#111B21', // Dark blue-slate
    backgroundElement: '#202C33', // WhatsApp dark element
    backgroundSelected: '#2A3942',
    textSecondary: '#8696A0',
    primary: '#00A884',
    success: '#00E676',
    warning: '#FFD600',
    danger: '#FF1744',
    chatBg: '#0B141A',   // Official WhatsApp dark wallpaper color
    myBubble: '#005C4B',  // Official WhatsApp dark green bubble
    theirBubble: '#202C33', // Official WhatsApp dark grey bubble
    border: '#222E35',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

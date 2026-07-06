import type { ThemeConfig } from 'antd';

export const brand = {
  primary: '#FF6B35',
  primaryLight: '#FF8F66',
  primaryDark: '#E85A24',
  accent: '#2EC4B6',
  accentWarm: '#FFD166',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#2EC4B6',
  text: '#292524',
  textSecondary: '#78716C',
  bg: '#FFFBF7',
  bgElevated: '#FFFFFF',
  border: '#FFE4D6',
} as const;

export const antTheme: ThemeConfig = {
  token: {
    colorPrimary: brand.primary,
    colorInfo: brand.info,
    colorSuccess: brand.success,
    colorWarning: brand.warning,
    colorError: brand.error,
    colorText: brand.text,
    colorTextSecondary: brand.textSecondary,
    colorBgContainer: brand.bgElevated,
    colorBgLayout: brand.bg,
    colorBorder: brand.border,
    colorBorderSecondary: '#F5F0EB',
    borderRadius: 10,
    borderRadiusLG: 14,
    fontFamily:
      "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    controlHeight: 40,
    wireframe: false,
  },
  components: {
    Card: { borderRadiusLG: 14 },
    Button: { primaryShadow: '0 4px 14px rgba(255, 107, 53, 0.25)' },
  },
};

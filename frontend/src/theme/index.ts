import type { ThemeConfig } from 'antd';

/** 暖橙 + 薄荷 — 清爽活力，无蓝紫 */
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
  /** 登录页：暖色光晕 + 奶白底，不用蓝紫渐变 */
  authBg:
    'radial-gradient(ellipse 75% 55% at 12% 18%, rgba(255, 107, 53, 0.14) 0%, transparent 58%), radial-gradient(ellipse 65% 50% at 88% 82%, rgba(46, 196, 182, 0.12) 0%, transparent 52%), #FFFBF7',
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
    Layout: {
      headerBg: brand.bgElevated,
      siderBg: brand.bgElevated,
      bodyBg: brand.bg,
    },
    Menu: {
      itemSelectedColor: brand.primary,
      itemSelectedBg: 'rgba(255, 107, 53, 0.08)',
      itemHoverBg: 'rgba(255, 107, 53, 0.04)',
      itemActiveBg: 'rgba(255, 107, 53, 0.06)',
    },
    Card: {
      borderRadiusLG: 14,
    },
    Button: {
      primaryShadow: '0 4px 14px rgba(255, 107, 53, 0.25)',
    },
  },
};

/** ECharts 等图表用色 */
export const chartColors = {
  primary: brand.primary,
  success: brand.success,
  warning: brand.warning,
  accent: brand.accent,
  secondary: brand.accent,
  muted: '#A8A29E',
};

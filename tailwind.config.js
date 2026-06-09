/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        // 主题感知颜色 - 通过 CSS 变量自动切换
        'th-bg': 'var(--color-bg-primary)',
        'th-bg-sec': 'var(--color-bg-secondary)',
        'th-bg-ter': 'var(--color-bg-tertiary)',
        'th-bg-card': 'var(--color-bg-card)',
        'th-bg-input': 'var(--color-bg-input)',
        'th-bg-hover': 'var(--color-bg-hover)',
        'th-bg-nav': 'var(--color-bg-nav-active)',
        'th-text': 'var(--color-text-primary)',
        'th-text-sec': 'var(--color-text-secondary)',
        'th-text-ter': 'var(--color-text-tertiary)',
        'th-text-ph': 'var(--color-text-placeholder)',
        'th-border': 'var(--color-border-default)',
        'th-border-h': 'var(--color-border-hover)',
        'th-border-s': 'var(--color-border-subtle)',
        'th-accent': 'var(--color-accent)',
        'th-accent-bg': 'var(--color-accent-bg)',
        'th-accent-shadow': 'var(--color-accent-shadow)',
        'th-danger': 'var(--color-danger)',
        'th-danger-bg': 'var(--color-danger-bg)',
        'th-badge-bg': 'var(--color-badge-bg)',
        'th-badge-text': 'var(--color-badge-text)',
        'th-overlay': 'var(--color-overlay)',
        'th-shadow': 'var(--color-shadow-card)',
        'th-shadow-h': 'var(--color-shadow-card-hover)',
        // 保留旧颜色名兼容
        'cyber-cyan': 'var(--color-accent)',
        'cyber-cyan-dark': '#00b89c',
        'deep-black': 'var(--color-bg-primary)',
        'dark-gray': 'var(--color-bg-secondary)',
        'dark-purple': '#2d1b69',
        'soft-white': 'var(--color-text-primary)',
        'card-bg': 'var(--color-bg-card)',
        'border-subtle': 'var(--color-border-default)',
      },
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
        'noto-sans': ['Noto Sans SC', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'border-dance': 'borderDance 1s linear infinite',
        'ripple': 'ripple 0.6s linear',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 5px var(--color-shadow-accent)' },
          '50%': { boxShadow: '0 0 20px var(--color-shadow-accent)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        borderDance: {
          '0%': { backgroundPosition: '0 0, 100% 0, 100% 100%, 0 100%' },
          '100%': { backgroundPosition: '100% 0, 100% 100%, 0 100%, 0 0' },
        },
        ripple: {
          '0%': { transform: 'scale(0)', opacity: '1' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Gravity', 'sans-serif'],
      },
      colors: {
        primary: '#307473', // Updated primary to teal
        // Unified neutral gray palette: single dark tone #131314
        gray: {
          50: '#f9f9f9',
          100: '#ececec',
          200: '#e3e3e3',
          300: '#cdcdcd',
          400: '#b4b4b4',
          500: '#9b9b9b',
          600: '#676767',
          700: '#2d2e30',
          800: '#131314',
          900: '#131314',
          950: '#0b0b0c',
        },
        // Alias slate/zinc to this same gray to ensure consistency
        slate: {
          50: '#f9f9f9',
          100: '#ececec',
          200: '#e3e3e3',
          300: '#cdcdcd',
          400: '#b4b4b4',
          500: '#9b9b9b',
          600: '#676767',
          700: '#2d2e30',
          800: '#131314',
          900: '#131314',
          950: '#0b0b0c',
        },
        zinc: {
          50: '#f9f9f9',
          100: '#ececec',
          200: '#e3e3e3',
          300: '#cdcdcd',
          400: '#b4b4b4',
          500: '#9b9b9b',
          600: '#676767',
          700: '#2d2e30',
          800: '#131314',
          900: '#131314',
          950: '#0b0b0c',
        },
        // Brand color (teal) to replace amber usage
        brand: {
          50: '#eaf4f4',
          100: '#d5e9e8',
          200: '#add3d1',
          300: '#85bdbb',
          400: '#5da7a4',
          500: '#307473',
          600: '#265d5c',
          700: '#1c4645',
          800: '#122f2e',
          900: '#091717',
          950: '#040b0b',
        },
        // Keeping amber override as fallback/alias
        amber: {
          50: '#eaf4f4',
          100: '#d5e9e8',
          200: '#add3d1',
          300: '#85bdbb',
          400: '#5da7a4',
          500: '#307473',
          600: '#265d5c',
          700: '#1c4645',
          800: '#122f2e',
          900: '#091717',
          950: '#040b0b',
        },
        'background-light': '#fcfcfc',
        'background-dark': '#131314', // Updated to match user preference
        // Notion-inspired clean, minimal palette
        // Main background - pure white for maximum whitespace
        bg: {
          primary: '#FFFFFF',     // Pure white
          secondary: '#F7F7F7',   // Very light gray for subtle containers
          hover: '#F9F9F9',       // Extremely subtle hover state
        },
        // Text - nearly black for maximum contrast
        text: {
          primary: '#111111',     // Near black
          secondary: '#555555',   // Medium gray for meta info
          tertiary: '#999999',    // Light gray for placeholders
          muted: '#CCCCCC',       // Very muted for disabled states
        },
        // Divider - light gray for subtle separation
        divider: {
          DEFAULT: '#E5E5E5',     // Light gray divider
          light: '#F0F0F0',       // Very light divider
        },
        // Single soft accent color - gentle blue-gray
        accent: {
          DEFAULT: '#5A7FAE',     // Soft blue-gray
          hover: '#4A6A9C',       // Slightly darker for hover
          light: '#E8ECF4',       // Very light background for accent
        },
        // Tags - soft neutral tones
        tags: {
          npc: '#8B7355',         // Earthy brown for NPCs
          inventory: '#5A7FAE',   // Soft blue for items
          pet: '#9E7FA8',         // Soft purple for pets
        },
      },
      borderRadius: {
        // Zero rounded corners - clean minimal look
        none: '0',
        sm: '0',
        DEFAULT: '0',
        lg: '0',
        xl: '0',
        full: '9999px',
      },
      animation: {
        fadeIn: 'fadeIn 150ms ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

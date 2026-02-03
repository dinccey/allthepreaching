/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // Old website color scheme (theme-suzi.less)
                primary: {
                    DEFAULT: '#dbab83', // Main highlight color
                    50: '#fef8f3',
                    100: '#fdeede',
                    200: '#fadcbc',
                    300: '#f5c493',
                    400: '#efa668',
                    500: '#dbab83',
                    600: '#c8966c',
                    700: '#a77a57',
                    800: '#8b6450',
                    900: '#72503f',
                },
                secondary: {
                    DEFAULT: '#8b6e56', // Border and accent color
                    light: '#a88770',
                    dark: '#72594a',
                },
                // Color scheme from old site (dark theme - default)
                scheme: {
                    a: {
                        bg: '#ffffff',
                        text: '#767676',
                        highlight: '#dbab83',
                        heading: '#333333'
                    },
                    b: {
                        bg: '#474340',
                        text: '#efefef',
                        highlight: '#dbab83',
                        heading: '#ffffff'
                    },
                    c: {
                        bg: '#211e1c',
                        text: '#efefef',
                        highlight: '#dbab83',
                        heading: '#ffffff'
                    },
                    d: {
                        bg: '#4d3824',
                        text: '#efefef',
                        highlight: '#ffe0cc',
                        heading: '#ffffff'
                    },
                    e: {
                        bg: '#141414',
                        text: '#dfdfdf',
                        highlight: '#ffffff',
                        heading: '#dbab83'
                    },
                },
                // Light mode color schemes (inverted and brightened)
                'scheme-light': {
                    a: {
                        bg: '#ffffff',
                        text: '#3b3b3b',
                        highlight: '#8b6450',
                        heading: '#2d2d2d'
                    },
                    b: {
                        bg: '#f5ede6',
                        text: '#2d2d2d',
                        highlight: '#8b6450',
                        heading: '#2d2d2d'
                    },
                    c: {
                        bg: '#faf7f4',
                        text: '#2b2b2b',
                        highlight: '#8b6450',
                        heading: '#1a1a1a'
                    },
                    d: {
                        bg: '#f0e6da',
                        text: '#2b2b2b',
                        highlight: '#72503f',
                        heading: '#1a1a1a'
                    },
                    e: {
                        bg: '#ffffff',
                        text: '#3b3b3b',
                        highlight: '#8b6450',
                        heading: '#2d2d2d'
                    },
                },
                dark: {
                    bg: '#141414',
                    card: '#1b1c24',
                    text: '#dfdfdf',
                    border: '#8b6e56',
                },
                light: {
                    bg: '#ffffff',
                    card: '#f8f9fa',
                    text: '#4a4a4a',
                    border: '#dbab83',
                }
            },
            fontFamily: {
                sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
                serif: ['Merriweather', 'Georgia', 'serif'],
            },
            animation: {
                'fade-in': 'fadeIn 0.6s ease-in-out',
                'slide-up': 'slideUp 0.5s ease-out',
                'slide-in-left': 'slideInLeft 0.5s ease-out',
                'slide-in-right': 'slideInRight 0.5s ease-out',
                'scale-in': 'scaleIn 0.4s ease-out',
                'glow': 'glow 2s ease-in-out infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(30px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                slideInLeft: {
                    '0%': { transform: 'translateX(-30px)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
                slideInRight: {
                    '0%': { transform: 'translateX(30px)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
                scaleIn: {
                    '0%': { transform: 'scale(0.95)', opacity: '0' },
                    '100%': { transform: 'scale(1)', opacity: '1' },
                },
                glow: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.6' },
                }
            },
            backdropBlur: {
                xs: '2px',
            }
        },
    },
    plugins: [],
}

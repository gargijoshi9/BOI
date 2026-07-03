/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0B0F19',
          card: '#161D30',
          border: '#24304F',
          primary: '#EF6820', // Orange (Team Orange brand color)
          secondary: '#3B82F6', // Blue accent
          mule: '#EF4444', // Red status for critical mule alert
          success: '#10B981', // Green for clean accounts
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

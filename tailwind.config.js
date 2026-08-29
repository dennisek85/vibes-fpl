/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pitch: {
          dark: '#0e3d23',
          DEFAULT: '#14532d',
          light: '#166534',
          stripe: '#15803d',
          line: 'rgba(255, 255, 255, 0.35)',
        },
        fdr: {
          1: '#00bb6e', // Easy
          2: '#01fc7a', // Very good
          3: '#e1e5e8', // Neutral/Medium
          4: '#ff1751', // Hard
          5: '#80072d', // Very Hard
        }
      },
      backgroundImage: {
        'grass-pattern': "radial-gradient(ellipse at center, rgba(34, 197, 94, 0.15), transparent 70%)",
      }
    },
  },
  plugins: [],
};

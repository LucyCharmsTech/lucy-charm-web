/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primarycolor: 'var(--primarycolor)',
        // Text/icons on top of `primarycolor`.
        'primarycolor-foreground': 'var(--primarycolor-foreground)',
        // The brand pink where it has to be legible as small text.
        'primarycolor-text': 'var(--primarycolor-text)',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: { 
        primary: "#004d99", 
        secondary: "#0066cc",
        accent: "#ffa500",
        success: "#28a745",
        info: "#17a2b8",
        warning: "#ffc107",
        danger: "#dc3545",
        light: "#f8f9fa",
        dark: "#343a40"
      },
      borderRadius: { 
        button: "8px" 
      },
      fontFamily: {
        'pacifico': ['Pacifico', 'cursive'],
        'sans': ['Poppins', 'sans-serif']
      },
    },
  },
  plugins: [],
}


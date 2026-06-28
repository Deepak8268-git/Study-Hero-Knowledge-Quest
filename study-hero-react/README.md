# Study Hero - React Version

This is the React version of the Study Hero application, an educational platform designed to help students learn effectively through personalized quizzes, flashcards, and more.

## Features

- Modern, responsive UI built with React and Tailwind CSS
- Interactive quizzes with timer functionality
- Student and teacher dashboards
- Authentication system (demo using localStorage)
- Progress tracking for courses and assignments

## Prerequisites

- Node.js (v14.0.0 or higher)
- npm (v6.0.0 or higher)

## Installation

1. Clone the repository
```
git clone <repository-url>
```

2. Navigate to the project directory
```
cd study-hero-react
```

3. Install dependencies
```
npm install
```

## Running the Application

1. Start the development server
```
npm start
```

2. Open your browser and navigate to `http://localhost:3000`

## Project Structure

- `src/components/` - Reusable UI components
- `src/pages/` - Page components for each route
- `src/styles/` - CSS styles and Tailwind configuration
- `src/assets/` - Static assets (images, icons, etc.)

## Authentication

For demonstration purposes, this application uses localStorage for authentication. In a production environment, you would implement a proper authentication system with a backend API.

- Any email/password combination will work for login
- The system randomly assigns users as either students or teachers

## License

MIT
## Vercel Deployment

Set the frontend root directory to `study-hero-react`.

Build command:
```bash
npm run build
```

Output directory:
```bash
build
```

Required Vercel environment variable:
- `REACT_APP_API_URL` - the deployed Render backend URL, for example `https://your-render-backend.onrender.com`

The included `vercel.json` rewrites all routes to `index.html` so React Router deep links work in production.


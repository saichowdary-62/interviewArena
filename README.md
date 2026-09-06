# Interview Arena

Interview Arena is a resume-grounded mock interview platform. It analyzes a candidate's resume, calculates role alignment and ATS compatibility, generates role-specific questions, records spoken answers, and produces evidence-based evaluation reports.

## Live Demo

The project is deployed on Netlify and can be viewed here: [interviewarena.netlify.app](https://interviewarena.netlify.app/).

## Features

- Role-specific interview questions based on the selected position, competency framework, experience level, and job description.
- Auto-generated and Custom Practice interview modes.
- Exact custom-question ordering with the selected question count.
- Difficulty controls for Easy, Medium, Hard, and Staff/Principal interviews.
- Strict answer evaluation based on the candidate's submitted response and notes.
- Per-question marks, answer evidence, strengths, weaknesses, and feedback.
- ATS compatibility scoring based on verified resume skills.
- Resume parsing for PDF, DOCX, XLS/XLSX, ODS, TXT, Markdown, CSV, and JSON files.
- Speech transcription, vocal telemetry, webcam analysis, and interview reports.
- Local deterministic fallbacks when AI providers are unavailable or rate-limited.

## Requirements

- Node.js 20 or newer
- npm

## Run Locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The server exposes the React application and API endpoints from the same port.

## Deployment

Interview Arena is deployed on [Netlify](https://www.netlify.com/). The included `netlify.toml` builds the app with `npm run build`, publishes the `dist` directory, deploys the API as a serverless function, and routes client-side pages back to the single-page app.

## Environment Variables

Copy the existing `.env` configuration for local development and provide only the credentials needed by your deployment. Never commit API keys or service-role credentials.

Common variables include:

```env
GEMINI_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_server_only_key
```

AI provider credentials are optional for local operation. The application uses deterministic local question generation, resume analysis, and answer evaluation when providers are unavailable.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server on port 3000 |
| `npm run build` | Build the frontend and bundled production server |
| `npm run start` | Start the production bundle from `dist` |
| `npm run preview` | Preview the Vite production build |
| `npm run lint` | Run the TypeScript check |

## Resume Parsing

Text-based PDFs are parsed locally with PDF.js. DOCX files use Mammoth, spreadsheets use SheetJS, and plain-text formats use UTF-8 extraction. Image-only PDFs use the OCR fallback when an AI provider and available quota are configured.

## Evaluation Rules

Scores are based only on the candidate's actual answer and submitted notes. Empty, irrelevant, avoided, or insufficient responses receive zero marks and are displayed as **No answer provided**. Generated reports include question-level results even for one-question interviews.

## Validation

Run the project type check before submitting changes:

```bash
npm run lint
```

Build the application with:

```bash
npm run build
```

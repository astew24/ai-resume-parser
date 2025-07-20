# AI Resume Parser

A modern web application that uses AI to extract key information from resumes. Built with Next.js, TypeScript, and Express.js.

## 🚀 Features

- **File Upload Support**: Upload PDF, DOC, DOCX, and TXT files
- **Text Input**: Paste resume content directly
- **AI-Powered Parsing**: Extract contact information, skills, experience, and education
- **Modern UI**: Beautiful, responsive design with dark mode support
- **Error Handling**: Comprehensive error handling and validation
- **Type Safety**: Full TypeScript support
- **Accessibility**: WCAG compliant with proper ARIA labels

## 🛠️ Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Animation library
- **React Hook Form** - Form handling with validation
- **Zod** - Schema validation
- **Lucide React** - Icon library

### Backend
- **Express.js** - Node.js web framework
- **TypeScript** - Type safety
- **Multer** - File upload handling
- **Zod** - Request/response validation
- **Helmet** - Security middleware
- **CORS** - Cross-origin resource sharing
- **Morgan** - HTTP request logger

## 📦 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/astew24/ai-resume-parser.git
cd ai-resume-parser
```

2. **Install dependencies for both frontend and backend:**
```bash
# Install web app dependencies
cd apps/web
npm install

# Install API dependencies
cd ../api
npm install
```

3. **Set up environment variables:**

Create `.env` files in both `apps/web` and `apps/api` directories:

**apps/web/.env.local:**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**apps/api/.env:**
```env
PORT=3001
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

### 🏃‍♂️ Development

1. **Start the API server:**
```bash
cd apps/api
npm run dev
```

2. **In a new terminal, start the web application:**
```bash
cd apps/web
npm run dev
```

3. **Open your browser and navigate to `http://localhost:3000`**

### 🏗️ Production Build

1. **Build the API:**
```bash
cd apps/api
npm run build
npm start
```

2. **Build the web application:**
```bash
cd apps/web
npm run build
npm start
```

## 🔌 API Endpoints

### Health Check
```
GET /health
```
Returns the API status and timestamp.

### Parse Resume
```
POST /api/parse-resume
```

**Request Body (JSON):**
```json
{
  "content": "Resume text content...",
  "format": "txt"
}
```

**Request Body (Form Data):**
- `file`: Resume file (PDF, DOC, DOCX, TXT)

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1-555-123-4567",
    "skills": ["JavaScript", "React", "Node.js"],
    "experience": [
      {
        "company": "Tech Corp",
        "position": "Software Engineer",
        "duration": "2020-2023",
        "description": "Developed web applications..."
      }
    ],
    "education": [
      {
        "institution": "University of Technology",
        "degree": "Bachelor of Science",
        "field": "Computer Science",
        "year": "2020"
      }
    ]
  }
}
```

## 📁 Project Structure

```
ai-resume-parser/
├── apps/
│   ├── api/                 # Express.js API server
│   │   ├── src/
│   │   │   ├── index.ts     # Main server file
│   │   │   ├── index.test.ts # API tests
│   │   │   └── test-setup.ts # Jest configuration
│   │   ├── package.json
│   │   ├── jest.config.js
│   │   └── tsconfig.json
│   └── web/                 # Next.js web application
│       ├── src/
│       │   ├── app/         # App Router pages
│       │   ├── components/  # React components
│       │   │   ├── ResumeParser.tsx
│       │   │   ├── ErrorBoundary.tsx
│       │   │   └── LoadingSpinner.tsx
│       │   └── lib/         # Utility functions
│       │       └── api.ts
│       ├── package.json
│       ├── next.config.ts
│       └── tsconfig.json
└── README.md
```

## 🛡️ Error Handling

The application includes comprehensive error handling:

- **Frontend**: Error boundaries, form validation, API error handling
- **Backend**: Input validation, file validation, error middleware
- **User Feedback**: Clear error messages and loading states

## 🔒 Security Features

- **Helmet.js**: Security headers
- **CORS**: Configured for specific origins
- **File Validation**: Type and size restrictions
- **Input Validation**: Zod schemas for all inputs
- **Rate Limiting**: Built-in protection against abuse

## ⚡ Performance Optimizations

- **Image Optimization**: Next.js automatic image optimization
- **Code Splitting**: Automatic code splitting with Next.js
- **Lazy Loading**: Components loaded on demand
- **Caching**: API response caching
- **Bundle Analysis**: Built-in bundle analyzer

## 🧪 Testing

Run tests for the API:
```bash
cd apps/api
npm test
```

## 📝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -am 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔮 Future Enhancements

- [ ] Integration with OpenAI GPT for better parsing
- [ ] Support for more file formats
- [ ] Export parsed data to various formats
- [ ] User authentication and history
- [ ] Batch processing of multiple resumes
- [ ] Advanced filtering and search
- [ ] Resume comparison tools
- [ ] Integration with ATS systems

## 🆘 Support

For support, please open an issue in the GitHub repository or contact the development team.

## 🌟 Star the Repository

If you find this project helpful, please give it a ⭐ on GitHub!

---

**Built with ❤️ using Next.js, TypeScript, and Express.js**
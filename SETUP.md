# TiDB Setup Guide for Vio Application

This guide will help you set up TiDB for your Vio application for the TiDB AgentX Hackathon 2025.

## Prerequisites

1. **TiDB Cloud Account**: Sign up at [TiDB Cloud](https://tidbcloud.com/)
2. **Node.js 18+**: Ensure you have Node.js installed
3. **Environment Variables**: Configure your database credentials

## Step 1: Create TiDB Cloud Database

1. Go to [TiDB Cloud Console](https://tidbcloud.com/)
2. Create a new cluster or use an existing one
3. Note down your connection details:
   - **Host**: Your cluster endpoint
   - **Port**: Usually 4000
   - **Username**: Your database user
   - **Password**: Your database password
   - **Database**: Create a database (e.g., `vio_database`)

## Step 2: Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp env.example .env.local
   ```

2. Edit `.env.local` with your TiDB credentials:
   ```env
   # TiDB Configuration
   TIDB_HOST=your-cluster-endpoint.tidbcloud.com
   TIDB_PORT=4000
   TIDB_USER=your-username
   TIDB_PASSWORD=your-password
   TIDB_DATABASE=vio_database
   TIDB_SSL=true
   
   # Appwrite Configuration (keep existing values)
   APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
   APPWRITE_PROJECT_ID=your_project_id
   APPWRITE_API_KEY=your_api_key
   
   # AI Services (keep existing values)
   OPENAI_API_KEY=your-openai-key
   OPENAI_BASE_URL=https://api.groq.com/openai/v1
   GROQ_API_KEY=your-groq-key
   GEMINI_API_KEY=your-gemini-key
   ```

## Step 3: Install Dependencies

```bash
npm install
```

## Step 4: Set Up Database Schema

Run the TiDB setup script to create all necessary tables:

```bash
npm run setup:tidb
```

This will create the following tables:
- `users` - User profiles and authentication data
- `workspaces` - Learning workspaces for organization
- `folders` - Hierarchical folder structure
- `dashboard_items` - Universal learning content (documents, images, videos, web links)
- `item_folders` - Many-to-many relationships between items and folders
- `item_notes` - AI-generated and user notes
- `quiz_results` - Quiz performance tracking
- `file_metadata` - File storage metadata and URLs
- `learning_paths` - AI-generated personalized learning paths
- `learning_steps` - Individual steps within learning paths
- `study_sessions` - Adaptive study sessions with progress tracking
- `research_queries` - Research assistant queries and results
- `video_generations` - Educational video script generation requests and results

## Step 5: Start the Application

```bash
npm run dev
```

Visit `http://localhost:3000` to see your application.

## Step 6: Test the Integration

1. **Sign up/Login**: Create an account or sign in
2. **Upload Content**: Upload documents, images, YouTube videos, or save web links to test universal content storage
3. **Create Workspaces**: Organize your learning materials across all content types
4. **AI Chat**: Test the AI-powered chat functionality with your content
5. **Quiz Generation**: Create and take quizzes from all content types
6. **AI Agents**: Test Learning Path Generator, Research Assistant, and Study Session Orchestrator
7. **Learning Script Studio**: Generate educational video scripts from your content
8. **Search Functionality**: Test the TiDB-powered search across all content types
9. **Content Management**: Test delete functionality for learning paths, research queries, and study sessions
10. **UI Features**: Test scrollable content areas and hover-based delete buttons

## Troubleshooting

### Connection Issues

If you encounter connection issues:

1. **Check Credentials**: Verify your TiDB host, username, and password
2. **Network Access**: Ensure your IP is whitelisted in TiDB Cloud
3. **SSL Configuration**: Make sure `TIDB_SSL=true` is set
4. **Port**: Confirm the port is 4000 (default for TiDB Cloud)

### Common Error Messages

- **ER_ACCESS_DENIED_ERROR**: Check username and password
- **ENOTFOUND**: Verify host URL is correct
- **ECONNREFUSED**: Check if the cluster is running and accessible

### Database Schema Issues

If the setup script fails:

1. Check database permissions
2. Ensure the database exists
3. Verify the user has CREATE privileges
4. Run the script again (it's idempotent)

### Search Issues

If search is not working:

1. **Check User ID Mapping**: Ensure Appwrite user ID is properly mapped to TiDB user ID
2. **Verify Workspace**: Make sure user has a default workspace created
3. **Check Content**: Ensure content is properly stored in TiDB with correct workspace ID
4. **API Logs**: Check browser console and server logs for authentication errors

### Delete Function Issues

If delete operations fail:

1. **Authentication**: Ensure user is properly authenticated
2. **Ownership**: Verify the item belongs to the authenticated user
3. **API Endpoints**: Check that DELETE endpoints are properly configured
4. **Permissions**: Ensure user has proper database permissions

### UI Issues

If UI features are not working:

1. **Scrollable Content**: Check if content areas have proper CSS classes
2. **Hover Effects**: Ensure JavaScript is enabled and CSS is loading
3. **Auto-resize**: Check if textarea resize functions are properly implemented
4. **Sidebar Navigation**: Verify URL parameters are being read correctly

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Routes    │    │   TiDB          │
│   (Next.js)     │◄──►│   (Updated)     │◄──►│   (Database)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Appwrite      │
                       │   (Files + Auth)│
                       └─────────────────┘
```

## Multi-Step AI Workflows

Your application implements several multi-step AI agent workflows:

### 1. Universal Content Processing Agent
- **Step 1**: Upload content (document/image/YouTube/web link) to Appwrite storage
- **Step 2**: Extract metadata and content (OCR for images, transcripts for videos, scraping for web links)
- **Step 3**: Store structured data in TiDB
- **Step 4**: Index content for vector search
- **Step 5**: Generate AI summary and notes

### 2. Learning Assistant Agent
- **Step 1**: Analyze user query
- **Step 2**: Search TiDB for relevant content across all media types
- **Step 3**: Retrieve context from vector search (documents, videos, web content)
- **Step 4**: Generate personalized response
- **Step 5**: Store interaction for learning

### 3. Quiz Generation Agent
- **Step 1**: Analyze uploaded content (documents, videos, web content)
- **Step 2**: Extract key concepts and topics from all content types
- **Step 3**: Generate contextual questions
- **Step 4**: Provide instant feedback
- **Step 5**: Store results and track progress

### 4. Video Generation Agent
- **Step 1**: Analyze user's selected content (documents, videos, web links) and topic
- **Step 2**: Extract relevant content and context from all sources
- **Step 3**: Generate educational video script structure
- **Step 4**: Create engaging content with examples and visuals
- **Step 5**: Store generated script and metadata

## Latest Improvements (v1.2.0)

### Enhanced Features
- **TiDB Search Integration**: Migrated search from Appwrite to TiDB for better performance
- **Delete Operations**: Added comprehensive delete functionality for all content types
- **UI/UX Improvements**: Scrollable content, hover effects, and auto-resize textarea
- **Error Handling**: Enhanced AI response parsing and fallback mechanisms
- **Security**: Improved user authentication and data protection

### Performance Optimizations
- **Database Queries**: Optimized TiDB queries for faster response times
- **User ID Mapping**: Proper Appwrite-to-TiDB user ID mapping
- **Workspace Management**: Improved default workspace handling
- **Content Organization**: Better content management and organization

## Hackathon Compliance

This setup ensures your application meets all TiDB AgentX Hackathon requirements:

✅ **Multi-Step AI Agents**: Complex workflows with multiple processing steps  
✅ **TiDB Serverless**: Primary database with vector search capabilities  
✅ **Real-World Impact**: Educational platform with practical features  
✅ **Innovation**: Combines multiple AI services for comprehensive learning  
✅ **Quality Implementation**: Production-ready with proper error handling  
✅ **Universal Content Support**: Documents, images, YouTube videos, and web links  
✅ **Video Generation**: AI-powered educational content creation  

## Support

If you encounter any issues:

1. Check the troubleshooting section above
2. Review the README.md for additional guidance
3. Ensure all environment variables are properly configured
4. Verify your TiDB Cloud cluster is active and accessible

Happy coding! 🚀

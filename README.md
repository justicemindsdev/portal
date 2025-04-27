# BenNewChat - Legal Communication Platform

BenNewChat is a Next.js-based secure communication platform designed specifically for legal processes and communications. It provides a structured environment for legal professionals and parties to communicate, share documents, and manage case-related information.

## Features

### 1. Real-time Chat System
- Secure real-time messaging between participants
- Message deletion capabilities for administrators
- @mention functionality to tag specific participants
- Timestamp display for all messages
- User authentication and role-based access control

### 2. Document Management
- Secure file upload and storage using Supabase
- Support for multiple file types:
  - Images (jpg, jpeg, png, gif, svg, bmp, webp)
  - Documents (pdf, doc, docx, txt)
- Document preview functionality
- Organized storage by room/case ID
- Administrative controls for file management

### 3. Room-based Organization
- Separate chat rooms for different cases/matters
- Participant management within rooms
- Access control based on room membership
- Real-time updates across all participants

### 4. User Management
- Secure authentication system
- Role-based access control:
  - Admin access with enhanced privileges
  - Regular user access with restricted permissions
- User profiles with avatars and display names

## Technical Stack

### Frontend
- Next.js
- React
- TailwindCSS for styling
- Radix UI components for enhanced UI elements

### Backend & Database
- Supabase for:
  - Real-time database
  - Authentication
  - File storage
  - User management

### Key Dependencies
- @radix-ui components for UI elements
- @supabase/supabase-js for backend integration
- Various UI utilities (clsx, tailwind-merge)
- React Icons for iconography

## Project Structure

```
bennewchat/
├── components/           # React components
│   ├── Chat.js          # Main chat functionality
│   ├── Documents.js     # Document management
│   ├── Login.js         # Authentication
│   ├── ParticipantList.js # User management
│   └── ui/              # Reusable UI components
├── pages/               # Next.js pages
│   ├── api/            # API routes
│   ├── rooms/          # Room-related pages
│   └── index.js        # Landing page
├── public/             # Static assets
├── styles/             # Global styles
└── utils/              # Utility functions
    └── supabase.js     # Supabase client configuration
```

## Security Features

- Secure authentication using Supabase
- Role-based access control
- Secure file storage and transmission
- Protected API routes
- Room-based access restrictions

## Database Schema

The application uses Supabase with the following main tables:

1. Profiles
   - User information
   - Room associations
   - Access levels

2. Rooms
   - Room/case information
   - Participant management
   - Access controls

3. Chats
   - Message content
   - Sender information
   - Room association
   - Timestamps

4. Storage
   - Document storage
   - Room-based organization
   - Access controls

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_KEY=your_supabase_key
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```

## Environment Setup

The application requires the following environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_KEY`: Your Supabase public API key

## Contributing

When contributing to this project:

1. Maintain the existing code structure
2. Follow the established coding patterns
3. Ensure all features maintain security standards
4. Test thoroughly before submitting changes

## License

This project is proprietary and confidential. All rights reserved.

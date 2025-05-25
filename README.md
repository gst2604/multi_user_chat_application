💬 Multi-User Chat Application

- A real-time chat application built with Node.js, Socket.IO, and MongoDB that supports multiple chat rooms, media sharing, and user profiles.

## 📁Project structure
```
multi-room-chat-app/
├── public/
│   ├── app.js         # Frontend JavaScript
│   ├── style.css      # Styling
│   └── uploads/       # Uploaded media files
├── models/
│   ├── Message.js     # Message schema
│   └── User.js        # User schema
├── logs/
│   └── chat_log.txt   # Chat message logs
├── server.js          # Main server file
└── README.md          # Documentation
```

## 🚀 Features

- 🚀 Real-time messaging using Socket.IO
- 👥 Multiple chat rooms support
- 📸 Image sharing capabilities
- 🎤 Voice message recording and playback
- 👤 User profiles with customizable profile photos
- 💾 Message persistence using MongoDB
- 📝 Chat logging to text files
- 🎨 Clean and responsive UI

## Technology Stack

- **Backend**:
  - Node.js
  - Express.js
  - Socket.IO
  - MongoDB with Mongoose
  - Multer for file uploads

- **Frontend**:
  - HTML5
  - CSS3
  - JavaScript
  - Socket.IO Client

## 🧑‍💻 How to Run Locally

1.Clone the repository
- git clone https://github.com/gst2604/multi_user_chat_application.git

2.Navigate into the project folder
- cd multi_user_chat_application

3.Install dependencies
- npm install

4.Start the server
- npm start

## Features in Detail

### Chat Rooms
- Global chat room by default
- Create custom chat rooms
- Switch between rooms seamlessly
- See active users in each room

### Media Sharing
- Share images in chat
- Record and send voice messages
- Support for various image formats
- Real-time media upload and display

### User Profiles
- Set username upon joining
- Upload and update profile photos
- Profile photos visible in chat and user list
- Persistent user profiles

### Message History
- Messages stored in MongoDB
- Chat logs saved to text file
- Media files preserved in uploads directory
- Access to chat history when joining rooms

## API Endpoints

- `POST /upload/profile` - Upload user profile photo
- `POST /upload/message` - Upload chat media (images/voice)

## Socket Events

- `createUser` - Create new user
- `sendMessage` - Send chat message
- `createRoom` - Create new chat room
- `updateRooms` - Switch between rooms
- `profileUpdate` - Update user profile

## 🤝 Contribution

- **Gaurav Tiwari && Vaishnavi Durgapal** – Worked on backend ,testing and bug fixing
- **Rishabh Joshi** – Assisted in database integration
- **Luv Tiwari** – Helped with UI design and frontend

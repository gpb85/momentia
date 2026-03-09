Momentia (AlbumsTheater)

Momentia is a platform for organizing, managing, and sharing event media in a structured and secure way.
It allows administrators to create event-based environments ("EventBoxes") where media is stored, organized, and selectively shared with clients.

🚀 Tech Stack (Current)
Backend

Node.js

TypeScript

Express.js

PostgreSQL

pg (node-postgres)

Cloudinary (media storage)

Redis (planned)

BullMQ (planned)

Pino (logging)

Zod (validation)

Frontend (planned)

React

TypeScript

📦 Core Concept (So Far)
EventBox Structure

Each event created by the admin automatically generates:

📁 Global Folder

Visible to the client

Contains selected final media

📁 Subfolders

Visible only to admin/team

Used for organization and workflow

Roles
Admin

Creates EventBoxes

Uploads & organizes media

Controls visibility

Client

Can access dashboard

Sees folder structure

Access only to Global Folder content

📊 Planned Features

View tracking for Global Folders (marketing analytics)

Media statistics dashboard

Secure sharing

Optimized media delivery

⚙️ Getting Started (Backend)
1. Clone repository

git clone
cd momentia

2. Install dependencies

npm install

3. Setup environment variables

Create .env:

DATABASE_URL=
CLOUDINARY_URL=

4. Start dev server

npm run dev

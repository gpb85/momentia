CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================
-- 1. USERS (admin only)
-- =========================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- 2. EVENTS (event boxes)
-- =========================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(160) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  client_name VARCHAR(120),
  client_email VARCHAR(160) NOT NULL,
  description TEXT,
  event_date DATE,
  cover_image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- 3. FOLDERS
-- global + subfolders
-- =========================
CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  folder_type VARCHAR(20) NOT NULL CHECK (folder_type IN ('global', 'subfolder')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional business rule support:
-- one global folder per event
CREATE UNIQUE INDEX uq_global_folder_per_event
ON folders(event_id)
WHERE folder_type = 'global';

-- =========================
-- 4. ACCESS LINKS (QR tokens)
-- =========================
CREATE TABLE access_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL UNIQUE,
  access_type VARCHAR(30) NOT NULL CHECK (
    access_type IN (
      'event_dashboard',
      'global_upload',
      'subfolder_upload',
      'subfolder_dashboard'
    )
  ),
  label VARCHAR(120),
  recipient_email VARCHAR(160),
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- 5. MEDIA
-- =========================
CREATE TABLE media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  original_url TEXT NOT NULL,
  thumbnail_url TEXT,
  mime_type VARCHAR(100),
  file_size BIGINT,
  width INT,
  height INT,
  media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('image', 'video')),
  uploaded_via_access_link_id UUID REFERENCES access_links(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- 6. EMAIL DELIVERIES
-- keeps history of sent PDFs/QRs
-- =========================
CREATE TABLE email_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  recipient_email VARCHAR(160) NOT NULL,
  email_type VARCHAR(30) NOT NULL CHECK (
    email_type IN (
      'event_box_invite',
      'subfolder_invite'
    )
  ),
  pdf_url TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- =========================
-- 7. ACCESS LINK VISITS
-- analytics / marketing / traffic
-- =========================
CREATE TABLE access_link_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_link_id UUID NOT NULL REFERENCES access_links(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,

  -- anonymous visitor identification
  visitor_key TEXT,

  -- privacy-friendly tracking
  ip_hash TEXT,
  user_agent TEXT,
  referer TEXT,

  visit_type VARCHAR(30) NOT NULL CHECK (
    visit_type IN (
      'open',
      'dashboard_view',
      'upload_page_view',
      'upload_success',
      'download',
      'delete_subfolder'
    )
  ),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- 8. HELPFUL INDEXES
-- =========================
CREATE INDEX idx_events_created_by ON events(created_by);

CREATE INDEX idx_folders_event_id ON folders(event_id);
CREATE INDEX idx_folders_parent_id ON folders(parent_id);
CREATE INDEX idx_folders_type ON folders(folder_type);

CREATE INDEX idx_access_links_event_id ON access_links(event_id);
CREATE INDEX idx_access_links_folder_id ON access_links(folder_id);
CREATE INDEX idx_access_links_type ON access_links(access_type);
CREATE INDEX idx_access_links_active ON access_links(is_active);

CREATE INDEX idx_media_event_id ON media(event_id);
CREATE INDEX idx_media_folder_id ON media(folder_id);
CREATE INDEX idx_media_uploaded_via_access_link_id ON media(uploaded_via_access_link_id);
CREATE INDEX idx_media_created_at ON media(created_at);

CREATE INDEX idx_email_deliveries_event_id ON email_deliveries(event_id);
CREATE INDEX idx_email_deliveries_folder_id ON email_deliveries(folder_id);
CREATE INDEX idx_email_deliveries_recipient_email ON email_deliveries(recipient_email);

CREATE INDEX idx_access_link_visits_access_link_id ON access_link_visits(access_link_id);
CREATE INDEX idx_access_link_visits_event_id ON access_link_visits(event_id);
CREATE INDEX idx_access_link_visits_folder_id ON access_link_visits(folder_id);
CREATE INDEX idx_access_link_visits_visit_type ON access_link_visits(visit_type);
CREATE INDEX idx_access_link_visits_created_at ON access_link_visits(created_at);
CREATE INDEX idx_access_link_visits_visitor_key ON access_link_visits(visitor_key);
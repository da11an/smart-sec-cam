CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration INTEGER,  -- Duration in seconds
    filesize INTEGER,  -- Size in bytes
    room TEXT,        -- Camera/room name
    thumbnail_path TEXT,
    deleted_at TIMESTAMP,
    starred BOOLEAN DEFAULT 0,
    metadata JSON     -- For any additional metadata we might want to store
);

CREATE INDEX IF NOT EXISTS idx_videos_filename ON videos(filename);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);
CREATE INDEX IF NOT EXISTS idx_videos_room ON videos(room);
CREATE INDEX IF NOT EXISTS idx_videos_starred ON videos(starred); 
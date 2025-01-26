import json
import os
import sqlite3
from datetime import datetime
from typing import Optional, Dict, List, Tuple
from pkg_resources import resource_string
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants for space management (in bytes)
GB = 1024 * 1024 * 1024
TOTAL_SPACE_LIMIT = 30 * GB
STARRED_SPACE_LIMIT = 20 * GB
ALERT_THRESHOLD = 0.9  # Alert at 90% capacity

class VideoDatabase:
    def __init__(self, db_path: str):
        logger.info(f"Initializing VideoDatabase with path: {db_path}")
        self.db_path = db_path
        self._ensure_db_exists()

    def _ensure_db_exists(self):
        """Create the database and table if they don't exist"""
        try:
            db_dir = os.path.dirname(self.db_path)
            logger.info(f"Creating database directory: {db_dir}")
            if not os.path.exists(db_dir):
                os.makedirs(db_dir, exist_ok=True)
            
            # Read SQL from package resources
            try:
                logger.info("Attempting to read SQL from package resources")
                sql_content = resource_string('smart_sec_cam.server', 'init_db.sql').decode('utf-8')
                logger.info("Successfully read SQL content")
            except Exception as e:
                logger.error(f"Failed to read from package resources: {e}")
                # Fallback to direct file path
                current_dir = os.path.dirname(os.path.abspath(__file__))
                sql_path = os.path.join(current_dir, 'init_db.sql')
                logger.info(f"Falling back to direct file path: {sql_path}")
                with open(sql_path, 'r') as sql_file:
                    sql_content = sql_file.read()
                logger.info("Successfully read SQL content from file")

            logger.info("Connecting to database")
            conn = sqlite3.connect(self.db_path)
            logger.info("Executing SQL script")
            conn.executescript(sql_content)
            conn.commit()
            logger.info("Database initialization complete")
            
            # Verify tables were created
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = cursor.fetchall()
            logger.info(f"Created tables: {tables}")
            
            conn.close()
        except Exception as e:
            logger.error(f"Error during database initialization: {e}")
            raise

    def sync_with_directory(self, video_dir: str) -> tuple[List[str], List[str]]:
        """
        Synchronize the database with the actual files in the video directory.
        Returns tuple of (added_files, removed_files)
        """
        logger.info(f"Syncing database with directory: {video_dir}")
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Get list of files from directory
            actual_files = set()
            for file in os.listdir(video_dir):
                if file.endswith(('.mp4', '.webm')):
                    actual_files.add(file)
            logger.info(f"Found {len(actual_files)} video files in directory")

            # Get list of files from database
            cursor.execute("SELECT filename FROM videos WHERE deleted_at IS NULL")
            db_files = set(row[0] for row in cursor.fetchall())
            logger.info(f"Found {len(db_files)} video files in database")

            # Find files to add and remove
            files_to_add = actual_files - db_files
            files_to_remove = db_files - actual_files

            # Add new files
            for filename in files_to_add:
                file_path = os.path.join(video_dir, filename)
                filesize = os.path.getsize(file_path)
                created_at = datetime.fromtimestamp(os.path.getctime(file_path))
                
                room = None
                room_parts = filename.split('__')
                if len(room_parts) > 1:
                    room = room_parts[0]

                cursor.execute("""
                    INSERT INTO videos (filename, created_at, filesize, room)
                    VALUES (?, ?, ?, ?)
                """, (filename, created_at, filesize, room))
                logger.info(f"Added file to database: {filename}")

            # Mark removed files as deleted
            for filename in files_to_remove:
                cursor.execute("""
                    UPDATE videos 
                    SET deleted_at = ? 
                    WHERE filename = ?
                """, (datetime.now(), filename))
                logger.info(f"Marked file as deleted: {filename}")

            conn.commit()
            conn.close()
            logger.info("Database sync complete")

            return list(files_to_add), list(files_to_remove)
        except Exception as e:
            logger.error(f"Error during database sync: {e}")
            raise

    def update_video_metadata(self, filename: str, duration: Optional[float] = None, 
                            metadata: Optional[Dict] = None):
        """Update video metadata such as duration"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        updates = []
        params = []
        if duration is not None:
            updates.append("duration = ?")
            params.append(int(duration))
        if metadata is not None:
            updates.append("metadata = ?")
            params.append(json.dumps(metadata))

        if updates:
            query = f"""
                UPDATE videos 
                SET {', '.join(updates)}
                WHERE filename = ?
            """
            params.append(filename)
            cursor.execute(query, params)
            conn.commit()

        conn.close()

    def get_video_info(self, filename: str) -> Optional[Dict]:
        """Get all information about a specific video"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("""
            SELECT * FROM videos 
            WHERE filename = ? AND deleted_at IS NULL
        """, (filename,))
        
        row = cursor.fetchone()
        conn.close()

        if row:
            return dict(row)
        return None

    def mark_video_deleted(self, filename: str):
        """Mark a video as deleted in the database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE videos 
            SET deleted_at = ? 
            WHERE filename = ?
        """, (datetime.now(), filename))
        
        conn.commit()
        conn.close()

    def get_space_usage(self) -> Tuple[int, int]:
        """
        Returns tuple of (total_space_used, starred_space_used) in bytes
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Get total space usage
        cursor.execute("""
            SELECT SUM(filesize) 
            FROM videos 
            WHERE deleted_at IS NULL
        """)
        total_space = cursor.fetchone()[0] or 0

        # Get starred space usage
        cursor.execute("""
            SELECT SUM(filesize) 
            FROM videos 
            WHERE deleted_at IS NULL AND starred = 1
        """)
        starred_space = cursor.fetchone()[0] or 0

        conn.close()
        return (total_space, starred_space)

    def manage_disk_space(self) -> Dict[str, List[str]]:
        """
        Manages disk space by removing videos when limits are approached.
        Returns dict with lists of removed videos and warnings.
        """
        total_space, starred_space = self.get_space_usage()
        removed_videos = []
        warnings = []

        # Check if we're approaching limits
        if total_space > ALERT_THRESHOLD * TOTAL_SPACE_LIMIT:
            warnings.append(f"Approaching total space limit ({total_space / GB:.1f}GB / {TOTAL_SPACE_LIMIT / GB}GB)")
        if starred_space > ALERT_THRESHOLD * STARRED_SPACE_LIMIT:
            warnings.append(f"Approaching starred space limit ({starred_space / GB:.1f}GB / {STARRED_SPACE_LIMIT / GB}GB)")

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            # First, try to remove unstarred videos if total space is exceeded
            if total_space > TOTAL_SPACE_LIMIT:
                cursor.execute("""
                    SELECT filename, filesize 
                    FROM videos 
                    WHERE deleted_at IS NULL AND starred = 0
                    ORDER BY created_at ASC
                """)
                unstarred_videos = cursor.fetchall()

                space_to_free = total_space - (TOTAL_SPACE_LIMIT * 0.9)  # Free up to 90% capacity
                freed_space = 0

                for filename, filesize in unstarred_videos:
                    if freed_space >= space_to_free:
                        break
                    
                    # Mark as deleted in database
                    cursor.execute("""
                        UPDATE videos 
                        SET deleted_at = ? 
                        WHERE filename = ?
                    """, (datetime.now(), filename))
                    
                    # Delete actual file
                    try:
                        os.remove(os.path.join(os.path.dirname(self.db_path), '..', 'videos', filename))
                        removed_videos.append(filename)
                        freed_space += filesize
                    except OSError as e:
                        logger.error(f"Failed to delete file {filename}: {e}")

            # If starred space is still exceeded, remove starred videos
            starred_space = self.get_space_usage()[1]  # Get updated starred space
            if starred_space > STARRED_SPACE_LIMIT:
                cursor.execute("""
                    SELECT filename, filesize 
                    FROM videos 
                    WHERE deleted_at IS NULL AND starred = 1
                    ORDER BY created_at ASC
                """)
                starred_videos = cursor.fetchall()

                space_to_free = starred_space - (STARRED_SPACE_LIMIT * 0.9)
                freed_space = 0

                for filename, filesize in starred_videos:
                    if freed_space >= space_to_free:
                        break
                    
                    cursor.execute("""
                        UPDATE videos 
                        SET deleted_at = ? 
                        WHERE filename = ?
                    """, (datetime.now(), filename))
                    
                    try:
                        os.remove(os.path.join(os.path.dirname(self.db_path), '..', 'videos', filename))
                        removed_videos.append(filename)
                        freed_space += filesize
                    except OSError as e:
                        logger.error(f"Failed to delete file {filename}: {e}")

            conn.commit()

        finally:
            conn.close()

        return {
            "removed_videos": removed_videos,
            "warnings": warnings
        } 
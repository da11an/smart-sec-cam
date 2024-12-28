import os
from datetime import datetime
from typing import List, Dict

from smart_sec_cam.video.writer import VideoWriter


class VideoManager:
    VIDEO_FORMATS = {
        "webm": ".webm",
        "mp4": ".mp4"
    }

    def __init__(self, video_dir="data/videos/"):
        self.video_dir = video_dir

    def get_video_filenames(self, video_format: str = "webm") -> List[str]:
        file_names = [filename for filename in self._get_all_filenames() if self._is_video_file(filename, video_format)]
        # Get video timestamps from the filename
        datetimes_to_filenames = {}
        for file_name in file_names:
            try:
                name = self._remove_file_type(file_name, self.VIDEO_FORMATS.get(video_format))
            except ValueError:
                continue
            channel, timestamp_iso = name.split(VideoWriter.FILENAME_DELIM)
            video_timestamp = datetime.fromisoformat(timestamp_iso)
            datetimes_to_filenames.update({video_timestamp: file_name})
        # Return sorted list of video files, with most recent video first
        datetimes = list(datetimes_to_filenames.keys())
        datetimes.sort(reverse=True)
        return [datetimes_to_filenames[key] for key in datetimes]

    def get_video_filenames_by_date(self, video_format: str = "webm") -> Dict[str, List[str]]:
        all_filenames = [filename for filename in self._get_all_filenames() if self._is_video_file(filename, video_format)]
        filenames_by_date = {}
        for filename in all_filenames:
            try:
                name = self._remove_file_type(filename)
            except ValueError:
                continue
            channel, timestamp_iso = name.split(VideoWriter.FILENAME_DELIM)
            date = timestamp_iso.split("T")[0]
            if date not in filenames_by_date.keys():
                filenames_by_date[date] = []
            filenames_by_date[date].append(filename)
        return filenames_by_date

    def delete_video(self, video_name: str) -> None:
        """
        Deletes the specified video file and its alternate formats from the directory.
        
        :param video_name: The base name of the video file (without extension) to delete.
        :raises FileNotFoundError: If neither version of the video file exists.
        :raises PermissionError: If the file cannot be deleted due to permission issues.
        """
        deleted_any = False  # Track if any files were deleted

        # Remove any existing extension from the video name
        base_name = strip_extension(video_name)

        for video_format, extension in self.VIDEO_FORMATS.items():
            video_path = os.path.join(self.video_dir, f"{base_name}{extension}")
            if os.path.isfile(video_path):
                try:
                    os.remove(video_path)
                    deleted_any = True
                    print(f"Deleted: {video_path}")  # Debugging or logging
                except PermissionError as e:
                    raise PermissionError(f"Permission denied while deleting '{video_path}': {e}")
                except Exception as e:
                    raise Exception(f"An error occurred while deleting '{video_path}': {e}")

        if not deleted_any:
            raise FileNotFoundError(f"Video file '{video_name}' does not exist in any supported format.")

    def _get_all_filenames(self) -> List[str]:
        return os.listdir(self.video_dir)

    @staticmethod
    def _is_video_file(filename: str, file_type: str) -> bool:
        return file_type in filename

    @staticmethod
    def _remove_file_type(filename: str, file_type: str) -> str:
        if file_type in filename:
            return filename.replace(file_type, "")
        raise ValueError("File is not a supported file type")


def strip_extension(filename: str) -> str:
    """
    Removes the file extension from a filename.
    :param filename: The filename with or without an extension.
    :return: The filename without its extension.
    """
    return os.path.splitext(filename)[0]
import datetime
import os
import time
from typing import Tuple

import cv2


class VideoWriter:
    FILENAME_DELIM = "__"

    def __init__(self, channel: str, path="data/videos/",
                 file_types: list[str] = ["webm"]):
        self.channel = channel
        self.video_dir = path
        self.full_filepath = None
        self._make_target_dir(path)
        self.frame_buffer = []
        self.first_frame_time = None
        self.last_frame_time = None
        self.file_types = file_types
        self.resolution = None  # Resolution is determined dynamically

    @staticmethod
    def _make_target_dir(path: str):
        if not os.path.exists(path):
            os.makedirs(path)

    def add_frame(self, frame, timestamp):
        if self.first_frame_time is None:
            self.first_frame_time = timestamp
            # Set resolution dynamically from the first frame
            self.resolution = (frame.shape[1], frame.shape[0])  # (width, height)
        else:
            self.last_frame_time = timestamp
        self.frame_buffer.append(frame)

    def write(self):
        if not self.resolution:
            raise RuntimeError("No frames added to determine resolution.")
        
        self._generate_file_name()
        print("Writing video to: " + self.full_filepath + " ...")
        fps = self._calculate_fps()
        
        if 'webm' in self.file_types:
            self._write_video("webm", 'VP90', fps)
        if 'mp4' in self.file_types:
            self._write_video("mp4", 'mp4v', fps)
        
        self._clear_frame_buffer()

    def _write_video(self, file_type: str, codec: str, fps: int):
        file_path = f"{self.full_filepath}.{file_type}"
        fourcc = cv2.VideoWriter_fourcc(*codec)
        writer = cv2.VideoWriter(file_path, fourcc, fps, self.resolution)
        for frame in self.frame_buffer:
            writer.write(frame)
        writer.release()

    def reset(self):
        self._clear_frame_buffer()
        self.first_frame_time = None
        self.last_frame_time = None
        self.resolution = None  # Reset resolution

    def _clear_frame_buffer(self):
        self.frame_buffer = []

    def _generate_file_name(self):
        date = self._monotonic_to_datetime(self.first_frame_time)
        filename = self.channel + self.FILENAME_DELIM + date.strftime("%Y-%m-%d_%H:%M:%S")
        self.full_filepath = os.path.join(self.video_dir, filename)

    def _calculate_fps(self) -> int:
        elapsed_time = self.last_frame_time - self.first_frame_time
        print('debug elapsed time', elapsed_time)
        return int(len(self.frame_buffer) / elapsed_time)

    def _monotonic_to_datetime(self, monotonic_timestamp):
        monotonic_ref = time.monotonic()
        datetime_ref = datetime.datetime.now()
        elapsed = monotonic_ref - monotonic_timestamp
        return datetime_ref - datetime.timedelta(seconds=elapsed)

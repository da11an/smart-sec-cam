import datetime
import os
import time
from typing import Tuple

import cv2


res_640 = (640, 480)
res_1080p = (1920, 1080)
res_writer = res_640

class VideoWriter:
    FILENAME_DELIM = "__"

    def __init__(self, channel: str, path="data/videos/",
                 resolution: Tuple[int, int] = res_writer,
                 file_types: list[str] = ["webm"]):
        self.channel = channel
        self.video_dir = path
        self.full_filepath = None
        self._make_target_dir(path)
        self.resolution = resolution
        self.frame_buffer = []
        self.first_frame_time = None
        self.last_frame_time = None
        self.file_types = file_types

    @staticmethod
    def _make_target_dir(path: str):
        if not os.path.exists(path):
            os.makedirs(path)

    def add_frame(self, frame, timestamp):
        resized_frame = cv2.resize(frame, self.resolution)
        if self.first_frame_time is None:
            self.first_frame_time = timestamp
        else:
            self.last_frame_time = timestamp
        self.frame_buffer.append(resized_frame)

    def write(self):
        self._generate_file_name()
        print("Writing video to: " + self.full_filepath + " ...")
        fps = self._calculate_fps()
        if 'webm' in self.file_types:
            # Write to .webm
            webm_file = self.full_filepath + ".webm"
            fourcc = cv2.VideoWriter_fourcc(*'VP90')
            writer = cv2.VideoWriter(webm_file, fourcc, fps, self.resolution)
            for frame in self.frame_buffer:
                writer.write(frame)
            writer.release()
            del writer
        if 'mp4' in self.file_types:
            # Write to .mp4
            mp4_file = self.full_filepath + ".mp4"
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            writer = cv2.VideoWriter(mp4_file, fourcc, fps, self.resolution)
            for frame in self.frame_buffer:
                writer.write(frame)
            writer.release()
            del writer
        self._clear_frame_buffer()

    def reset(self):
        self._clear_frame_buffer()
        self.first_frame_time = None
        self.last_frame_time = None

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
        """
        Converts a given time.monotonic() value to an estimated datetime.datetime.

        Parameters:
        monotonic_timestamp (float): The earlier time.monotonic() value to be converted.

        Returns:
        datetime.datetime: The estimated datetime corresponding to the given monotonic timestamp.
        """
        # Capture the current monotonic and datetime reference points
        monotonic_ref = time.monotonic()
        datetime_ref = datetime.datetime.now()

        # Calculate the elapsed time between the input monotonic timestamp and the reference
        elapsed = monotonic_ref - monotonic_timestamp

        # Estimate the corresponding datetime
        estimated_datetime = datetime_ref - datetime.timedelta(seconds=elapsed)

        return estimated_datetime

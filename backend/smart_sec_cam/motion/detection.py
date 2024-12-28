import queue
import threading
import time
from typing import List
from math import pow

import cv2
import imutils
import numpy as np

from smart_sec_cam.video.writer import VideoWriter


class MotionDetector:
    def __init__(self, channel_name: str, motion_threshold: int = 10000, video_duration_seconds: int = 60,
                 video_dir: str = "data/videos", initial_frame_sample_rate: int = 2):
        self.channel_name = channel_name
        self.motion_threshold = motion_threshold
        self.video_duration = video_duration_seconds
        self.video_dir = video_dir
        self.video_writer = VideoWriter(self.channel_name, path=self.video_dir)
        self.frame_queue = queue.Queue()
        self.frame_time_queue = queue.Queue()
        self.detection_thread = threading.Thread(target=self.run, daemon=True)
        self.shutdown = False

        # Frame sampling
        self.frame_sample_rate = initial_frame_sample_rate
        self.frame_count = 0

    def add_frame(self, frame: bytes):
        self.frame_queue.put(frame)
        self.frame_time_queue.put(time.monotonic())

    def run(self):
        last_frame = None
        last_frame_greyscale = None
        recorded_video = False
        while not self.shutdown:
            # Adjust frame sample rate based on queue size
            self._adjust_sample_rate()

            # Process frames from the queue
            if not self.frame_queue.empty():
                # Increment frame count
                if self.frame_count > 1e10:
                    self.frame_count += 1 - 1e10
                else:
                    self.frame_count += 1

                # Only process frames based on the sample rate
                if self.frame_count % self.frame_sample_rate == 0:
                    decoded_frame, decoded_grey, timestamp = self._get_decoded_frame_tuple()
                    if last_frame is not None:
                        if self._detect_motion(last_frame_greyscale, decoded_grey):
                            print(f"Detected motion for channel: {self.channel_name}")
                            self._record_video(
                                [last_frame, decoded_frame],
                                [last_frame_greyscale, decoded_grey],
                                last_timestamp
                            )
                            recorded_video = True
                    # Set current frame to last frame
                    if not recorded_video:
                        last_frame = decoded_frame
                        last_frame_greyscale = decoded_grey
                        last_timestamp = timestamp
                    else:
                        print(f"Done recording video for channel: {self.channel_name}")
                        last_frame = None
                        last_frame_greyscale = None
                        recorded_video = False
            else:
                time.sleep(0.01)

    def run_in_background(self):
        self.detection_thread.start()

    def stop(self):
        self.shutdown = True

    def _has_decoded_frame(self) -> bool:
        return not self.frame_queue.empty()

    def _adjust_sample_rate(self):
        """Dynamically adjust frame sampling rate based on queue size."""
        self.frame_sample_rate = max(round(pow(self.frame_queue.qsize(), 0.2)), 1)
        print(f"Queue size {self.frame_queue.qsize()}; setting sampling rate to {self.frame_sample_rate}")

    def _get_decoded_frame_tuple(self):
        new_frame = self.frame_queue.get()
        timestamp = self.frame_time_queue.get()
        return self._decode_frame(new_frame), self._decode_frame_greyscale(new_frame), timestamp

    def _detect_motion(self, old_frame_greyscale, new_frame_greyscale) -> bool:
        """Detection motion between two frames using contours."""
        if old_frame_greyscale is None:
            return False
        # Calculate background subtraction
        frame_delta = cv2.absdiff(old_frame_greyscale, new_frame_greyscale)
        # Calculate and dilate threshold
        threshold = cv2.threshold(frame_delta, 25, 255, cv2.THRESH_BINARY)[1]
        threshold = cv2.dilate(threshold, None, iterations=2)
        # Extract contours from the threshold image
        contours = cv2.findContours(threshold.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        contours = imutils.grab_contours(contours)
        # Iterate over contours and determine if any are large enough to count as motion
        for contour in contours:
            if cv2.contourArea(contour) >= self.motion_threshold:
                return True
        return False

    def _draw_motion_areas_on_frame(self, old_frame, new_frame):
        if old_frame is None:
            return new_frame
        # Convert frames to greyscale
        old_frame_greyscale = cv2.cvtColor(old_frame, cv2.COLOR_BGR2GRAY)
        new_frame_greyscale = cv2.cvtColor(new_frame, cv2.COLOR_BGR2GRAY)
        # Calculate background subtraction
        frame_delta = cv2.absdiff(old_frame_greyscale, new_frame_greyscale)
        # Calculate and dilate threshold
        threshold = cv2.threshold(frame_delta, 25, 255, cv2.THRESH_BINARY)[1]
        threshold = cv2.dilate(threshold, None, iterations=2)
        # Extract contours from the threshold image
        contours = cv2.findContours(threshold.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        contours = imutils.grab_contours(contours)
        # Iterate over contours and determine if any are large enough to count as motion
        modified_frame = new_frame.copy()
        for contour in contours:
            if cv2.contourArea(contour) >= self.motion_threshold:
                x, y, w, h = cv2.boundingRect(contour)
                cv2.rectangle(modified_frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
        return modified_frame

    def _record_video(self, first_frames: List, first_frames_greyscale: List, timestamp):
        start_time = time.monotonic()
        self.video_writer.reset()
        old_frame = None
        frame_counter = 0

        # Add initial frames
        for frame in first_frames:
            self.video_writer.add_frame(frame, timestamp)
            old_frame = frame
        
        old_grey = first_frames_greyscale[-1]

        # Process frames until recording duration is complete
        motionless_frames = 0
        while not self._recording_timeout(start_time) and motionless_frames < 20:
            if self._has_decoded_frame():
                new_frame, new_grey, timestamp = self._get_decoded_frame_tuple()
                # new_frame = self._draw_motion_areas_on_frame(old_frame, new_frame)
                self.video_writer.add_frame(new_frame, timestamp)
                # check for continued motion
                if self._detect_motion(old_grey, new_grey):
                    motionless_frames = 0
                else:
                    motionless_frames += 1
                # cycle frames
                old_frame = new_frame
                old_grey = new_grey
            else:
                time.sleep(0.001)

        # Finalize video
        self.video_writer.write()

    def _recording_timeout(self, start_time: float) -> bool:
        if self.video_writer.last_frame_time is None:
            return False
        else:
            elapsed_time = self.video_writer.last_frame_time - self.video_writer.first_frame_time
        return elapsed_time > self.video_duration

    @staticmethod
    def _decode_frame(frame: bytes):
        return cv2.imdecode(np.frombuffer(frame, dtype=np.uint8), cv2.IMREAD_COLOR)

    @staticmethod
    def _decode_frame_greyscale(frame: bytes):
        """Convert frame to greyscale and blur it."""
        greyscale_frame = cv2.imdecode(np.frombuffer(frame, dtype=np.uint8), cv2.IMREAD_GRAYSCALE)
        return cv2.GaussianBlur(greyscale_frame, (21, 21), 0)

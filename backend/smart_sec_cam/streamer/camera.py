from abc import ABC, abstractmethod
from typing import Tuple

import cv2
import numpy as np
# from picamera import PiCamera # install prior to use


class Camera(ABC):
    """Abstract base class for camera implementations."""
    
    @abstractmethod
    def capture_image(self) -> bytes:
        """Capture an image and return it as JPEG bytes."""
        pass

    @abstractmethod
    def close(self):
        """Release the camera resources."""
        pass


class UsbCamera(Camera):
    """Generic USB camera class"""
    def __init__(self, usb_port: int = 0, resolution: Tuple[int, int] = (640, 480), jpeg_quality: int = 70,
                 image_rotation: int = 0):
        self.usb_port = usb_port
        self.resolution = resolution
        self.encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_quality]
        self.camera = cv2.VideoCapture(int(self.usb_port))
        self._set_resolution()
        self.image_rotation = image_rotation

    def capture_image(self) -> bytes:
        ret, frame = self.camera.read()
        if not ret:
            raise RuntimeError('Failed to capture image - check camera port value')
        if self.image_rotation:
            frame = self._rotate_image(frame)
        processed_image_data = (cv2.imencode('.jpeg', frame, self.encode_params)[1]).tobytes()
        return processed_image_data

    def close(self):
        self.camera.release()

    def _set_resolution(self):
        # OpenCV is (height, width), not (width, height)
        self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, self.resolution[1])
        self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, self.resolution[0])

    def _rotate_image(self, frame):
        if self.image_rotation == 90:
            return cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)
        elif self.image_rotation == -90 or self.image_rotation == 270:
            return cv2.rotate(frame, cv2.ROTATE_90_COUNTERCLOCKWISE)
        elif self.image_rotation == 180:
            return cv2.rotate(frame, cv2.ROTATE_180)
        else:
            print(f"Invalid rotation value: {self.image_rotation}")
            return frame


class RPiCamera(Camera):
    """Raspberry Pi camera class"""
    def __init__(self, resolution: Tuple[int, int] = (640, 480), jpeg_quality: int = 70, image_rotation: int = 0):
        self.encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_quality]
        self.camera = PiCamera()
        self._set_resolution(resolution)
        self._set_rotation(image_rotation)

    def capture_image(self) -> bytes:
        frame = np.empty((self.camera.resolution[1], self.camera.resolution[0], 3), dtype=np.uint8)
        self.camera.capture(frame, format='bgr', use_video_port=True)
        processed_image_data = (cv2.imencode('.jpeg', frame, self.encode_params)[1]).tobytes()
        return processed_image_data

    def close(self):
        self.camera.close()

    def _set_resolution(self, resolution: Tuple[int, int]):
        self.camera.resolution = resolution

    def _set_rotation(self, rotation: int):
        self.camera.rotation = rotation


class WebCam720p(UsbCamera):
    """720p USB camera class"""
    def __init__(self, usb_port: int = 0, jpeg_quality: int = 70, image_rotation: int = 0):
        super().__init__(usb_port=usb_port, resolution=(720, 1280), jpeg_quality=jpeg_quality, image_rotation=image_rotation)


webcam720p = WebCam720p(usb_port=0, jpeg_quality=70, image_rotation=0)
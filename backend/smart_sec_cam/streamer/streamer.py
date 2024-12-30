import queue
import time
import socket
from threading import Thread

import redis.exceptions

from camera import Camera, webcam720p
from smart_sec_cam.redis import RedisImageSender

shutdown = False


class Streamer:
    def __init__(self, server_address: str, server_port: int, capture_delay: float = 0.1,
                 camera: Camera = None):
        assert camera is not None, "Camera object must be provided"
        self.cap_delay = capture_delay
        self.camera = camera
        # Image data queues
        self.image_queue = queue.Queue(maxsize=int(5.0/capture_delay))  # Only queue 5 seconds of video
        # Image sending client
        self.server_address = server_address
        self.server_port = int(server_port)
        self.image_sender = RedisImageSender(socket.gethostname(), self.server_address, self.server_port)

    def capture_images(self):
        global shutdown
        print('Starting image capture thread')
        while not shutdown:
            try:
                # print('Image capturing...')
                self.image_queue.put(self.camera.capture_image())
                # print('image_queue size', self.image_queue.qsize())
                time.sleep(self.cap_delay)  # Prevents capture from eating cpu time
            except RuntimeError as e:
                print(e)
                shutdown = True
                break
        self.camera.close()
        print('Exited image capture thread')

    def send_images(self):
        global shutdown
        print("Started image sending thread.")
        while not shutdown:
            image_data = self.image_queue.get()
            try:
                # print('Image sending...')
                self.image_sender.send_message(image_data)
            except redis.exceptions.ConnectionError as e:
                print(f"Caught connection error to server {e}, trying to reconnect...")
                time.sleep(1)
                self.reconnect()
        print("Exited image sending thread")

    def reconnect(self):
        self.image_sender = RedisImageSender(socket.gethostname(), self.server_address, self.server_port)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument('--redis-url', help='Server address to stream images to', default='localhost')
    parser.add_argument('--redis-port', help='Server port to stream images to', default=6380)
    parser.add_argument('--capture-delay', help="Delay between capturing a new frame", default=0.1)
    parser.add_argument('--cam-class', help="Choose a defined Camera class from camera.py", default='WebCam720p')
    args = parser.parse_args()
    # Setup streamer and start threads
    if args.cam_class == 'WebCam720p':
        streamer = Streamer(args.redis_url, args.redis_port, args.capture_delay, webcam720p)
    else:
        raise ValueError(f"Invalid camera class: {args.cam_class}. Add a new camera class to camera.py and streamer.py.")
    
    captureThread = Thread(target=streamer.capture_images)
    senderThread = Thread(target=streamer.send_images)
    captureThread.start()
    senderThread.start()

#!/bin/bash

#sudo iwconfig wlan0 power off
source /home/dallan/smart-sec-cam/backend/venv/bin/activate
python3 streamer.py

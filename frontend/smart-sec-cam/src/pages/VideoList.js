import React, { useState } from "react";
import ReactPlayer from "react-player";
import ReactModal from "react-modal";

const SERVER_URL = "https://localhost:8443";
const VIDEO_ENDPOINT = "/api/video/";

export default function VideoList({ videoFileNames, cookies }) {
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedVideo, setSelectedVideo] = useState(null);

    // Helper function to extract date from filename
    const extractDateFromFileName = (fileName) => {
        const match = fileName.match(/__(\d{4}-\d{2}-\d{2})_/); // Extracts YYYY-MM-DD
        return match ? match[1] : null;
    };

    // Group videos by date
    const videosByDate = videoFileNames.reduce((acc, videoFileName) => {
        const date = extractDateFromFileName(videoFileName);
        if (date) {
            if (!acc[date]) {
                acc[date] = [];
            }
            acc[date].push(videoFileName);
        }
        return acc;
    }, {});

    const handleDateClick = (date) => {
        setSelectedDate(date);
    };

    const closeModal = () => {
        setSelectedVideo(null);
    };

    return (
        <div className="VideoList">
            {/* Date List */}
            {!selectedDate && (
                <div className="dateList">
                    <ul>
                        {Object.keys(videosByDate).map((date) => (
                            <li key={date}>
                                <button onClick={() => handleDateClick(date)}>
                                    {date} ({videosByDate[date].length})
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Video Grid for Selected Date */}
            {selectedDate && (
                <div className="videoContainer">
                    <button onClick={() => setSelectedDate(null)}>Back to Dates</button>
                    <div className="videoGrid">
                        {videosByDate[selectedDate].map((videoFileName) => (
                            <button
                                key={videoFileName}
                                className="videoThumbnailButton"
                                onClick={() => setSelectedVideo(videoFileName)}
                            >
                                <video
                                    className="videoThumbnail"
                                    width="200"
                                    height="120"
                                    muted
                                    loop
                                    autoPlay
                                >
                                    <source
                                        src={`${SERVER_URL}${VIDEO_ENDPOINT}${videoFileName}?token=${cookies.token}`}
                                        type="video/webm"
                                    />
                                    Your browser does not support the video tag.
                                </video>
                                <span>{videoFileName}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Modal for Video Playback */}
            <ReactModal
                isOpen={!!selectedVideo}
                onRequestClose={closeModal}
                className="videoModal"
                overlayClassName="videoModalOverlay"
            >
                <button className="closeButton" onClick={closeModal}>
                    Close
                </button>
                {selectedVideo && (
                    <ReactPlayer
                        url={`${SERVER_URL}${VIDEO_ENDPOINT}${selectedVideo}?token=${cookies.token}`}
                        width="100%"
                        height="90vh"
                        controls
                        playing
                    />
                )}
            </ReactModal>
        </div>
    );
}

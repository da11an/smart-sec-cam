import io from "socket.io-client"

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { isIOS } from "react-device-detect";
import { useCookies } from "react-cookie";
import Modal from "react-modal";
import { DateTime } from "luxon";

import ImageViewer from "../components/ImageViewer";
import { VideoPreviewer } from "../components/VideoComponents";
import NavBar from "../components/NavBar";

import { validateToken } from "../utils/ValidateToken";
import { getTokenTTL } from "../utils/GetTokenTTL";
import { refreshToken } from "../utils/RefreshToken";
import "./VideoList.css";
import SERVER_URL from '../config';

const VIDEOS_ENDPOINT = "/api/video/video-list";
const ROOMS_ENDPOINT = "/api/video/rooms";
const DELETE_VIDEO_ENDPOINT = "/api/video";
const socket = io(SERVER_URL);

Modal.setAppElement("#root");

function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
}

function extractDateTimeFromFilename(filename) {
    const match = filename.match(/__(\d{4}-\d{2}-\d{2}_\d{2}:\d{2}:\d{2})/);
    if (match) {
        const utcTime = DateTime.fromFormat(match[1], "yyyy-MM-dd_HH:mm:ss", {
            zone: "utc",
        });
        const localTime = utcTime.setZone("America/Chicago");
        return localTime.toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS);
    }
    return filename;
}

export default function VideoList(props) {
    const [videoFileNames, setVideoFileNames] = React.useState([]);
    const [videoDurations, setVideoDurations] = React.useState({});
    const [selectedVideoFile, setSelectedVideoFile] = React.useState(null);
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [rooms, setRooms] = useState([]); // Live rooms
    const [hasValidToken, setHasValidToken] = React.useState(null);
    const [tokenTTL, setTokenTTL] = React.useState(null);
    const [cookies] = useCookies(["token"]);
    const [editingMode, setEditingMode] = useState(false); // New state for editing mode
    const navigate = useNavigate();
    const [jumpToPage, setJumpToPage] = React.useState("");
    const [currentPage, setCurrentPage] = React.useState(1);
    const itemsPerPage = 12;

    React.useEffect(() => {
        if (cookies.token == null) {
            navigate("/", {});
        } else {
            try {
                validateToken(cookies.token, setHasValidToken);
            } catch {
                navigate("/", {});
            }
        }
    }, []);

    React.useEffect(() => {
        if (hasValidToken) {
            getTokenTTL(cookies.token, setTokenTTL);

            const requestOptions = {
                method: "GET",
                headers: { "x-access-token": cookies.token },
            };

            let videoFormat = "webm";
            if (isIOS) {
                videoFormat = "mp4";
            }

            const requestUrl = `${SERVER_URL}${VIDEOS_ENDPOINT}?video-format=${videoFormat}`;
            fetch(requestUrl, requestOptions)
                .then((resp) => resp.json())
                .then((data) => setVideoList(data["videos"]));

            // Fetch live rooms
            fetch(`${SERVER_URL}${ROOMS_ENDPOINT}`, requestOptions)
                .then((resp) => resp.json())
                .then((data) => setRooms(Object.keys(data["rooms"])));
        } else if (hasValidToken === false) {
            navigate("/", {});
        }
    }, [hasValidToken]);

    React.useEffect(() => {
        if (tokenTTL == null) {
            return;
        }
        if (tokenTTL < 0) {
            navigate("/", {});
        }
        const tokenRefreshInterval = Math.max((tokenTTL - 60) * 1000, 0);

        const timer = setTimeout(() => {
            refreshToken(cookies.token);
            setHasValidToken(null);
        }, tokenRefreshInterval);

        return () => clearTimeout(timer);
    }, [tokenTTL]);

    function setVideoList(videoList) {
        setVideoFileNames(videoList);
    }

    function handleMetadataLoaded(videoFileName, duration) {
        setVideoDurations((prevDurations) => ({
            ...prevDurations,
            [videoFileName]: duration,
        }));
    }

    function handleClick(videoFileName) {
        setSelectedVideoFile(videoFileName);
        setIsModalOpen(true);
    }

    function handleDelete(videoFileName) {
        const requestOptions = {
            method: "DELETE",
            headers: {
                "x-access-token": cookies.token,
                "Content-Type": "application/json",
            },
        };

        fetch(`${SERVER_URL}${DELETE_VIDEO_ENDPOINT}/${videoFileName}`, requestOptions)
            .then((resp) => {
                if (resp.ok) {
                    setVideoFileNames((prev) => prev.filter((name) => name !== videoFileName));
                    setVideoDurations((prev) => {
                        const newDurations = { ...prev };
                        delete newDurations[videoFileName];
                        return newDurations;
                    });
                }
            })
            .catch((error) => console.error("Error deleting video:", error));
    }

    // Combine live streams with videos
    const combinedItems = [...rooms, ...videoFileNames];

    // Calculate pagination based on combined items
    const totalPages = Math.ceil(combinedItems.length / itemsPerPage);
    const paginatedItems = combinedItems.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handlePageChange = (newPage) => {
        if (newPage > 0 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    return (
        <div className="VideoList">
            <NavBar onEditingModeChange={(isEditing) => setEditingMode(isEditing)} />
            <div className="videoGridContainer">
                <div className="videoGrid">
                    {paginatedItems.map((item) =>
                        rooms.includes(item) ? (
                            // Render live streams
                            <div key={item} className="videoGridItem liveFeed">
                                <button
                                    onClick={() => handleClick(item)}
                                    className="videoThumbnailButton"
                                >
                                    <ImageViewer room={item} />
                                    <div className="thumbnailOverlay">Live: {item}</div>
                                </button>
                            </div>
                        ) : (
                            // Render video thumbnails
                            <div key={item} className="videoGridItem">
                                <div className="videoThumbnailContainer">
                                    <button
                                        onClick={() => handleClick(item)}
                                        className="videoThumbnailButton"
                                    >
                                        <VideoPreviewer
                                            videoFileName={item}
                                            token={cookies.token}
                                            onMetadataLoaded={(duration) =>
                                                handleMetadataLoaded(item, duration)
                                            }
                                        />
                                        <div className="thumbnailOverlay">
                                            <div className="thumbnailText">
                                                <span className="videoDate">{extractDateTimeFromFilename(item)}</span>
                                                <br />
                                                <span className="videoDuration">
                                                    {videoDurations[item]
                                                        ? formatDuration(videoDurations[item])
                                                        : "Loading..."}
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                                {editingMode && (
                                    <div className="actionButtons">
                                        <span className="videoDuration">
                                            {videoDurations[item]
                                                ? formatDuration(videoDurations[item])
                                                : "Loading..."}
                                        </span>
                                        <a
                                            href={`${SERVER_URL}/api/video/${item}?token=${cookies.token}`}
                                            className="downloadButton"
                                            download
                                        >
                                            Download
                                        </a>
                                        <button
                                            onClick={() => handleDelete(item)}
                                            className="deleteButton"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        )
                    )}
                </div>
                <div className="pagination">
                    <button
                        onClick={() => handlePageChange(1)}
                        disabled={currentPage === 1}
                    >
                        First
                    </button>
                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                    >
                        Previous
                    </button>
                    {/* Page Range Links */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((page) => Math.abs(page - currentPage) <= 2) // Show pages around the current one
                        .map((page) => (
                            <button
                                key={page}
                                onClick={() => handlePageChange(page)}
                                disabled={page === currentPage}
                                className={page === currentPage ? "activePage" : ""}
                            >
                                {page}
                            </button>
                        ))}
                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                    >
                        Next
                    </button>
                    <button
                        onClick={() => handlePageChange(totalPages)}
                        disabled={currentPage === totalPages}
                    >
                        Last
                    </button>

                    {/* Jump to Page */}
                    <div className="jumpToPage">
                        <label htmlFor="jumpTo">Jump to:</label>
                        <input
                            id="jumpTo"
                            type="number"
                            min="1"
                            max={totalPages}
                            value={jumpToPage}
                            onChange={(e) => setJumpToPage(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    handlePageChange(Number(jumpToPage));
                                }
                            }}
                        />
                    </div>
                </div>
            </div>
            {isModalOpen && selectedVideoFile && (
                <Modal
                    isOpen={isModalOpen}
                    onRequestClose={() => setIsModalOpen(false)}
                    contentLabel="Video Player"
                    className="videoModal"
                    overlayClassName="videoModalOverlay"
                >
                    <div className="modalInfoBar">
                        <span className="modalVideoDate">{extractDateTimeFromFilename(selectedVideoFile)}</span>                    
                        <span className="modalVideoDuration">
                            {videoDurations[selectedVideoFile]
                                ? formatDuration(videoDurations[selectedVideoFile])
                                : "Loading..."}
                        </span>
                        <a
                            href={`${SERVER_URL}/api/video/${selectedVideoFile}?token=${cookies.token}`}
                            className="downloadButton"
                            download
                        >
                            Download
                        </a>
                        <button
                            onClick={() => {
                                handleDelete(selectedVideoFile);
                                setIsModalOpen(false);
                            }}
                            className="deleteButton"
                        >
                            Delete
                        </button>
                        <button className="closeButton" onClick={() => setIsModalOpen(false)}>
                            Close
                        </button>
                    </div>
                    <div className={`modalContent ${rooms.includes(selectedVideoFile) ? "liveFeedModal" : ""}`}>
                        {rooms.includes(selectedVideoFile) ? (
                            <ImageViewer room={selectedVideoFile} />
                        ) : (
                            <video
                                className="videoPlayer"
                                src={`${SERVER_URL}/api/video/${selectedVideoFile}?token=${cookies.token}`}
                                controls
                                autoPlay
                            />
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
}

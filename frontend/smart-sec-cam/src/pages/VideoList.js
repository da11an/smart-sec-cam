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
import SpaceUsage from '../components/SpaceUsage';

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
        return localTime.toLocaleString(DateTime.DATETIME_MED);
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
    const [starredVideos, setStarredVideos] = useState(new Set());

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
        // First set the video list to ensure thumbnails start loading
        setVideoFileNames(videoList);
    }

    React.useEffect(() => {
        const fetchStarStatus = async (filename) => {
            try {
                const response = await fetch(`${SERVER_URL}/api/video/${encodeURIComponent(filename)}/info`, {
                    headers: {
                        'x-access-token': cookies.token
                    }
                });
                if (!response.ok) {
                    console.warn(`Failed to fetch star status for ${filename}`);
                    return false;
                }
                const data = await response.json();
                return data.starred;
            } catch (error) {
                console.warn(`Error fetching star status for ${filename}:`, error);
                return false;
            }
        };

        const fetchAllStarStatus = async () => {
            if (!videoFileNames.length) return;

            // Process in batches of 5
            const batchSize = 5;
            const starredSet = new Set();

            for (let i = 0; i < videoFileNames.length; i += batchSize) {
                const batch = videoFileNames.slice(i, i + batchSize);
                try {
                    const results = await Promise.all(
                        batch.map(async filename => {
                            const isStarred = await fetchStarStatus(filename);
                            if (isStarred) {
                                starredSet.add(filename);
                            }
                            return { filename, isStarred };
                        })
                    );
                    
                    // Update starred videos after each batch
                    setStarredVideos(new Set(starredSet));
                } catch (error) {
                    console.error('Error processing batch:', error);
                }

                // Add a small delay between batches
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        };

        fetchAllStarStatus();
    }, [videoFileNames, cookies.token]);

    function handleMetadataLoaded(videoFileName, duration) {
        setVideoDurations((prevDurations) => ({
            ...prevDurations,
            [videoFileName]: duration,
        }));
    }

    function handleClick(videoFileName) {
        setSelectedVideoFile(videoFileName);
        setIsModalOpen(true);
        if (!rooms.includes(videoFileName)) {
            fetchStarStatus(videoFileName);
        }
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

    const fetchStarStatus = async (videoFileName) => {
        try {
            const response = await fetch(`${SERVER_URL}/api/video/${videoFileName}/info`, {
                headers: {
                    'x-access-token': cookies.token
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                setStarredVideos(prev => {
                    const newSet = new Set(prev);
                    if (data.starred) {
                        newSet.add(videoFileName);
                    } else {
                        newSet.delete(videoFileName);
                    }
                    return newSet;
                });
            }
        } catch (error) {
            console.error('Error fetching star status:', error);
        }
    };

    const handleStarToggle = async (videoFileName) => {
        try {
            const newStarred = !starredVideos.has(videoFileName);
            
            // Optimistic update
            setStarredVideos(prev => {
                const newSet = new Set(prev);
                if (newStarred) {
                    newSet.add(videoFileName);
                } else {
                    newSet.delete(videoFileName);
                }
                return newSet;
            });

            const response = await fetch(`${SERVER_URL}/api/video/${videoFileName}/star`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': cookies.token
                },
                body: JSON.stringify({ starred: newStarred })
            });

            if (!response.ok) {
                // Revert on failure
                setStarredVideos(prev => {
                    const newSet = new Set(prev);
                    if (newStarred) {
                        newSet.delete(videoFileName);
                    } else {
                        newSet.add(videoFileName);
                    }
                    return newSet;
                });
                console.error('Failed to update star status');
            }
        } catch (error) {
            console.error('Error toggling star:', error);
            // Revert on error
            setStarredVideos(prev => {
                const newSet = new Set(prev);
                if (!prev.has(videoFileName)) {
                    newSet.add(videoFileName);
                } else {
                    newSet.delete(videoFileName);
                }
                return newSet;
            });
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
                                <div className={`videoThumbnailContainer ${starredVideos.has(item) ? 'starred' : ''}`}>
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
                        <span className="modalVideoDate">
                            {extractDateTimeFromFilename(selectedVideoFile)}
                        </span>
                        <span className="modalVideoDuration">
                            {videoDurations[selectedVideoFile]
                                ? formatDuration(videoDurations[selectedVideoFile])
                                : "Loading..."}
                        </span>
                        <button
                            onClick={() => handleStarToggle(selectedVideoFile)}
                            className={`starButton ${starredVideos.has(selectedVideoFile) ? 'starred' : ''}`}
                            title={starredVideos.has(selectedVideoFile) ? "Unstar video" : "Star video"}
                        >
                            {starredVideos.has(selectedVideoFile) ? "★" : "☆"}
                        </button>
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

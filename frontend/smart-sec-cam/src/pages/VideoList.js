import React from "react";
import { useNavigate } from "react-router-dom";
import { isIOS } from "react-device-detect";
import { useCookies } from "react-cookie";
import Modal from "react-modal";

import { VideoPreviewer } from "../components/VideoComponents";
import NavBar from "../components/NavBar";

import { validateToken } from "../utils/ValidateToken";
import { getTokenTTL } from "../utils/GetTokenTTL";
import { refreshToken } from "../utils/RefreshToken";
import "./VideoList.css";

const SERVER_URL = "https://localhost:8443";
const VIDEOS_ENDPOINT = "/api/video/video-list";
const DELETE_VIDEO_ENDPOINT = "/api/video";

Modal.setAppElement("#root");

function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
}

export default function VideoList(props) {
    const [videoFileNames, setVideoFileNames] = React.useState([]);
    const [videoDurations, setVideoDurations] = React.useState({});
    const [selectedVideoFile, setSelectedVideoFile] = React.useState(null);
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [hasValidToken, setHasValidToken] = React.useState(null);
    const [tokenTTL, setTokenTTL] = React.useState(null);
    const [cookies] = useCookies(["token"]);
    const navigate = useNavigate();

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
                } else {
                    console.error("Failed to delete video:", resp.statusText);
                }
            })
            .catch((error) => console.error("Error deleting video:", error));
    }

    const totalPages = Math.ceil(videoFileNames.length / itemsPerPage);
    const paginatedItems = videoFileNames.slice(
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
            <NavBar />
            <div className="videoGridContainer">
                <div className="videoGrid">
                    {paginatedItems.map((videoFileName) => (
                        <div key={videoFileName} className="videoGridItem">
                            <button
                                onClick={() => handleClick(videoFileName)}
                                className="videoThumbnailButton"
                            >
                                <VideoPreviewer
                                    videoFileName={videoFileName}
                                    token={cookies.token}
                                    onMetadataLoaded={(duration) =>
                                        handleMetadataLoaded(videoFileName, duration)
                                    }
                                />
                                <span className="videoFileName">{videoFileName}</span>
                            </button>
                            <div className="actionButtons">
                                <span className="videoDuration">
                                    {videoDurations[videoFileName]
                                        ? formatDuration(videoDurations[videoFileName])
                                        : "Loading..."}
                                </span>
                                <a
                                    href={`${SERVER_URL}/api/video/${videoFileName}?token=${cookies.token}`}
                                    className="downloadButton"
                                    download
                                >
                                    Download
                                </a>
                                <button
                                    onClick={() => handleDelete(videoFileName)}
                                    className="deleteButton"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="pagination">
                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                    >
                        Previous
                    </button>
                    <span> Page {currentPage} of {totalPages} </span>
                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                    >
                        Next
                    </button>
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
                    <div className="modalTopBar">
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
                    <div className="modalContent">
                        <video
                            src={`${SERVER_URL}/api/video/${selectedVideoFile}?token=${cookies.token}`}
                            controls
                            autoPlay
                        />
                    </div>
                </Modal>
            )}
        </div>
    );
}

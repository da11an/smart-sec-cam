import React from "react";
import { useNavigate } from "react-router-dom";
import { isIOS } from "react-device-detect";
import { useCookies } from "react-cookie";

import { VideoPlayer, VideoPreviewer } from "../components/VideoComponents";
import NavBar from "../components/NavBar";

import { validateToken } from "../utils/ValidateToken";
import { getTokenTTL } from "../utils/GetTokenTTL";
import { refreshToken } from "../utils/RefreshToken";
import "./VideoList.css";

const SERVER_URL = "https://localhost:8443";
const VIDEOS_ENDPOINT = "/api/video/video-list";

export default function VideoList(props) {
    const [videoFileNames, setVideoFileNames] = React.useState([]);
    const [selectedVideoFile, setSelectedVideoFile] = React.useState(null);
    const [hasValidToken, setHasValidToken] = React.useState(null);
    const [tokenTTL, setTokenTTL] = React.useState(null);
    const [cookies, setCookie] = useCookies(["token"]);
    const navigate = useNavigate();

    const [currentPage, setCurrentPage] = React.useState(1);
    const itemsPerPage = 5;

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
            refreshToken(cookies.token, setCookie);
            setHasValidToken(null);
        }, tokenRefreshInterval);

        return () => clearTimeout(timer);
    }, [tokenTTL]);

    React.useEffect(() => {
        if (cookies == null || cookies.token == null) {
            return;
        }
        try {
            validateToken(cookies.token, setHasValidToken);
        } catch {
            navigate("/", {});
        }
    }, [cookies]);

    function setVideoList(videoList) {
        setVideoFileNames(videoList);
        setSelectedVideoFile(videoList[0]);
    }

    function handleClick(videoFileName) {
        setSelectedVideoFile(videoFileName);
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
            <div className="videoContainer">
                <div className="videoList">
                    <React.Fragment>
                        <ul className="list-group">
                            {paginatedItems.map((videoFileName) => (
                                <li key={videoFileName}>
                                    <button
                                        value={videoFileName}
                                        onClick={() => handleClick(videoFileName)}
                                        className="videoThumbnailButton"
                                    >
                                        <VideoPreviewer
                                            videoFileName={videoFileName}
                                            token={cookies.token}
                                        />
                                        <span className="videoFileName">{videoFileName}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
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
                    </React.Fragment>
                </div>
                <div className="videoPlayer">
                    <VideoPlayer videoFileName={selectedVideoFile} token={cookies.token} />
                </div>
            </div>
        </div>
    );
}

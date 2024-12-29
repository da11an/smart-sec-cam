import ReactPlayer from 'react-player'

const SERVER_URL = "https://localhost:8443"
const VIDEO_ENDPOINT = "/api/video/"

export function VideoPlayer(props) {
    const videoUrl = SERVER_URL + VIDEO_ENDPOINT + props.videoFileName + "?token=" + props.token;
    return (
        <ReactPlayer
            url={videoUrl}
            width="100%"
            height="90vh"
            controls={true}
            playing={true} // Enables autoplay
            muted={true} // Ensures autoplay works on modern browsers
        />
    );
}

export function VideoPreviewer({ videoFileName, token, onMetadataLoaded }) {
    const videoUrl = `${SERVER_URL}${VIDEO_ENDPOINT}${videoFileName}?token=${token}`;

    const handleMetadata = (e) => {
        if (onMetadataLoaded) {
            onMetadataLoaded(e.target.duration);
        }
    };

    return (
        <video
            className="videoThumbnail"
            src={videoUrl}
            muted
            loop
            autoPlay
            onLoadedMetadata={handleMetadata}
        >
            Your browser does not support the video tag.
        </video>
    );
}

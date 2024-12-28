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

export function VideoPreviewer({ videoFileName, token }) {
    const videoUrl = `${SERVER_URL}${VIDEO_ENDPOINT}${videoFileName}?token=${token}`;

    return (
        <video
            className="videoThumbnail"
            muted
            loop
            autoPlay
            playsInline
        >
            <source src={videoUrl} type="video/webm" />
            Your browser does not support the video tag.
        </video>
    );
}
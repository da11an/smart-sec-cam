import React from "react";
import { useNavigate } from "react-router-dom";
import { useCookies } from "react-cookie";

import ImageViewer from "./components/ImageViewer";
import NavBar from "./components/NavBar";

import { validateToken } from "./utils/ValidateToken";
import { getTokenTTL } from "./utils/GetTokenTTL";
import { SocketProvider } from "./context/SocketContext";

import "./App.css";
import { refreshToken } from "./utils/RefreshToken";

const SERVER_URL = "https://localhost:8443";
const ROOMS_ENDPOINT = "/api/video/rooms";

export default function App() {
    const [rooms, setRooms] = React.useState([]);
    const [hasValidToken, setHasValidToken] = React.useState(null);
    const [tokenTTL, setTokenTTL] = React.useState(null);
    const [cookies, setCookie] = useCookies(["token"]);
    const navigate = useNavigate();

    React.useEffect(() => {
        // Check cookie for valid token. If not, navigate to the login screen
        if (!cookies.token) {
            navigate("/", {});
        } else {
            try {
                validateToken(cookies.token, setHasValidToken);
            } catch {
                navigate("/", {});
            }
        }
    }, [cookies.token]);

    React.useEffect(() => {
        if (hasValidToken) {
            getTokenTTL(cookies.token, setTokenTTL);

            const requestOptions = {
                method: "GET",
                headers: { "x-access-token": cookies.token },
            };

            fetch(SERVER_URL + ROOMS_ENDPOINT, requestOptions)
                .then((resp) => resp.json())
                .then((data) => {
                    setRooms(Object.keys(data.rooms || {}));
                });
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

    return (
        <SocketProvider>
            <div className="App">
                <NavBar token={cookies.token} />
                <div className="image-container">
                    {rooms.map((room_name) => (
                        <ImageViewer key={room_name} room={room_name} />
                    ))}
                </div>
            </div>
        </SocketProvider>
    );
}

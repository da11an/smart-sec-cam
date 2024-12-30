import React, { useEffect, useState } from "react";
import { useSocket } from "../context/SocketContext";
import { useCookies } from "react-cookie";

export default function ImageViewer({ room }) {
    const [srcBlob, setSrcBlob] = useState(null);
    const [cookies] = useCookies(["token"]);
    const socket = useSocket();

    useEffect(() => {
        const handleImagePayload = (payload) => {
            if (payload.room === room) {
                const data = new Uint8Array(payload.data);
                const dataBase64 = btoa(String.fromCharCode(...data));
                setSrcBlob((prev) => (prev !== dataBase64 ? dataBase64 : prev));
            }
        };

        socket.on("image", handleImagePayload);
        socket.emit("join", { room, token: cookies.token });

        return () => {
            socket.off("image", handleImagePayload);
            socket.emit("leave", { room });
        };
    }, [room, cookies.token, socket]);

    return (
        <div className="imageviewer">
            {srcBlob && (
                <img
                    src={`data:image/jpeg;base64,${srcBlob}`}
                    alt={room}
                    style={{ maxWidth: "100%", height: "auto" }}
                />
            )}
        </div>
    );
}

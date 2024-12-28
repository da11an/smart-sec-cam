import React, { useEffect, useState } from "react";
import { useCookies } from "react-cookie";
import io from "socket.io-client";

const SERVER_URL = "https://localhost:8443";

export default function ImageViewer({ room }) {
    const [srcBlob, setSrcBlob] = useState(null);
    const [cookies] = useCookies(["token"]);
    const [socket, setSocket] = useState(null); // Manage socket as state to ensure clean lifecycle

    useEffect(() => {
        // Initialize a new socket connection
        const newSocket = io(SERVER_URL);

        const handleImagePayload = (payload) => {
            if (payload.room === room) {        
                const data = new Uint8Array(payload.data);
        
                // Convert Uint8Array to Base64 in chunks
                const chunkSize = 16 * 1024; // 16 KB per chunk
                let binaryString = "";
        
                for (let i = 0; i < data.length; i += chunkSize) {
                    binaryString += String.fromCharCode.apply(
                        null,
                        data.slice(i, i + chunkSize)
                    );
                }
        
                const dataBase64 = btoa(binaryString);
        
                // Update state only if the blob changes
                setSrcBlob((prev) => (prev !== dataBase64 ? dataBase64 : prev));
            }
        };
        

        // Register the listener
        newSocket.on("image", handleImagePayload);

        // Join the room
        newSocket.emit("join", { room, token: cookies.token });

        // Save socket instance to state
        setSocket(newSocket);

        // Cleanup on unmount
        return () => {
            newSocket.off("image", handleImagePayload); // Remove listener
            newSocket.emit("leave", { room }); // Optionally leave the room
            newSocket.disconnect(); // Fully disconnect the socket
        };
    }, [room, cookies.token]); // Dependencies: room and token

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

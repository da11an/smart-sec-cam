import React, { createContext, useContext } from "react";
import { io } from "socket.io-client";

const SERVER_URL = "https://localhost:8443";

// Create the SocketContext
const SocketContext = createContext();

// Provider Component
export const SocketProvider = ({ children }) => {
    const socket = React.useMemo(() => io(SERVER_URL), []);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};

// Custom hook to access the socket
export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error("useSocket must be used within a SocketProvider");
    }
    return context;
};

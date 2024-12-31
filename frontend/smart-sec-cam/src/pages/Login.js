import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { useCookies } from 'react-cookie';

import { validateToken } from "../utils/ValidateToken";

import "./Login.css";
import SERVER_URL from '../config';

const AUTH_ENDPOINT = "/api/auth/login";
const NUM_USERS_ENDPOINT = "/api/auth/num-users";
const REFRESH_TOKEN_ENDPOINT = "/api/token/refresh";

export default function Login(props) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [token, setToken] = useState("");
    const [hasRegisteredUser, setHasRegisteredUser] = useState(null);
    const [hasValidToken, setHasValidToken] = useState(null);
    const [loginError, setLoginError] = useState("");
    const [loading, setLoading] = useState(false);
    const [cookies, setCookie] = useCookies(["token"]);
    const navigate = useNavigate();

    useEffect(() => {
        checkServerHasUser();
    }, []);

    useEffect(() => {
        if (hasRegisteredUser == null) return;

        if (hasRegisteredUser) {
            const cachedToken = cookies.token;
            validateToken(cachedToken, setHasValidToken);
        } else if (hasRegisteredUser === false) {
            navigate('/register');
        }
    }, [hasRegisteredUser]);

    useEffect(() => {
        if (cookies.token && hasValidToken) {
            refreshToken(cookies.token);
        }
    }, [hasValidToken]);

    useEffect(() => {
        if (token && hasValidToken) {
            navigate('/live', { state: { token } });
        }
    }, [token]);

    function checkServerHasUser() {
        const url = SERVER_URL + NUM_USERS_ENDPOINT;
        fetch(url)
            .then((response) => response.json())
            .then((data) => setHasRegisteredUser(data["users"] > 0))
            .catch((error) => setLoginError("Failed to check server for users."));
    }

    function refreshToken(token) {
        const url = SERVER_URL + REFRESH_TOKEN_ENDPOINT;
        const payload = { token };
        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        };

        fetch(url, requestOptions)
            .then((response) => response.json())
            .then((data) => {
                if (data.status === "OK") {
                    setToken(data["token"]);
                    setCookie("token", data["token"], { path: "/" });
                } else {
                    console.log("Token refresh failed");
                }
            });
    }

    function handleLogin() {
        setLoading(true);
        setLoginError("");

        const url = SERVER_URL + AUTH_ENDPOINT;
        const payload = { username, password };
        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        };

        fetch(url, requestOptions)
            .then((response) => response.json())
            .then((data) => {
                setLoading(false);
                if (data.status === "OK") {
                    setToken(data["token"]);
                    setCookie("token", data["token"], { path: "/" });
                    navigate('/live');
                } else {
                    setLoginError("Invalid username or password.");
                }
            })
            .catch(() => {
                setLoading(false);
                setLoginError("Unable to reach the server. Please try again later.");
            });
    }

    return (
        <div className="Login">
            <Box
                sx={{
                    '& > :not(style)': { m: 1, width: '100%', paddingTop: '30vh', paddingBottom: '2vh' },
                }}
                display="flex"
                justifyContent="center"
                alignItems="center"
                flexDirection="column"
            >
                <Typography variant="h4" align="center" gutterBottom>
                    Smart Sec Cam
                </Typography>
            </Box>
            <Box
                sx={{
                    '& > :not(style)': { m: 1, width: '100%', padding: '10' },
                }}
                display="flex"
                justifyContent="center"
                alignItems="center"
                flexDirection="column"
            >
                <Typography variant="h5" align="center" gutterBottom>
                    Login
                </Typography>

                {loginError && <Alert severity="error" sx={{ maxWidth: '240px' }}>{loginError}</Alert>}

                <TextField
                    required
                    id="username"
                    label="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    sx={{
                        maxWidth: '240px',
                        '& .MuiInputBase-input': { color: 'white' },
                        '& .MuiOutlinedInput-root fieldset': { borderColor: 'white' },
                        "& .MuiInputLabel-root": { color: "white" },
                    }}
                />
                <TextField
                    required
                    id="password"
                    type="password"
                    label="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                    sx={{
                        maxWidth: '240px',
                        '& .MuiInputBase-input': { color: 'white' },
                        '& .MuiOutlinedInput-root fieldset': { borderColor: 'white' },
                        "& .MuiInputLabel-root": { color: "white" },
                    }}
                />

                <Button
                    variant="contained"
                    sx={{ maxWidth: '180px', maxHeight: '60px', minWidth: '50px', minHeight: '40px' }}
                    onClick={handleLogin}
                    disabled={loading}
                >
                    {loading ? <CircularProgress size={24} sx={{ color: 'white' }} /> : "Login"}
                </Button>
            </Box>
        </div>
    );
}

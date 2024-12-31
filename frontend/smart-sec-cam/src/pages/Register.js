import React from "react";
import { useNavigate } from "react-router-dom";

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import "./Register.css"
import SERVER_URL from '../config';

const REGISTER_ENDPOINT = "/api/auth/register"


export default function Register(props) {
    const [username, setUsername] = React.useState("");
    const [password, setPassword] = React.useState("");
    const navigate = useNavigate();

    function handleRegistration() {
        // Submit username and password
        const url = SERVER_URL + REGISTER_ENDPOINT;
        const payload = {
            "username": username,
            "password": password,
        }
        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        };
        fetch(url, requestOptions)
        .then(response => response.json())
        .then(data => handleRegisterResponse(data));  
    }

    function handleRegisterResponse(data) {
        if (data.status === "OK") {
            // Navigate to Login page
            navigate('/', {state: { username: username }});
        }
        else {
            // TODO: Show error message on UI somewhere
            console.log("Registration failed")
        }
    }

    return (
        <div className="Register">
            <Box
                component="form"
                sx={{
                    '& > :not(style)': { m: 1, width: '100%', paddingTop: '30vh', paddingBottom: '2vh' },
                }}
                noValidate
                autoComplete="off"
                display="flex"
                justifyContent="center"
                alignItems="center"
                flexDirection="column"
            >
                <Typography variant="h4" align="center" gutterBottom component="div">
                    Smart Sec Cam
                </Typography>
            </Box>
            <Box
                component="form"
                sx={{
                    '& > :not(style)': { m: 1, width: '100%', padding: '10' },
                }}
                noValidate
                autoComplete="off"
                display="flex"
                justifyContent="center"
                alignItems="center"
                flexDirection="column"
            >
                <Typography variant="h5" align="center" gutterBottom component="div">
                    Register
                </Typography>
                <TextField
                    required
                    id="username"
                    label="Username"
                    value={username}
                    onChange={event => setUsername(event.target.value)}
                    sx={{
                        maxWidth: '240px', 
                        minWidth: '120px', 
                        '& .MuiInputBase-input': {
                            color: 'white',
                        },
                        '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                              borderColor: 'white',
                            }
                        },
                        "& .MuiInputLabel-root": {
                            color: "white"
                        }
                    }}
                />
                <TextField
                    required
                    id="password"
                    type="password"
                    label="Password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    onKeyPress={event => {if (event.key === 'Enter') {handleRegistration()}}}
                    sx={{
                        maxWidth: '240px', 
                        minWidth: '120px', 
                        '& .MuiInputBase-input': {
                            color: 'white',
                        },
                        '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                              borderColor: 'white',
                            }
                        },
                        "& .MuiInputLabel-root": {
                            color: "white"
                        }
                    }}
                />
                <Button variant="contained" style={{maxWidth: '180px', maxHeight: '60px', minWidth: '50px', minHeight: '40px'}} onClick={() => handleRegistration()}>Register</Button>
            </Box>
        </div>
    );
}
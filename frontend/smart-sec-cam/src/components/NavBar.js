import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCookies } from 'react-cookie';
import SpaceUsage from './SpaceUsage';

import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MenuIcon from '@mui/icons-material/Menu';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#2e2e2e',
        },
        secondary: {
            main: "#1976d2",
        }
    },
});

export default function ButtonAppBar(props) {
    const navigate = useNavigate();
    const [anchorEl, setAnchorEl] = useState(null);
    const [editingMode, setEditingMode] = useState(false);
    const [cookies, , removeCookie] = useCookies(['token']);

    const handleMenuOpen = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const goToPage = (path) => {
        navigate(path, { state: { token: props.token } });
        handleMenuClose();
    };

    const handleLogout = () => {
        removeCookie('token');
        navigate('/', {});
        handleMenuClose();
    };

    const toggleEditingMode = (event) => {
        setEditingMode(event.target.checked);
        props.onEditingModeChange(event.target.checked);
    };

    return (
        <Box sx={{
            flexGrow: 0,
            display: 'flex',
            flexDirection: 'column'
        }}>
            <ThemeProvider theme={darkTheme}>
                <AppBar position="static">
                    <Toolbar variant="dense" color="primary">
                        <IconButton
                            size="large"
                            edge="start"
                            color="inherit"
                            aria-label="menu"
                            sx={{ mr: 2 }}
                            onClick={handleMenuOpen}
                        >
                            <MenuIcon />
                        </IconButton>

                        <Menu
                            anchorEl={anchorEl}
                            open={Boolean(anchorEl)}
                            onClose={handleMenuClose}
                        >
                            <MenuItem onClick={() => goToPage('/live')}>Live</MenuItem>
                            <MenuItem onClick={() => goToPage('/videos')}>Videos</MenuItem>
                            <MenuItem>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={editingMode}
                                            onChange={toggleEditingMode}
                                            color="secondary"
                                        />
                                    }
                                    label="Editing Mode"
                                />
                            </MenuItem>
                            <MenuItem onClick={handleLogout}>Logout</MenuItem>
                            <MenuItem sx={{ 
                                display: 'block', 
                                width: '300px',
                                '&:hover': {
                                    backgroundColor: 'transparent',
                                    cursor: 'default'
                                }
                            }}>
                                <SpaceUsage />
                            </MenuItem>
                        </Menu>

                        <Typography variant="h6" component="div" align="left" sx={{ flexGrow: 1 }}>
                            Smart Home and Nature Camera
                        </Typography>
                    </Toolbar>
                </AppBar>
            </ThemeProvider>
        </Box>
    );
}
